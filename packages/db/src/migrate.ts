import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { closeDatabase, db } from "./index";

async function run(): Promise<void> {
  try {
    await migrate(db, {
      migrationsFolder: path.resolve(import.meta.dirname, "../drizzle"),
    });
    console.log("Database migrations applied successfully.");
  } finally {
    await closeDatabase();
  }
}

run().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Database migration failed.",
  );
  process.exitCode = 1;
});
