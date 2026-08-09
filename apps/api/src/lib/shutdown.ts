import type { Server } from "node:http";
import { logger } from "./logger";

type ShutdownOptions = {
  server: Server;
  closeDatabase: () => Promise<void>;
  timeoutMs?: number;
  exit?: (code: number) => void;
};

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

export function createShutdownHandler({
  server,
  closeDatabase,
  timeoutMs = 10_000,
  exit = (code) => process.exit(code),
}: ShutdownOptions): (signal: NodeJS.Signals) => Promise<void> {
  let shutdownPromise: Promise<void> | null = null;

  return (signal) => {
    shutdownPromise ??= (async () => {
      logger.info({ signal }, "Graceful shutdown started");

      const forceTimer = setTimeout(() => {
        logger.error({ signal }, "Graceful shutdown timed out");
        server.closeAllConnections?.();
        exit(1);
      }, timeoutMs);
      forceTimer.unref();

      try {
        await closeServer(server);
        await closeDatabase();
        clearTimeout(forceTimer);
        logger.info({ signal }, "Graceful shutdown completed");
        exit(0);
      } catch (error) {
        clearTimeout(forceTimer);
        logger.error({ err: error, signal }, "Graceful shutdown failed");
        exit(1);
      }
    })();

    return shutdownPromise;
  };
}
