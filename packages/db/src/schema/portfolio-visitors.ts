import { integer, pgTable, serial, timestamp, uuid } from "drizzle-orm/pg-core";

export const portfolioVisitorsTable = pgTable("portfolio_visitors", {
  id: serial("id").primaryKey(),
  visitorId: uuid("visitor_id").notNull().unique(),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  visitCount: integer("visit_count").default(1).notNull(),
});

export type PortfolioVisitor = typeof portfolioVisitorsTable.$inferSelect;
