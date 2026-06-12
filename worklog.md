---
Task ID: 1
Agent: Main Agent
Task: Fix live market data on Pepertect website - replace invalid Upstox token with working Yahoo Finance data source

Work Log:
- Examined existing codebase: upstox-ws-manager.ts, market/live API, market/stream SSE, use-market-data.ts hook
- Discovered Upstox access token is INVALID (401 error) - API returns "Invalid token used to access API"
- Tested alternative data sources: Yahoo Finance v8 chart API WORKS and returns real live prices
- Created new market-data-manager.ts that uses Yahoo Finance as primary source (free, no auth needed)
- Yahoo Finance returns real prices: NIFTY 23,425, BANKNIFTY 56,180, RELIANCE 1,272, etc.
- Updated upstox-ws-manager.ts to re-export from market-data-manager.ts for backward compatibility
- Used globalThis for singleton persistence across Next.js API routes
- Updated all API routes to use MarketDataManager: market/live, market/stream, indices, stocks, gainers, losers, breadth, index-detail, stocks/detail
- Added direct Yahoo Finance v8 chart API to upstox-api.ts getFinanceQuote() function
- Fixed REST polling interval from 1s to 3s and added deduplication to prevent excessive API calls
- Fixed market breadth API to calculate from live data
- Fixed gainers/losers APIs to calculate directly from live MarketDataManager data
- Verified all APIs return live data with source=yahoo and isRealData=true

Stage Summary:
- ALL market data APIs now return LIVE data from Yahoo Finance
- SSE stream pushes live data to frontend every 2 seconds
- Market breadth: Advances=48, Declines=17 (live)
- Gainers: HDFCBANK +2.83%, BHARTIARTL +1.83% (live)
- Losers: ONGC -2.53%, OIL -2.49% (live)
- Stock detail: RELIANCE ₹1,272.4 (live, source=yahoo)
- Website dashboard shows LIVE badges and real-time price updates
