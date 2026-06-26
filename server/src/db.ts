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

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 24 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- connection ---------------------------------------------------------
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const queryClient = postgres(url, { max: 10 });
export const db = drizzle(queryClient, { schema: { scores, users } });

// Create the tables on boot (simpler than a migration step for Coolify deploys).
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
  await queryClient/* sql */`
    CREATE TABLE IF NOT EXISTS users (
      id          serial PRIMARY KEY,
      username    varchar(24) NOT NULL,
      created_at  timestamptz NOT NULL DEFAULT now()
    );
  `;
  // case-insensitive uniqueness so "Doodler" and "doodler" are the same account
  await queryClient/* sql */`CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users (lower(username));`;
}

// Passwordless "login": create the username if it doesn't exist, return the canonical row. Race-safe.
export async function loginUser(username: string): Promise<{ id: number; username: string }> {
  const u = username.trim().slice(0, 24);
  await queryClient/* sql */`INSERT INTO users (username) VALUES (${u}) ON CONFLICT (lower(username)) DO NOTHING`;
  const rows = await queryClient<{ id: number; username: string }[]>/* sql */`
    SELECT id, username FROM users WHERE lower(username) = lower(${u}) LIMIT 1
  `;
  return rows[0]!;
}
