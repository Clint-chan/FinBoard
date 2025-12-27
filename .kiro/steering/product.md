使用ACEMCP，而不是Searched workspace（必须）
# Market Board - Product Overview

Real-time stock monitoring dashboard for Chinese A-shares and ETFs.

## Core Features
- Real-time quotes with configurable auto-refresh
- Price alerts with browser notifications
- Portfolio cost tracking with P&L display
- Drag-and-drop stock ordering
- Dark/light theme (auto/manual)
- Cloud sync for cross-device configuration
- Boss key (Esc) to hide interface
- PWA support for desktop/mobile installation

## Target Users
Individual investors monitoring Chinese stock market (A-shares, ETFs).

## Data Sources
- Real-time quotes: Tencent Finance API
- Stock search: Sina Finance API
- Intraday charts: Eastmoney Finance API (Canvas rendering)

## Deployment
Hosted on Cloudflare Pages with optional Cloudflare Workers backend for cloud sync.
