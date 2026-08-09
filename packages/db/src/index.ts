import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

let closePromise: Promise<void> | null = null;

export function closeDatabase(): Promise<void> {
  closePromise ??= pool.end();
  return closePromise;
}

export async function checkDatabaseReadiness(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("select 1");
  } finally {
    client.release();
  }
}

export * from "./schema";
