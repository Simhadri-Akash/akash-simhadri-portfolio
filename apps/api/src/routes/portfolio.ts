import { Router, type IRouter } from "express";
import { RecordPortfolioVisitBody } from "@workspace/api-zod";
import { logger } from "../lib/logger";
import { portfolioVisitRateLimiter } from "../middlewares/rate-limit";
import {
  databasePortfolioStatsRepository,
  type PortfolioStatsRepository,
} from "../services/portfolio-stats";

type PortfolioRouteDependencies = {
  repository?: PortfolioStatsRepository;
  now?: () => Date;
};

export function createPortfolioRouter({
  repository = databasePortfolioStatsRepository,
  now = () => new Date(),
}: PortfolioRouteDependencies = {}): IRouter {
  const router: IRouter = Router();

  router.get("/portfolio/stats", async (_req, res) => {
    try {
      res.status(200).json(await repository.getStats());
    } catch (error) {
      logger.warn(
        { statsErrorName: error instanceof Error ? error.name : "UnknownError" },
        "Portfolio statistics unavailable",
      );
      res.status(503).json({ error: "Portfolio statistics are temporarily unavailable." });
    }
  });

  router.post("/portfolio/visit", portfolioVisitRateLimiter, async (req, res) => {
    const parsed = RecordPortfolioVisitBody.strict().safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Please check the submitted fields." });
      return;
    }

    try {
      await repository.recordVisit(parsed.data.visitorId, now());
      res.status(204).send();
    } catch (error) {
      logger.warn(
        { visitErrorName: error instanceof Error ? error.name : "UnknownError" },
        "Portfolio visit could not be recorded",
      );
      res.status(503).json({ error: "Portfolio statistics are temporarily unavailable." });
    }
  });

  return router;
}

export default createPortfolioRouter();
