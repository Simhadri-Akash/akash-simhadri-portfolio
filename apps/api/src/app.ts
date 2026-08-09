import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { corsOptions } from "./middlewares/cors";
import { errorHandler, notFoundHandler } from "./middlewares/errors";

function getTrustProxySetting(): number | "loopback" {
  if (process.env.NODE_ENV !== "production") return "loopback";

  const rawHops = process.env.TRUST_PROXY_HOPS ?? "1";
  const hops = Number(rawHops);

  if (!Number.isInteger(hops) || hops < 1) {
    throw new Error("TRUST_PROXY_HOPS must be a positive integer.");
  }

  return hops;
}

export function createApp(apiRouter = router): Express {
  const app: Express = express();

  // A reverse proxy sits in front of the API in production. Trust only the
  // nearest configured number of proxy hops instead of trusting arbitrary
  // forwarded IPs.
  app.set("trust proxy", getTrustProxySetting());

  app.use(
    pinoHttp({
      logger,
      serializers: {
        req(req) {
          return {
            id: req.id,
            method: req.method,
            url: req.url?.split("?")[0],
          };
        },
        res(res) {
          return {
            statusCode: res.statusCode,
          };
        },
      },
    }),
  );
  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use("/api", apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp();
