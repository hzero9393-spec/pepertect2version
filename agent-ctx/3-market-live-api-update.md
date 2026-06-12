# Task 3 - market-live-api-update

## Task: Update /api/market/live/route.ts for Vercel serverless

### What was done:
1. **Updated `/home/z/my-project/src/lib/cache.ts`**:
   - Added `CacheKeys.marketLive: () => 'market:live:data'` for centralized cache key management
   - Added `CacheTTL.MARKET_LIVE: 200` (200ms TTL for near-real-time data)

2. **Rewrote `/home/z/my-project/src/app/api/market/live/route.ts`**:
   - Removed `refreshTimer`, `isRefreshing`, `ensureRefreshStarted()` and all `setInterval` logic
   - Implemented on-demand fetch pattern: check cache → return if fresh (within 200ms) → fetch from Upstox → cache → return
   - Added `inFlightFetch` promise for concurrent request deduplication (prevents multiple simultaneous Upstox API calls)
   - Kept `dynamic = 'force-dynamic'` and `revalidate = 0`
   - Same response format: `{ success, data, freshness }`

### Why:
- Vercel serverless functions are ephemeral - background `setInterval` timers die when instances spin down
- Each cold start would create a new timer that never gets cleaned up
- On-demand fetch with short cache works perfectly with the frontend's 200ms polling

### Verification:
- Lint passes with 0 errors
- Dev server shows API responding: ~2-7ms for cached responses, ~250ms for fresh fetches
