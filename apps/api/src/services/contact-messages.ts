import { db, contactMessagesTable } from "@workspace/db";

export type ContactMessageRecord = {
  name: string;
  email: string;
  subject: string;
  message: string;
  receivedAt: Date;
};

export interface ContactMessageRepository {
  save(message: ContactMessageRecord): Promise<void>;
}

export const databaseContactMessageRepository: ContactMessageRepository = {
  async save(message) {
    await db.insert(contactMessagesTable).values({
      name: message.name,
      email: message.email,
      subject: message.subject,
      message: message.message,
      createdAt: message.receivedAt,
    });
  },
};
