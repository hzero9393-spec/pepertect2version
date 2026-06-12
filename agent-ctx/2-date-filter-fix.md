# Task 2: Fix Date Filters on Reports/Orders/Portfolio Pages

## Agent: date-filter-fix

## Summary
Fixed date filters on Reports, Orders, and Portfolio pages to actually filter displayed data instead of being purely visual. Added shared Zustand store state so filter selections persist across page navigation.

## Changes Made

### 1. `/home/z/my-project/src/lib/store.ts`
- Added `dateFilterPreset: DateFilterPreset` and `dateFilterRange: DateRange | undefined` to global state
- Added `setDateFilter(preset, range?)` action
- Import types from `@/components/pepertect/date-filter`

### 2. `/home/z/my-project/src/components/pepertect/pages/reports-page.tsx`
- Replaced local `useState` for date filter with global Zustand store (`dateFilterPreset`, `dateFilterRange`, `setDateFilter`)
- All metrics already used `filteredTrades` correctly - no data filtering fixes needed

### 3. `/home/z/my-project/src/components/pepertect/pages/orders-page.tsx`
- Replaced local `useState` for date filter with global Zustand store
- **Bug fix**: `TradeHistoryTable` checked `trades.length === 0` (unfiltered) for empty state; changed to `filteredTrades.length === 0`
- Improved empty state message: distinguishes "no trades ever" vs "no trades match the selected date filter"

### 4. `/home/z/my-project/src/components/pepertect/pages/portfolio-page.tsx`
- Replaced local `useState` for date filter with global Zustand store
- **Major fix**: Computed values now derived from `filteredPositions` instead of raw `portfolio` API data:
  - `filteredInvestedAmount`, `filteredCurrentValue`, `filteredUnrealizedPnl` via `useMemo`
  - `totalPnl` = `filteredUnrealizedPnl + realizedPnl`
  - `totalValue` = `virtualBalance + filteredCurrentValue`
  - `totalReturn` computed from `totalPnl / initialCapital`
  - `allocationData` uses `filteredCurrentValue` instead of `portfolio.totalCurrentValue`
  - `segmentBreakdown` computed from `filteredPositions` (grouped by segment) instead of `portfolio.segments`
  - Open Positions card shows `filteredPositions.length` instead of `portfolio.openPositionsCount`
- Date filter info banner now shows when filter is active (even if 0 positions match)

## Key Date Fields Used for Filtering
- Reports: `trade.executedAt`
- Orders: `order.placedAt`
- Portfolio: `position.createdAt`
