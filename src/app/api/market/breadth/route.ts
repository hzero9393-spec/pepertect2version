import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getMarketDataManager } from '@/lib/market-data-manager'

// Force dynamic - no caching
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    // Try to compute breadth from live data first
    try {
      const manager = getMarketDataManager()
      const liveStocks = manager.stocks

      if (Object.keys(liveStocks).length > 0) {
        let advances = 0
        let declines = 0
        let unchanged = 0

        for (const [, stock] of Object.entries(liveStocks)) {
          if (stock.net_change > 0) advances++
          else if (stock.net_change < 0) declines++
          else unchanged++
        }

        const totalStocks = advances + declines + unchanged

        return NextResponse.json({
          success: true,
          data: {
            advances,
            declines,
            unchanged,
            totalStocks,
            advanceDeclineRatio: declines > 0 ? Math.round((advances / declines) * 100) / 100 : advances > 0 ? Infinity : 0,
            date: new Date(),
            isRealData: true,
            dataSource: manager.source,
          },
        })
      }
    } catch {
      // MarketDataManager not available, fall back to DB
    }

    // Fallback: Get from database
    const breadth = await db.marketBreadth.findFirst({
      orderBy: { date: 'desc' },
    })

    if (!breadth) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No market breadth data available',
      })
    }

    return NextResponse.json({
      success: true,
      data: breadth,
    })
  } catch (error) {
    console.error('[API /market/breadth] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch market breadth' },
      { status: 500 }
    )
  }
}
