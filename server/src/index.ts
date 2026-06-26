import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { ensureSchema } from "./db.js";
import { scoreRoutes } from "./routes/scores.js";

const app = Fastify({ logger: true });

// CORS: set CORS_ORIGIN (comma-separated) in prod (your game's URL); defaults to open for a public leaderboard.
await app.register(cors, {
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim()) : true,
});
await app.register(rateLimit, { max: 60, timeWindow: "1 minute" });

// BASE_PATH lets the API live under a sub-path (e.g. "/djapi") when the proxy forwards the prefix
// without stripping it. Leave unset when the API has its own domain (or the proxy strips the prefix).
const basePath = process.env.BASE_PATH || "";
app.get("/health", async () => ({ ok: true })); // unprefixed: container/internal healthcheck
if (basePath) app.get(basePath + "/health", async () => ({ ok: true })); // public healthcheck under the base path
await app.register(scoreRoutes, { prefix: basePath });

const port = Number(process.env.PORT) || 3001;
try {
  await ensureSchema();
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`Leaderboard API listening on :${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
