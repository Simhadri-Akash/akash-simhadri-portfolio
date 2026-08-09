import type { ErrorRequestHandler, RequestHandler } from "express";
import { logger } from "../lib/logger";

type HttpError = Error & {
  status?: number;
  statusCode?: number;
  type?: string;
};

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "Not found." });
};

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const httpError = error as HttpError;
  const status = httpError.status ?? httpError.statusCode;

  if (status === 400 && httpError.type === "entity.parse.failed") {
    res.status(400).json({ error: "Invalid JSON payload." });
    return;
  }

  if (status === 413) {
    res.status(413).json({ error: "Request payload is too large." });
    return;
  }

  logger.error({ err: error, requestId: req.id }, "Unhandled API error");
  res.status(500).json({ error: "Internal server error." });
};
