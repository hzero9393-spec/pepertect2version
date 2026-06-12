import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchStockOverviewData } from '@/lib/upstox-api'
import { getMarketDataManager } from '@/lib/market-data-manager'

// Force dynamic - no caching
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params
    const symbolUpper = symbol.toUpperCase()

    // Get stock from database
    const dbStock = await db.stock.findUnique({
      where: { symbol: symbolUpper },
    })

    // Use comprehensive data fetcher (Upstox → Dhan → Yahoo → DB fallback)
    const stockData = await fetchStockOverviewData(symbolUpper, dbStock as Record<string, unknown> | null)

    // ENHANCE: Overlay live data from MarketDataManager if available
    try {
      const manager = getMarketDataManager()
      const liveStock = manager.stocks[symbolUpper]
      if (liveStock && liveStock.last_price > 0) {
        // Override with real-time data from MarketDataManager (Yahoo Finance)
        const previousClose = liveStock.ohlc.close
        const changePercent = previousClose > 0 ? (liveStock.net_change / previousClose) * 100 : 0

        stockData.currentPrice = liveStock.last_price
        stockData.change = liveStock.net_change
        stockData.changePercent = changePercent
        stockData.open = liveStock.ohlc.open || stockData.open
        stockData.high = liveStock.ohlc.high || stockData.high
        stockData.low = liveStock.ohlc.low || stockData.low
        stockData.previousClose = previousClose || stockData.previousClose
        stockData.close = previousClose || stockData.close
        stockData.volume = liveStock.volume || stockData.volume
        stockData.isRealData = true
        stockData.dataSource = manager.source === 'yahoo' ? 'yahoo' : (manager.source === 'upstox' ? 'upstox' : stockData.dataSource)
      }

      // Also check for live index data if this is an index
      const liveIndex = manager.indices[symbolUpper]
      if (liveIndex && liveIndex.last_price > 0) {
        const previousClose = liveIndex.ohlc.close
        const changePercent = previousClose > 0 ? (liveIndex.net_change / previousClose) * 100 : 0

        stockData.currentPrice = liveIndex.last_price
        stockData.change = liveIndex.net_change
        stockData.changePercent = changePercent
        stockData.open = liveIndex.ohlc.open || stockData.open
        stockData.high = liveIndex.ohlc.high || stockData.high
        stockData.low = liveIndex.ohlc.low || stockData.low
        stockData.previousClose = previousClose || stockData.previousClose
        stockData.close = previousClose || stockData.close
        stockData.volume = liveIndex.volume || stockData.volume
        stockData.isRealData = true
        stockData.dataSource = manager.source === 'yahoo' ? 'yahoo' : (manager.source === 'upstox' ? 'upstox' : stockData.dataSource)
      }
    } catch {
      // MarketDataManager not available, use stockData as-is
    }

    // Get similar stocks from the same sector
    let similarStocks: Array<{
      symbol: string; name: string; currentPrice: number; change: number; changePercent: number; sector: string
    }> = []

    if (stockData.sector) {
      similarStocks = await db.stock.findMany({
        where: {
          sector: stockData.sector,
          symbol: { not: symbolUpper },
          isActive: true,
        },
        select: {
          symbol: true,
          name: true,
          currentPrice: true,
          change: true,
          changePercent: true,
          sector: true,
        },
        orderBy: { marketCap: 'desc' },
        take: 8,
      })
    }

    return NextResponse.json({
      success: true,
      data: stockData,
      similarStocks,
    })
  } catch (error) {
    console.error(`[API /stocks/detail] Error:`, error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stock detail' },
      { status: 500 }
    )
  }
}
