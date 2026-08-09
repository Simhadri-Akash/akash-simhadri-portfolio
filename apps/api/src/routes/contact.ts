import { Router, type IRouter } from "express";
import { SubmitContactBody } from "@workspace/api-zod";
import { logger } from "../lib/logger";
import { trimStringFields } from "../lib/normalize-input";
import { contactRateLimiter } from "../middlewares/rate-limit";
import {
  databaseContactMessageRepository,
  type ContactMessageRecord,
  type ContactMessageRepository,
} from "../services/contact-messages";
import { sendContactNotification } from "../services/contact-notification";

type ContactRouteDependencies = {
  repository?: ContactMessageRepository;
  notify?: (message: ContactMessageRecord) => Promise<unknown>;
};

export function createContactRouter({
  repository = databaseContactMessageRepository,
  notify = sendContactNotification,
}: ContactRouteDependencies = {}): IRouter {
  const router: IRouter = Router();

  router.post("/contact", contactRateLimiter, async (req, res, next) => {
    try {
      const normalized = trimStringFields(req.body, [
        "name",
        "email",
        "subject",
        "message",
      ]);
      const parsed = SubmitContactBody.safeParse(normalized);

      if (!parsed.success || /[\r\n]/.test(parsed.data.subject)) {
        res.status(400).json({ error: "Please check the submitted fields." });
        return;
      }

      const contactMessage: ContactMessageRecord = {
        ...parsed.data,
        receivedAt: new Date(),
      };

      await repository.save(contactMessage);

      try {
        await notify(contactMessage);
      } catch (error) {
        logger.warn(
          {
            notificationErrorName:
              error instanceof Error ? error.name : "UnknownError",
          },
          "Contact message persisted but notification failed",
        );
      }

      res.status(201).json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export default createContactRouter();
