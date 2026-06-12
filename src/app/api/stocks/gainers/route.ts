import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getMarketDataManager } from '@/lib/market-data-manager'

// Force dynamic - no caching
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    // Try MarketDataManager first for live gainers
    try {
      const manager = getMarketDataManager()
      const liveStocks = manager.stocks

      if (Object.keys(liveStocks).length > 0) {
        // Calculate gainers from live data
        const gainers: any[] = []

        for (const [symbol, live] of Object.entries(liveStocks)) {
          if (live.net_change > 0 && live.last_price > 0) {
            const previousClose = live.ohlc.close
            const changePercent = previousClose > 0 ? (live.net_change / previousClose) * 100 : 0

            gainers.push({
              symbol,
              currentPrice: live.last_price,
              change: live.net_change,
              changePercent: Math.round(changePercent * 100) / 100,
              open: live.ohlc.open,
              high: live.ohlc.high,
              low: live.ohlc.low,
              volume: live.volume,
              isRealData: true,
              dataSource: manager.source === 'yahoo' ? 'yahoo' : 'market-data',
            })
          }
        }

        // Sort by changePercent descending (best gainers first)
        gainers.sort((a, b) => b.changePercent - a.changePercent)

        // Enrich with DB data (name, sector, etc.)
        if (gainers.length > 0) {
          const symbols = gainers.map(g => g.symbol)
          const dbStocks = await db.stock.findMany({
            where: { symbol: { in: symbols } },
            select: { symbol: true, name: true, sector: true, marketCap: true },
          })

          const dbMap = new Map(dbStocks.map(s => [s.symbol, s]))

          for (const gainer of gainers) {
            const dbData = dbMap.get(gainer.symbol)
            if (dbData) {
              gainer.name = dbData.name
              gainer.sector = dbData.sector
              gainer.marketCap = dbData.marketCap
            }
          }
        }

        return NextResponse.json({
          success: true,
          data: gainers.slice(0, 10),
        })
      }
    } catch {
      // MarketDataManager not available, fall back to DB
    }

    // Fallback: Get top gainers from DB (sorted by changePercent desc)
    const gainers = await db.stock.findMany({
      where: {
        isActive: true,
        changePercent: { gt: 0 },
      },
      orderBy: { changePercent: 'desc' },
      take: 10,
    })

    return NextResponse.json({
      success: true,
      data: gainers,
    })
  } catch (error) {
    console.error('[API /stocks/gainers] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch top gainers' },
      { status: 500 }
    )
  }
}
