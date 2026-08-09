import { rateLimit } from "express-rate-limit";

const windowMs = 15 * 60 * 1000;
const message = { error: "Too many requests. Please try again later." };

function createLimiter(limit: number) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message,
  });
}

export const contactRateLimiter = createLimiter(5);
export const chatRateLimiter = createLimiter(20);
export const portfolioVisitRateLimiter = createLimiter(30);
