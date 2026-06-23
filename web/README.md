# Diamond — MLB Stats Platform

A top-tier, full-featured web app for exploring the public **MLB Stats API**
(`statsapi.mlb.com`). Built with Vite + React + TypeScript + Tailwind +
TanStack Query + Recharts.

## Features

- **Scoreboard** — live & scheduled games with auto-refresh, date picker, linescores, probable pitchers.
- **Standings** — division standings by league, season selectable.
- **Teams** — every club, with logos, league/division, and a detail view containing roster + season stats.
- **Player profile** — headshot, bio, career totals, year-by-year table, AVG/ERA trend chart.
- **Game detail** — live linescore, batter/pitcher boxscores, play-by-play (auto-refreshing).
- **Stat Leaders** — hitting & pitching leaders for any season, with category switcher.
- **API Explorer** — a dynamic UI that lets you call every endpoint the MLB Stats API exposes (path + query params, raw JSON viewer, copy button, open-in-tab link).
- **Player search** in the header.

## Layout

- `web/` — the Vite + React web app (and the DiamondGPT Node/Genkit backend).
- `cli/` — the Go terminal app (`baseball`).

## Run the web app

```bash
cd web
npm install
npm run dev        # frontend only (http://localhost:5173)
npm run dev:server # DiamondGPT backend (http://localhost:8080)
```

For DiamondGPT you can paste a provider API key in the UI, or set one of
`GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` for the server.

## Notes

The MLB Stats API is **public** and CORS-friendly — no API key is required.
This project is not affiliated with MLB. All data © MLB Advanced Media.
