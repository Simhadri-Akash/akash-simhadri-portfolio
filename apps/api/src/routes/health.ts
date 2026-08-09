import { Router, type IRouter } from "express";
import { HealthCheckResponse, ReadinessCheckResponse } from "@workspace/api-zod";
import { checkDatabaseReadiness } from "@workspace/db";
import { logger } from "../lib/logger";

export type ReadinessCheck = () => Promise<void>;

export function createHealthRouter(
  readinessCheck: ReadinessCheck = checkDatabaseReadiness,
): IRouter {
  const router: IRouter = Router();

  router.get("/healthz", (_req, res) => {
    const data = HealthCheckResponse.parse({ status: "ok" });
    res.json(data);
  });

  router.get("/readyz", async (_req, res) => {
    try {
      await readinessCheck();
      const data = ReadinessCheckResponse.parse({ status: "ready" });
      res.json(data);
    } catch (error) {
      logger.warn(
        { errorName: error instanceof Error ? error.name : "UnknownError" },
        "Readiness check failed",
      );
      const data = ReadinessCheckResponse.parse({ status: "not_ready" });
      res.status(503).json(data);
    }
  });

  return router;
}

export default createHealthRouter();
