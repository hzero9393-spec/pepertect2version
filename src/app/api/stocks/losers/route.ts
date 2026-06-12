import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getMarketDataManager } from '@/lib/market-data-manager'

// Force dynamic - no caching
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    // Try MarketDataManager first for live losers
    try {
      const manager = getMarketDataManager()
      const liveStocks = manager.stocks

      if (Object.keys(liveStocks).length > 0) {
        // Calculate losers from live data
        const losers: any[] = []

        for (const [symbol, live] of Object.entries(liveStocks)) {
          if (live.net_change < 0 && live.last_price > 0) {
            const previousClose = live.ohlc.close
            const changePercent = previousClose > 0 ? (live.net_change / previousClose) * 100 : 0

            losers.push({
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

        // Sort by changePercent ascending (worst losers first)
        losers.sort((a, b) => a.changePercent - b.changePercent)

        // Enrich with DB data (name, sector, etc.)
        if (losers.length > 0) {
          const symbols = losers.map(l => l.symbol)
          const dbStocks = await db.stock.findMany({
            where: { symbol: { in: symbols } },
            select: { symbol: true, name: true, sector: true, marketCap: true },
          })

          const dbMap = new Map(dbStocks.map(s => [s.symbol, s]))

          for (const loser of losers) {
            const dbData = dbMap.get(loser.symbol)
            if (dbData) {
              loser.name = dbData.name
              loser.sector = dbData.sector
              loser.marketCap = dbData.marketCap
            }
          }
        }

        return NextResponse.json({
          success: true,
          data: losers.slice(0, 10),
        })
      }
    } catch {
      // MarketDataManager not available, fall back to DB
    }

    // Fallback: Get top losers from DB (sorted by changePercent asc)
    const losers = await db.stock.findMany({
      where: {
        isActive: true,
        changePercent: { lt: 0 },
      },
      orderBy: { changePercent: 'asc' },
      take: 10,
    })

    return NextResponse.json({
      success: true,
      data: losers,
    })
  } catch (error) {
    console.error('[API /stocks/losers] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch top losers' },
      { status: 500 }
    )
  }
}
