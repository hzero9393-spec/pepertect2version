# Task 4 - Update Stocks API with Pagination and Search

## Task
Update `/home/z/my-project/src/app/api/stocks/route.ts` to support search-based loading with pagination.

## Changes Made

### File Modified: `src/app/api/stocks/route.ts`

**Before**: The API fetched ALL stocks from DB, then fetched Upstox quotes for ALL of them in a single batch call. With 150+ stocks, this was slow and wasteful.

**After**: The API now supports:

1. **Pagination**: `page` (default: 1) and `limit` (default: 50) query params
   - Uses Prisma `skip` and `take` for efficient DB pagination
   - Returns `total` count for frontend pagination controls

2. **Search**: `search` query param filters by `symbol` or `name` (case-insensitive contains)
   - Debounce-friendly: frontend can send search terms and only get matching results

3. **Sector filter**: Preserved existing `sector` param

4. **F&O filter**: Preserved existing `fnoOnly` param

5. **Key Optimization - Upstox batch calls**:
   - Only fetches Upstox quotes for stocks on the CURRENT page (50 max vs 150+)
   - Batched in groups of 30 to avoid URL length limits
   - Each batch is a separate fetch call with its own timeout

6. **Cache key**: Now includes all filter/pagination params
   - Format: `api:stocks:${search}:${sector}:${fnoOnly}:${page}:${limit}`
   - 1-second TTL via `CacheTTL.STOCK_PRICE`

7. **Response shape**: Updated to include pagination metadata
   ```json
   {
     "success": true,
     "data": [...],
     "count": 50,
     "total": 150,
     "page": 1,
     "limit": 50,
     "realDataCount": 45
   }
   ```

## Verification
- No lint errors in the modified file
- Dev server running normally
- Existing `sector`, `fnoOnly`, `search` filters all preserved
- DB update logic (async non-blocking) preserved
