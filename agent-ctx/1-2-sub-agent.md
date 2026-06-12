# Task 1-2: Create Bulk Stock Import API and Seed Data

## Work Record

### Files Created

1. **`/home/z/my-project/src/lib/stock-data.ts`** (202 lines)
   - Exports `StockSeedData` interface and `ALL_STOCKS` array
   - Contains 150 Indian stocks across 20+ sectors
   - Sectors: Banking, Finance, Insurance, Energy, FMCG, Oil & Gas, Metals, Automobile, Auto Parts, Paint, Telecom, Infrastructure, Textiles, Retail, Cement, Aerospace, Mining, IT, Construction, Pharma, Healthcare, Conglomerate, Consumer

2. **`/home/z/my-project/src/app/api/stocks/bulk-import/route.ts`** (84 lines)
   - POST endpoint accepting `{ stocks: StockSeedData[] }` body
   - Validates input (must be non-empty array)
   - Upserts each stock using `db.stock.upsert` with `symbol` as unique key
   - Returns `{ success, upserted, errors, total }` response
   - Uses `force-dynamic` for fresh execution

3. **`/home/z/my-project/src/app/api/stocks/init/route.ts`** (64 lines)
   - GET endpoint that imports `ALL_STOCKS` from `stock-data.ts`
   - Upserts all stocks into the database
   - Cache TTL of 1 hour (`revalidate = 3600`)
   - Returns `{ success, upserted, errors, total, message }` response

### Key Design Decisions

- Used `upsert` pattern to handle both new and existing stocks gracefully
- Auto-calculated `strikeInterval = Math.round(currentPrice / 50) * 5 || 10`
- Default `exchange: 'NSE'` and `circuitLimit: 20` for new stocks
- `isActive: true` set on both create and update paths
- Error counting with `try/catch` per stock to avoid full batch failure

### Verification

- 150 stock entries confirmed in data file
- No lint issues in any of the new files
- Dev server running normally on port 3000
