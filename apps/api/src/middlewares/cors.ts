import type { CorsOptions } from "cors";

function getConfiguredOrigin(): string | null {
  const configured = process.env.FRONTEND_ORIGIN?.trim();
  if (!configured) return null;

  try {
    return new URL(configured).origin;
  } catch {
    throw new Error("FRONTEND_ORIGIN must be a valid absolute URL.");
  }
}

const configuredOrigin = getConfiguredOrigin();
const isProduction = process.env.NODE_ENV === "production";

function isLocalDevelopmentOrigin(origin: string): boolean {
  if (isProduction) return false;

  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  } catch {
    return false;
  }
}

export const corsOptions: CorsOptions = {
  credentials: false,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  origin(origin, callback) {
    if (!origin || origin === configuredOrigin || isLocalDevelopmentOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  },
};
