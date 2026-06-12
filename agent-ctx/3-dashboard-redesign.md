---
Task ID: 3
Agent: Dashboard Redesign Agent
Task: Redesign main dashboard page to prominently display NIFTY 50, BANKNIFTY, FINNIFTY, SENSEX with real API data

Work Log:
- Read worklog.md (Task 1 context: Upstox API was fixed for option chains)
- Analyzed existing dashboard-page.tsx (~830 lines with hardcoded fallback data)
- Analyzed index-ticker.tsx (hardcoded fallback in catch block)
- Read API routes: /api/indices, /api/options/chain/[underlying]
- Understood data format: indices return {id, symbol, name, currentPrice, change, changePercent}, option chain returns {chain, spot, pcr, maxPain, isRealData, dataSource}

Changes Made:

1. **dashboard-page.tsx** - Complete rewrite:
   - Removed ALL fallback data arrays (fallbackIndices, fallbackGainers, fallbackLosers, fallbackOtherStocks)
   - Removed "Other Stocks" section with search (not in requirements)
   - Removed fallback logic in display data (no more `apiIndices.length > 0 ? apiIndices : fallbackIndices`)
   - Added 4 prominent index cards showing NIFTY, BANKNIFTY, FINNIFTY, SENSEX
   - Each index card contains:
     - Header: Index name + price + change with color (green/red) and LIVE badge
     - Quick stats row: Spot | PCR | Max Pain
     - Total CE OI / PE OI row
     - Mini option chain table (7 strikes around ATM, showing CE OI, CE LTP, Strike, PE LTP, PE OI)
     - Footer showing data source and "View Details" link
   - Added separate option chain fetching for each of the 4 indices via /api/options/chain/{symbol}
   - Added MiniOptionChain component with ATM detection, 3 strikes above/below
   - Added IndexCardSkeleton for loading state
   - Added manual refresh button with spinner
   - Added last-refreshed timestamp
   - Responsive grid: 1 col mobile, 2 col tablet, 4 col desktop
   - Auto-refresh every 30 seconds
   - Empty states show "data unavailable" instead of fake numbers
   - Framer Motion entry animation for index cards

2. **index-ticker.tsx** - Fixed fallback:
   - Removed hardcoded fallback data in catch block (lines 39-44)
   - On API failure, previous data is preserved (no fake data shown)

Stage Summary:
- Dashboard now shows real data ONLY - no hardcoded fallback/demo/mock data
- 4 index cards are the primary focus with option chain data
- Market breadth, sectors, gainers, losers kept as secondary sections below
- Lint passes with 0 errors (only pre-existing warnings in other files)
- Dev server runs without compilation errors
