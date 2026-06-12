import { NextResponse } from 'next/server'
import { fetchIndexDetailData } from '@/lib/upstox-api'
import { getMarketDataManager } from '@/lib/market-data-manager'

// Force dynamic - no caching
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params
    const symbolUpper = symbol.toUpperCase()

    // Use comprehensive data fetcher (Upstox → Yahoo → Fallback)
    const indexData = await fetchIndexDetailData(symbolUpper)

    if (!indexData) {
      return NextResponse.json(
        { success: false, error: `Unknown index: ${symbol}` },
        { status: 400 }
      )
    }

    // Overlay live data from MarketDataManager if available
    try {
      const manager = getMarketDataManager()
      const liveIndex = manager.indices[symbolUpper]
      if (liveIndex && liveIndex.last_price > 0) {
        const previousClose = liveIndex.ohlc.close
        const changePercent = previousClose > 0 ? (liveIndex.net_change / previousClose) * 100 : 0
        indexData.currentPrice = liveIndex.last_price
        indexData.change = liveIndex.net_change
        indexData.changePercent = changePercent
        indexData.open = liveIndex.ohlc.open || indexData.open
        indexData.high = liveIndex.ohlc.high || indexData.high
        indexData.low = liveIndex.ohlc.low || indexData.low
        indexData.previousClose = previousClose || indexData.previousClose
        indexData.volume = liveIndex.volume || indexData.volume
        indexData.isRealData = true
        indexData.dataSource = manager.source === 'yahoo' ? 'yahoo' : (manager.source === 'upstox' ? 'upstox' : indexData.dataSource)
      }
    } catch {
      // MarketDataManager not available
    }

    return NextResponse.json({ success: true, data: indexData })
  } catch (error) {
    console.error(`[API /market/index-detail] Error:`, error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch index detail' },
      { status: 500 }
    )
  }
}
