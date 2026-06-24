# Contributing to Diamond

Thanks for your interest in contributing! Diamond is a monorepo with three parts:

- **[`cli/`](cli/)** — the Go terminal app (`diamond`), built with Bubble Tea.
- **[`web/`](web/)** — the Vite + React web app with a Genkit (Node) backend.
- **[`site/`](site/)** — the Astro landing page (deployed to GitHub Pages).

## Prerequisites

- **Go** 1.26+ (for `cli/`)
- **Node** 24+ (for `web/` and `site/`)
- **Docker** (optional, for building images)

No API key is required for MLB data — the MLB Stats API is public. DiamondGPT
features need a provider key (Gemini / Anthropic / OpenAI); see the README.

## Local development

```bash
# CLI
cd cli && go build -o diamond . && ./diamond

# Web app (frontend + DiamondGPT backend)
cd web && npm install
npm run dev          # http://localhost:5173
npm run dev:server   # DiamondGPT API on :8080

# Landing site
cd site && npm install && npm run dev   # http://localhost:4321
```

## Tests & checks

```bash
cd cli && go build ./... && go vet ./... && go test ./...
cd web && npm run lint && npm test
cd site && npm run build
```

Please make sure the relevant checks pass before opening a PR.

## Commit messages — Conventional Commits (required)

Releases are automated with **semantic-release**, so commit messages **must**
follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat: …` → minor release
- `fix: …` → patch release
- `feat!: …` or a `BREAKING CHANGE:` footer → major release
- `build:`, `ci:`, `docs:`, `chore:`, `refactor:`, `test:` → no release

Scope is encouraged, e.g. `feat(cli): add pitch scatter to the player view`.
Dependency bumps use `build(deps): …` so they don't trigger a release.

## Pull requests

1. Branch off `main`.
2. Keep PRs focused; update docs when behavior changes.
3. Ensure builds/tests pass.
4. Use a Conventional Commit style PR title — it becomes the squash-merge subject
   and feeds the changelog.

## Code style

Match the surrounding code. Go is formatted with `gofmt`; the web/site use the
existing ESLint/Prettier setup. Keep files focused and small.

By contributing, you agree your contributions are licensed under the repository's
[MIT License](LICENSE).
