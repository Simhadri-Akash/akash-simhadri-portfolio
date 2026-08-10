import { Router, type IRouter } from "express";
import { SendChatMessageBody } from "@workspace/api-zod";
import { trimStringFields } from "../lib/normalize-input";
import { logger } from "../lib/logger";
import { chatRateLimiter } from "../middlewares/rate-limit";
import {
  buildConfiguredChatProvider,
  classifyProviderFailure,
  ProviderTimeoutError,
  safeProviderErrorDetails,
  type ChatProvider,
} from "../services/chat-provider";
import {
  localAnswer,
  parseProviderOutput,
  toPublicChatResult,
} from "../services/portfolio-chat";

const DEFAULT_PROVIDER_TIMEOUT_MS = 20_000;
const UNSAFE_CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

export interface ChatRouterOptions {
  provider?: ChatProvider | null;
  timeoutMs?: number;
}

async function requestWithTimeout(
  provider: ChatProvider,
  message: string,
  timeoutMs: number,
): Promise<string> {
  const controller = new AbortController();
  let timeout: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new ProviderTimeoutError());
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      provider.complete(message, controller.signal),
      timeoutPromise,
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function createChatRouter(options: ChatRouterOptions = {}): IRouter {
  const configured =
    options.provider === undefined
      ? buildConfiguredChatProvider()
      : {
          provider: options.provider,
          providerName: options.provider?.name ?? "local",
          unavailableReason: options.provider ? undefined : "unconfigured",
        };
  const timeoutMs = options.timeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS;
  const router: IRouter = Router();

  router.post("/chat", chatRateLimiter, async (req, res) => {
    const normalized = trimStringFields(req.body, ["message"]);
    const parsed = SendChatMessageBody.safeParse(normalized);
    if (!parsed.success || UNSAFE_CONTROL_CHARACTERS.test(parsed.data.message)) {
      res.status(400).json({ error: "Please check the submitted fields." });
      return;
    }

    const { message } = parsed.data;
    const fallback = () => res.json(toPublicChatResult(localAnswer(message)));

    if (!configured.provider) {
      logger.info(
        {
          provider: configured.providerName,
          reason: configured.unavailableReason,
        },
        "Chat fallback activated",
      );
      fallback();
      return;
    }

    try {
      const raw = await requestWithTimeout(
        configured.provider,
        message,
        timeoutMs,
      );
      const result = parseProviderOutput(raw);

      if (!result.success) {
        logger.warn(
          { provider: configured.providerName, category: "invalid_output" },
          "Chat provider output validation failed; using fallback",
        );
        fallback();
        return;
      }

      res.json(toPublicChatResult(result.data));
    } catch (error) {
      logger.warn(
        {
          provider: configured.providerName,
          category: classifyProviderFailure(error),
          ...safeProviderErrorDetails(error),
        },
        "Chat provider request failed; using fallback",
      );
      fallback();
    }
  });

  return router;
}

export default createChatRouter();
