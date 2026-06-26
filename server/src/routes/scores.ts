import type { FastifyInstance } from "fastify";
import { eq, sql } from "drizzle-orm";
import { db, scores } from "../db.js";

const MAX_SCORE = 5_000_000; // sanity cap (basic anti-cheat; real validation can come later)

export async function scoreRoutes(app: FastifyInstance): Promise<void> {
  // Submit a score
  app.post(
    "/api/scores",
    {
      schema: {
        body: {
          type: "object",
          required: ["name", "score"],
          additionalProperties: false,
          properties: {
            name: { type: "string", minLength: 1, maxLength: 24 },
            score: { type: "integer", minimum: 0, maximum: MAX_SCORE },
            theme: { type: "string", maxLength: 24 },
          },
        },
      },
    },
    async (req, reply) => {
      const { name, score, theme } = req.body as { name: string; score: number; theme?: string };
      const cleanName = name.trim().slice(0, 24) || "unnamed";
      await db.insert(scores).values({ name: cleanName, score, theme: theme || "space" });
      return reply.code(201).send({ ok: true });
    }
  );

  // Top scores (optionally filtered by theme)
  app.get(
    "/api/scores/top",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
            theme: { type: "string", maxLength: 24 },
          },
        },
      },
    },
    async (req) => {
      const { limit = 10, theme } = req.query as { limit?: number; theme?: string };
      // best score per player (one row per name), highest first
      const rows = await db
        .select({ name: scores.name, score: sql<number>`max(${scores.score})`.mapWith(Number) })
        .from(scores)
        .where(theme ? eq(scores.theme, theme) : undefined)
        .groupBy(scores.name)
        .orderBy(sql`max(${scores.score}) desc`)
        .limit(limit);
      return { scores: rows };
    }
  );
}
