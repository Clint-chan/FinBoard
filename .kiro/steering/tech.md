# Tech Stack

## Frontend
- Vanilla HTML/CSS/JavaScript (zero dependencies, no build step)
- ES6 modules for code organization
- CSS custom properties for theming
- Responsive design with mobile-first approach

## Backend (Optional)
- Cloudflare Workers for API
- Cloudflare KV for data storage

## Hosting
- Cloudflare Pages (static frontend)
- Cloudflare Workers (API backend)

## Key Libraries/APIs
- Google Fonts (Inter)
- Tencent Finance JSONP API for quotes
- Sina Finance JSONP API for search/charts
- Web Crypto API for password hashing
- Service Worker for offline caching

## Common Commands

```bash
# Deploy frontend to Cloudflare Pages
npm run deploy
# or
npx wrangler pages deploy . --project-name=stock-board

# Deploy Worker API (from worker/ directory)
cd worker
npx wrangler deploy

# Create KV namespace for cloud sync
npx wrangler kv namespace create CONFIG_KV
```

## Code Style
- No build tools or transpilation
- Native ES6 modules with explicit imports
- Single HTML file with embedded CSS
- Modular JS files by responsibility
- Chinese comments and UI text
- localStorage for client-side persistence
