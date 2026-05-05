# AEO Diagnostic Frontend

This is a Vite + React SPA that provides an ultra-premium, "21st.dev inspired" glassmorphism interface for the Answer Engine Optimization tool.

## Key UX Features
- **Framer Motion**: Smooth, synchronized entry animations for data-heavy dashboard components.
- **Optimized Tables**: The Leaderboard component implements real-time client-side search and multi-column sorting without re-fetching data.
- **URL Parameter Sync**: Searches automatically push `?q=...&brand=...` to the URL history, allowing users to easily share deep links to specific diagnostic reports.
- **Graceful Error Handling**: Complete with React `ErrorBoundary` wrappers around complex data-viz components, preventing full-page crashes if the backend returns malformed data.
- **Developer Ergonomics**: A dedicated "JSON Export" button allows engineers to quickly download the raw API payload for prompt debugging without opening Chrome DevTools.

## Tech Stack
- **Framework**: React 18 (Vite)
- **Styling**: Vanilla CSS with modern custom properties (CSS variables) for strict design token management.
- **Icons**: `lucide-react`
- **Animations**: `framer-motion`

## Running Locally
```bash
npm install
npm run dev
```
