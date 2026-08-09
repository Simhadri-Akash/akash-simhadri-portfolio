import { closeDatabase } from "@workspace/db";
import app from "./app";
import { logger } from "./lib/logger";
import { createShutdownHandler } from "./lib/shutdown";

// Most hosting providers inject PORT automatically; 8080 is a sensible
// fallback for local development so `pnpm --filter @workspace/api-server dev`
// works without extra setup.
const rawPort = process.env["PORT"] ?? "8080";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, () => {
  logger.info({ port }, "Server listening");
});

server.on("error", (err) => {
  logger.error({ err }, "Error listening on port");
  process.exitCode = 1;
});

const shutdown = createShutdownHandler({ server, closeDatabase });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void shutdown(signal);
  });
}
