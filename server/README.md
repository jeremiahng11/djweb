# Doodle Jump — Leaderboard API

Tiny backend that stores global high scores for the game. **Node + Fastify + Drizzle + Postgres.**

## What it is
A stateless HTTP service with two endpoints + a health check. One `scores` table. The game posts a score at
game-over and reads the top N for the "global" tab on the scores screen.

## Endpoints
| Method | Path                       | Body / Query                                  | Returns |
|--------|----------------------------|-----------------------------------------------|---------|
| GET    | `/health`                  | —                                             | `{ ok: true }` |
| POST   | `/api/scores`              | `{ name: string(1-24), score: int, theme? }`  | `201 { ok: true }` |
| GET    | `/api/scores/top`          | `?limit=1..100 (def 10) & theme?`             | `{ scores: [{ name, score, theme, createdAt }] }` |

Rate-limited to 60 req/min per IP. Scores are capped at 5,000,000 (basic anti-cheat).

## Run locally
```bash
cd server
cp .env.example .env          # edit DATABASE_URL if needed
docker compose up             # starts Postgres + the API on :3001
# or, against your own Postgres:
npm install && npm run dev
```
Test:
```bash
curl -XPOST localhost:3001/api/scores -H 'content-type: application/json' -d '{"name":"Doodler","score":1234}'
curl localhost:3001/api/scores/top
```

## Deploy on Coolify (same domain as the game — recommended)
Serve the API under a path on the game's domain (e.g. `djweb.jeremiah.sg/djapi`) so it's same-origin (no CORS)
and the game stays a separate, always-up static app.

1. Create a **PostgreSQL** service. Copy its internal connection URL.
2. New **Application** → this repo, **Base directory** `server`, build with the included `Dockerfile`.
3. Env: `DATABASE_URL=<postgres internal url>`, `PORT=3001`. Expose port **3001**.
4. **Domains**: set the app's domain to `https://djweb.jeremiah.sg/djapi` (same host as the game, a `/djapi` path).
5. Deploy, then test which way the proxy forwards the path:
   - `curl https://djweb.jeremiah.sg/djapi/api/scores/top`
   - Returns `{"scores":[...]}` → done (proxy strips the prefix; keep `BASE_PATH` unset).
   - Returns 404 → the proxy keeps the prefix → set env **`BASE_PATH=/djapi`** and redeploy.
6. In the game, `window.DJ_API_URL` is `/djapi` (relative, same-origin) — no further game change needed.

The `scores` table is created automatically on first boot.

## Env vars
- `DATABASE_URL` — Postgres connection string (required)
- `PORT` — listen port (default 3001)
- `CORS_ORIGIN` — comma-separated allowed origins (default: any)

## License
MIT
