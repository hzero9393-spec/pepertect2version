import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { cache, CacheTTL } from '@/lib/cache'
import { getMarketDataManager } from '@/lib/market-data-manager'

// Force dynamic - no caching at Next.js level
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const sector = searchParams.get('sector')
    const fnoOnly = searchParams.get('fnoOnly')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    // Build cache key that includes pagination params
    const cacheKey = `api:stocks:${search || ''}:${sector || ''}:${fnoOnly || ''}:${page}:${limit}`

    // Check server-side cache first (1s TTL)
    const cached = cache.get<{
      success: boolean
      data: unknown[]
      count: number
      total: number
      page: number
      limit: number
      realDataCount: number
    }>(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    const where: Record<string, unknown> = { isActive: true }

    if (search) {
      where.OR = [
        { symbol: { contains: search } },
        { name: { contains: search } },
      ]
    }

    if (sector) {
      where.sector = sector
    }

    if (fnoOnly === 'true') {
      where.isFuturesAvailable = true
      where.isOptionsAvailable = true
    }

    // Get total count for pagination
    const total = await db.stock.count({ where })

    // 1. Get paginated stock data from database
    const stocks = await db.stock.findMany({
      where,
      orderBy: { marketCap: 'desc' },
      skip,
      take: limit,
    })

    // 2. Try MarketDataManager first (has live Yahoo Finance data)
    let liveMap: Record<string, { last_price: number; net_change: number; ohlc: { open: number; high: number; low: number; close: number }; volume: number | null; oi: number | null }> = {}
    let liveSource = 'database'

    try {
      const manager = getMarketDataManager()
      const managerStocks = manager.stocks
      if (Object.keys(managerStocks).length > 0) {
        // Only get data for stocks on this page
        for (const stock of stocks) {
          if (managerStocks[stock.symbol]) {
            liveMap[stock.symbol] = managerStocks[stock.symbol]
          }
        }
        if (Object.keys(liveMap).length > 0) {
          liveSource = manager.source === 'yahoo' ? 'yahoo' : (manager.source === 'upstox' ? 'upstox' : 'database')
        }
      }
    } catch {
      // MarketDataManager not available
    }

    // 3. Merge DB data with live data
    const realCount = Object.keys(liveMap).length
    const merged = stocks.map(s => {
      const rt = liveMap[s.symbol]
      if (rt && rt.last_price > 0) {
        const previousClose = rt.ohlc.close
        const changePercent = previousClose > 0 ? (rt.net_change / previousClose) * 100 : 0
        return {
          ...s,
          currentPrice: rt.last_price,
          change: rt.net_change,
          changePercent: Math.round(changePercent * 100) / 100,
          open: rt.ohlc.open || s.open,
          high: rt.ohlc.high || s.high,
          low: rt.ohlc.low || s.low,
          previousClose: previousClose || s.previousClose,
          volume: rt.volume || s.volume,
          isRealData: true,
          dataSource: liveSource,
        }
      }
      return { ...s, isRealData: false, dataSource: 'database' }
    })

    // 4. Update DB with real-time prices (async, non-blocking, throttled to 5s)
    if (realCount > 0) {
      const lastDbUpdate = cache.get<number>('api:stocks:lastDbUpdate')
      if (!lastDbUpdate || Date.now() - lastDbUpdate > 5000) {
        cache.set('api:stocks:lastDbUpdate', Date.now(), 10000)
        Promise.allSettled(
          Object.entries(liveMap).map(([symbol, rt]) => {
            const previousClose = rt.ohlc.close
            const changePercent = previousClose > 0 ? (rt.net_change / previousClose) * 100 : 0
            return db.stock.update({
              where: { symbol },
              data: {
                currentPrice: rt.last_price,
                change: rt.net_change,
                changePercent: Math.round(changePercent * 100) / 100,
                open: rt.ohlc.open,
                high: rt.ohlc.high,
                low: rt.ohlc.low,
                previousClose,
                volume: rt.volume,
                lastUpdated: new Date(),
              },
            }).catch(() => {})
          })
        ).catch(() => {})
      }
    }

    const response = {
      success: true,
      data: merged,
      count: merged.length,
      total,
      page,
      limit,
      realDataCount: realCount,
    }

    // Cache the response for 1s
    cache.set(cacheKey, response, CacheTTL.STOCK_PRICE)

    return NextResponse.json(response)
  } catch (error) {
    console.error('[API /stocks] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stocks' },
      { status: 500 }
    )
  }
}
