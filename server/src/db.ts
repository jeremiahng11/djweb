import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { pgTable, serial, varchar, integer, timestamp, index } from "drizzle-orm/pg-core";

// --- schema -------------------------------------------------------------
export const scores = pgTable(
  "scores",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 24 }).notNull(),
    score: integer("score").notNull(),
    theme: varchar("theme", { length: 24 }).notNull().default("space"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ scoreIdx: index("scores_score_idx").on(t.score) })
);

// --- connection ---------------------------------------------------------
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const queryClient = postgres(url, { max: 10 });
export const db = drizzle(queryClient, { schema: { scores } });

// Create the table on boot (single table -> simpler than a migration step for Coolify deploys).
export async function ensureSchema(): Promise<void> {
  await queryClient/* sql */`
    CREATE TABLE IF NOT EXISTS scores (
      id          serial PRIMARY KEY,
      name        varchar(24) NOT NULL,
      score       integer NOT NULL,
      theme       varchar(24) NOT NULL DEFAULT 'space',
      created_at  timestamptz NOT NULL DEFAULT now()
    );
  `;
  await queryClient/* sql */`CREATE INDEX IF NOT EXISTS scores_score_idx ON scores (score);`;
}
