import { Resend } from "resend";
import type { ContactMessageRecord } from "./contact-messages";

type NotificationConfig = {
  apiKey: string;
  to: string;
  from: string;
};

function getOptionalEnvironmentValue(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function assertSafeHeaderValue(name: string, value: string): void {
  if (/[\r\n]/.test(value)) {
    throw new Error(`${name} must not contain line breaks.`);
  }
}

function readNotificationConfig(): NotificationConfig | null {
  const apiKey = getOptionalEnvironmentValue("RESEND_API_KEY");
  const to = getOptionalEnvironmentValue("CONTACT_TO_EMAIL");
  const from = getOptionalEnvironmentValue("CONTACT_FROM_EMAIL");

  if (!apiKey && !to && !from) return null;

  if (!apiKey || !to || !from) {
    throw new Error(
      "RESEND_API_KEY, CONTACT_TO_EMAIL, and CONTACT_FROM_EMAIL must be configured together.",
    );
  }

  assertSafeHeaderValue("CONTACT_TO_EMAIL", to);
  assertSafeHeaderValue("CONTACT_FROM_EMAIL", from);

  return { apiKey, to, from };
}

const notificationConfig = readNotificationConfig();
let resendClient: Resend | null = null;

export async function sendContactNotification(
  message: ContactMessageRecord,
): Promise<"sent" | "skipped"> {
  if (!notificationConfig) return "skipped";

  resendClient ??= new Resend(notificationConfig.apiKey);

  const result = await resendClient.emails.send({
    from: notificationConfig.from,
    to: notificationConfig.to,
    replyTo: message.email,
    subject: `Portfolio contact: ${message.subject}`,
    text: [
      `Name: ${message.name}`,
      `Email: ${message.email}`,
      `Subject: ${message.subject}`,
      `Received: ${message.receivedAt.toISOString()}`,
      "",
      "Message:",
      message.message,
    ].join("\n"),
  });

  if (result.error) {
    throw new Error("Contact notification provider rejected the request.");
  }

  return "sent";
}
