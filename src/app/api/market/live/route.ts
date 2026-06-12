import { NextResponse } from 'next/server'
import { cache, CacheKeys, CacheTTL } from '@/lib/cache'
import { getMarketDataManager, type MarketUpdate } from '@/lib/market-data-manager'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 30

interface LiveMarketData {
  indices: Record<string, {
    last_price: number
    net_change: number
    ohlc: { open: number; high: number; low: number; close: number }
    volume: number | null
  }>
  stocks: Record<string, {
    last_price: number
    net_change: number
    ohlc: { open: number; high: number; low: number; close: number }
    volume: number | null
    oi: number | null
  }>
  timestamp: number
  source?: string
}

export async function GET() {
  // Primary: Use the global MarketDataManager which polls Yahoo Finance/Upstox every 2s
  // This ensures fresh data without separate API calls per request
  const manager = getMarketDataManager()

  const indices = manager.indices
  const stocks = manager.stocks

  if (Object.keys(indices).length > 0 || Object.keys(stocks).length > 0) {
    const data: LiveMarketData = {
      indices,
      stocks,
      timestamp: Date.now(),
      source: manager.source || 'market-data-manager',
    }

    // Also update the cache for any other consumers
    cache.set(CacheKeys.marketLive(), data, CacheTTL.MARKET_LIVE)

    return NextResponse.json({
      success: true,
      data,
      freshness: 0,
    })
  }

  // Fallback: Check cache
  const cached = cache.get<LiveMarketData>(CacheKeys.marketLive())
  if (cached && (Object.keys(cached.indices).length > 0 || Object.keys(cached.stocks).length > 0)) {
    const age = Date.now() - cached.timestamp
    return NextResponse.json({
      success: true,
      data: cached,
      freshness: age,
    })
  }

  // Database fallback
  try {
    const { db } = await import('@/lib/db')

    const dbIndices = await db.index.findMany({ where: { isEnabled: true } })
    const idxData: LiveMarketData['indices'] = {}
    for (const idx of dbIndices) {
      idxData[idx.symbol] = {
        last_price: idx.currentPrice,
        net_change: idx.change,
        ohlc: {
          open: idx.open || idx.currentPrice,
          high: idx.high || idx.currentPrice,
          low: idx.low || idx.currentPrice,
          close: idx.previousClose || idx.currentPrice,
        },
        volume: idx.volume,
      }
    }

    const dbStocks = await db.stock.findMany({
      where: { isActive: true },
      take: 100,
      orderBy: { marketCap: 'desc' },
    })
    const stkData: LiveMarketData['stocks'] = {}
    for (const stock of dbStocks) {
      stkData[stock.symbol] = {
        last_price: stock.currentPrice,
        net_change: stock.change,
        ohlc: {
          open: stock.open || stock.currentPrice,
          high: stock.high || stock.currentPrice,
          low: stock.low || stock.currentPrice,
          close: stock.previousClose || stock.currentPrice,
        },
        volume: stock.volume,
        oi: null,
      }
    }

    if (Object.keys(idxData).length > 0 || Object.keys(stkData).length > 0) {
      const dbResult: LiveMarketData = { indices: idxData, stocks: stkData, timestamp: Date.now(), source: 'database' }
      cache.set(CacheKeys.marketLive(), dbResult, 5000)
      return NextResponse.json({
        success: true,
        data: dbResult,
        freshness: 0,
      })
    }
  } catch {
    // Continue to empty fallback
  }

  // Absolute fallback — empty data
  return NextResponse.json({
    success: true,
    data: { indices: {}, stocks: {}, timestamp: 0, source: 'none' },
    freshness: -1,
  })
}
