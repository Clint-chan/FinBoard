# Project Structure

```
├── index.html          # Main page (single file with all CSS)
├── js/
│   ├── app.js          # Entry point, event bindings, drag-sort
│   ├── config.js       # Configuration constants (API URLs, defaults)
│   ├── state.js        # State management, localStorage persistence
│   ├── dataService.js  # Quote APIs, search, cloud sync calls
│   ├── chartService.js # Intraday chart data service (Eastmoney API)
│   ├── intradayChart.js # Canvas-based intraday chart component
│   ├── view.js         # DOM rendering, theme switching
│   └── utils.js        # Utility functions, notifications
├── manifest.json       # PWA manifest
├── sw.js               # Service Worker for offline caching
├── worker/
│   ├── index.js        # Cloudflare Worker API (auth + config sync)
│   └── wrangler.toml   # Worker deployment config
├── wrangler.jsonc      # Pages deployment config
└── package.json        # npm scripts (deploy only)
```

## Module Responsibilities

| File | Purpose |
|------|---------|
| `app.js` | Application initialization, event handlers, drag-sort logic |
| `config.js` | API endpoints, default configuration values |
| `state.js` | Centralized state object, localStorage read/write |
| `dataService.js` | External API calls (quotes, search, cloud sync) |
| `chartService.js` | Intraday chart data fetching from Eastmoney API |
| `intradayChart.js` | Canvas-based intraday chart rendering component |
| `view.js` | DOM manipulation, rendering, theme management |
| `utils.js` | Helper functions, notification permissions |
| `worker/index.js` | Backend API: auth, config storage via KV |

## Conventions
- All frontend JS uses ES6 module syntax
- State is centralized in `state.js` and imported where needed
- DOM elements cached in `view.js` via `$` object
- JSONP pattern used for cross-origin stock data APIs
- Worker uses Cloudflare KV with `user:` and `config:` key prefixes
