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

## Deploy on Coolify
1. Create a **PostgreSQL** service. Copy its internal connection URL.
2. New **Application** → point at this repo, **Base directory** `server`, build with the included `Dockerfile`.
3. Env vars: `DATABASE_URL=<postgres internal url>`, `PORT=3001`, and `CORS_ORIGIN=<your game URL>`.
4. Expose port **3001**. The table is created automatically on first boot.

## Env vars
- `DATABASE_URL` — Postgres connection string (required)
- `PORT` — listen port (default 3001)
- `CORS_ORIGIN` — comma-separated allowed origins (default: any)

## License
MIT
