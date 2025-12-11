# Design Document

## Overview

This design document outlines the technical approach for enhancing the Market Board application. The enhancements are organized into three categories: UI/UX improvements, code structure refactoring, and stability/performance optimizations.

## Architecture

The application follows a single-page architecture with:
- **View Layer**: HTML table with dynamic rendering
- **State Management**: Simple object-based state (`app.config`, `app.stockData`)
- **Data Layer**: JSONP-based API calls to Tencent/Sina financial data services

## Components and Interfaces

### 1. Enhanced App Object Structure

```javascript
const app = {
  // Configuration
  config: { codes: [], interval: 5 },
  
  // State
  stockData: {},           // Current stock data
  prevPrices: {},          // Previous prices for change detection
  tempCodes: [],           // Temporary codes during settings edit
  
  // Control flags
  loadingId: 0,            // Race condition prevention
  timer: null,             // Refresh timer
  searchTimer: null,       // Search debounce timer
  tooltipTimer: null,      // Tooltip delay timer
  
  // Sorting state
  sortColumn: null,        // Current sort column: 'pct' | 'amt' | 'price'
  sortAsc: false,          // Sort direction
  
  // Cached DOM elements
  $: {
    stockList: null,
    statusDot: null,
    statusText: null,
    lastUpdate: null,
    stockCount: null,
    chartTooltip: null,
    chartImg: null,
    settingsModal: null,
    searchInput: null,
    searchResults: null,
    selectedStocks: null,
    inputInterval: null,
    manualCodeInput: null
  }
};
```

### 2. New Utility Functions

```javascript
// Safe float parsing
safeFloat(value, fallback = 0) → number

// Sort comparator
compareStocks(a, b, column, ascending) → number
```

### 3. Modified Functions

| Function | Changes |
|----------|---------|
| `init()` | Add DOM caching, remove inline event setup |
| `initEvents()` | Add button event listeners, tooltip delay logic |
| `fetchData()` | Add loadingId check for race conditions |
| `fetchQuotes()` | Use safeFloat, proper reject on error |
| `searchStock()` | Add error handling, cleanup global var |
| `render()` | Add price change detection, sorting support |
| `showChart()` | Add 200ms delay |

## Data Models

### Stock Data Object
```javascript
{
  name: string,
  price: number,
  preClose: number,
  open: number,
  vol: number,
  high: number,
  low: number,
  amt: number
}
```

### Sort State
```javascript
{
  sortColumn: 'pct' | 'amt' | 'price' | null,
  sortAsc: boolean
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Sort Order Correctness
*For any* array of stock data and any sortable column (pct, amt, price), after sorting, each element should be greater than or equal to (descending) or less than or equal to (ascending) the next element in that column's value.
**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: Price Change Detection
*For any* stock with a previous price and a new price, if the prices differ, the system should mark that stock for highlight animation.
**Validates: Requirements 2.1**

### Property 3: Safe Float Parsing
*For any* input value (including undefined, null, NaN, empty string, or valid number string), safeFloat should return a finite number (the parsed value or the fallback).
**Validates: Requirements 7.1, 7.2**

### Property 4: Race Condition Prevention
*For any* sequence of fetch requests with incrementing loadingIds, only the response matching the current loadingId should be processed.
**Validates: Requirements 9.1, 9.2**

### Property 5: Manual Code Normalization
*For any* valid stock code input format (600000, sh600000, 600000.SH), normalizeCode should produce a consistent sh/sz prefixed lowercase code.
**Validates: Requirements 4.2**

## Error Handling

| Scenario | Handling |
|----------|----------|
| JSONP script load failure | Reject promise, show error status |
| Invalid API response data | Use safeFloat fallback values |
| Search API failure | Show "搜索失败" message |
| Race condition (stale response) | Discard response silently |

## Testing Strategy

### Unit Tests
- Test `safeFloat()` with various inputs
- Test `normalizeCode()` with different code formats
- Test sort comparator function

### Property-Based Tests
- Use fast-check library for JavaScript property-based testing
- Generate random stock data arrays and verify sort invariants
- Generate random numeric strings and verify safeFloat behavior
- Generate random loadingId sequences and verify race condition handling

### Integration Tests
- Test full fetch-render cycle
- Test settings save/load cycle
- Test search and add stock flow
