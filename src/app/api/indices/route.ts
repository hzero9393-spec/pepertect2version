import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { isUpstoxAuthenticated, getUpstoxIndexQuotesMap } from '@/lib/upstox-api'
import { cache, CacheTTL } from '@/lib/cache'
import { getMarketDataManager } from '@/lib/market-data-manager'

// Force dynamic - no caching at Next.js level
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Cache key for the full indices response
const INDICES_RESPONSE_CACHE_KEY = 'api:indices:response'

export async function GET() {
  try {
    // Check server-side cache first (1s TTL for real-time feel with fast response)
    const cached = cache.get<{
      success: boolean
      data: unknown[]
      realDataCount: number
    }>(INDICES_RESPONSE_CACHE_KEY)
    if (cached) {
      return NextResponse.json(cached)
    }

    // 1. Get base data from database
    const indices = await db.index.findMany({
      where: { isEnabled: true },
      orderBy: { symbol: 'asc' },
    })

    // 2. Try MarketDataManager first (has live Yahoo Finance data)
    let liveMap: Record<string, { last_price: number; net_change: number; ohlc: { open: number; high: number; low: number; close: number }; volume: number | null }> = {}
    let liveSource = 'database'

    try {
      const manager = getMarketDataManager()
      const managerIndices = manager.indices
      if (Object.keys(managerIndices).length > 0) {
        liveMap = managerIndices
        liveSource = manager.source === 'yahoo' ? 'yahoo' : (manager.source === 'upstox' ? 'upstox' : 'database')
      }
    } catch {
      // MarketDataManager not available
    }

    // 3. If MarketDataManager didn't have data, try Upstox directly
    if (Object.keys(liveMap).length === 0) {
      try {
        if (await isUpstoxAuthenticated()) {
          const symbols = indices.map(idx => idx.symbol)
          liveMap = await getUpstoxIndexQuotesMap(symbols)
          if (Object.keys(liveMap).length > 0) {
            liveSource = 'upstox'
          }
        }
      } catch (err) {
        console.warn('[API /indices] Upstox quotes failed, using DB data:', err)
      }
    }

    // 4. Merge DB data with live data AND update DB
    const realCount = Object.keys(liveMap).length
    const merged = indices.map(idx => {
      const rt = liveMap[idx.symbol]
      if (rt && rt.last_price > 0) {
        const previousClose = rt.ohlc.close
        const changePercent = previousClose > 0 ? (rt.net_change / previousClose) * 100 : 0
        return {
          ...idx,
          currentPrice: rt.last_price,
          change: rt.net_change,
          changePercent: Math.round(changePercent * 100) / 100,
          open: rt.ohlc.open || idx.open,
          high: rt.ohlc.high || idx.high,
          low: rt.ohlc.low || idx.low,
          previousClose,
          volume: rt.volume || idx.volume,
          isRealData: true,
          dataSource: liveSource,
        }
      }
      return { ...idx, isRealData: false, dataSource: 'database' }
    })

    // 5. Update DB with real-time index prices (async, non-blocking, throttled to 5s)
    const lastDbUpdate = cache.get<number>('api:indices:lastDbUpdate')
    if (realCount > 0 && (!lastDbUpdate || Date.now() - lastDbUpdate > 5000)) {
      cache.set('api:indices:lastDbUpdate', Date.now(), 10000)
      Promise.allSettled(
        Object.entries(liveMap).map(([symbol, rt]) =>
          db.index.update({
            where: { symbol },
            data: {
              currentPrice: rt.last_price,
              change: rt.net_change,
              high: rt.ohlc.high,
              low: rt.ohlc.low,
              open: rt.ohlc.open,
              lastUpdated: new Date(),
            },
          }).catch(() => {})
        )
      ).catch(() => {})
    }

    const response = {
      success: true,
      data: merged,
      realDataCount: realCount,
    }

    // Cache the response for 1s to handle rapid polling efficiently
    cache.set(INDICES_RESPONSE_CACHE_KEY, response, CacheTTL.STOCK_PRICE)

    return NextResponse.json(response)
  } catch (error) {
    console.error('[API /indices] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch indices' },
      { status: 500 }
    )
  }
}
