# Hallucinated Web Cache

Two-process setup:

- `src/generator.js`: pre-generates **standalone HTML documents** (inline CSS + inline JS, no backend dependencies inside the page) and stores them in `cache/pages/*.json`.
- `src/server.js`: serves a random cached HTML page on `/` instantly.

Each browser refresh hits a random pre-generated hallucinated webpage.

## Setup

```bash
npm install
cp .env.example .env
```

Set `OPENROUTER_API_KEY` in `.env`.

## Run in two terminals

Terminal 1 (generator daemon):

```bash
npm run generate:daemon
```

Terminal 2 (server):

```bash
npm run serve
```

Open `http://localhost:3000` and refresh repeatedly.

## Commands

One-time generation batch:

```bash
npm run generate -- --count 20 --concurrency 2 --chaos 0.95
```

Strict real-OpenRouter run (no local fallback allowed):

```bash
npm run generate -- --count 20 --concurrency 2 --chaos 0.95 --strict-openrouter
```

Daemon with custom cache tuning:

```bash
npm run generate:daemon -- --target-size 200 --batch-size 8 --concurrency 3 --interval-ms 4000 --chaos 0.95
```

## Entropy controls

- `--chaos 0..1` (or `CHAOS_LEVEL` env var) controls prompt mutation intensity and sampling aggression.
- Generator injects entropy capsules (nonce/hash/time jitter/style laws/artifacts/taboo words) to push outputs into new creative regions.
- `--strict-openrouter` (or `OPENROUTER_STRICT=1`) disables fallback and exits on any OpenRouter failure.

## Notes

- Generated pages are self-contained HTML/CSS/JS and should not call network APIs.
- If OpenRouter fails or key/model is invalid, generator falls back to locally generated self-contained hallucination pages unless strict mode is enabled.
- Debug endpoint: `GET /api/stats`
- Fetch a specific cached page by id: `GET /page/:id`
