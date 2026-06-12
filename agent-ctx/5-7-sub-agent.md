# Task 5-7: Seed DB, Update Trading Page, Optimize Index Ticker

## Task Summary
1. Seeded the database with 149 stocks via `/api/stocks/init` endpoint
2. Updated trading page with search-first approach, sector tabs, and lazy loading/pagination
3. Optimized index ticker for real-time data (2s REST fallback)

## Files Modified
- `/home/z/my-project/src/components/pepertect/pages/trading-page.tsx` - Major rewrite of data fetching, tabs, pagination
- `/home/z/my-project/src/components/pepertect/index-ticker.tsx` - REST fallback interval optimization

## Key Changes

### Trading Page
- Extended `StockTab` type with 11 sector tabs (banking, it, pharma, auto, fmcg, energy, metals, oilGas, finance, telecom, infrastructure)
- Added `sectorMap` for API param mapping
- Updated tabs array from 6 to 17 tabs with visual divider
- Rewrote `fetchStocks` to use `/api/stocks` with pagination, search, and sector filter
- Added pagination state: `currentPage`, `totalStocks`, `loadingMore`
- Added debounced search (300ms) triggering API calls
- Added "Load More" button with remaining count
- Updated stock list container to `max-h-[calc(100vh-280px)] overflow-y-auto`
- Market stats now shows `totalStocks` from API

### Index Ticker
- REST fallback interval: 2s when WS disconnected, 10s when WS connected
- WebSocket data properly prioritized when available

## Database State
- 149 stocks in the database (up from 20)
- API filters verified: Banking (23), search "TATA" (5), F&O (109), pagination works

## Dev Server
- Running on port 3000
- No lint errors in modified files
