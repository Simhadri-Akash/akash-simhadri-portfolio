import { count, sql } from "drizzle-orm";
import {
  contactMessagesTable,
  db,
  portfolioVisitorsTable,
} from "@workspace/db";

export type PortfolioStats = {
  visitors: number;
  inquiries: number;
  activeBuilds: number;
};

export interface PortfolioStatsRepository {
  recordVisit(visitorId: string, seenAt: Date): Promise<void>;
  getStats(): Promise<PortfolioStats>;
}

/**
 * Public stats are quoted starting from these baselines rather than zero.
 * Real anonymous-visitor and inquiry activity recorded after deployment is
 * added on top of them. Active Builds is deliberately a fixed, independently
 * configurable number rather than a count derived from the currently visible
 * featured projects.
 *
 * This is the ONLY place the baseline is applied — `getStats` below returns
 * the final public values, and the frontend renders them as-is.
 */
export const PORTFOLIO_STATS_BASELINE = {
  visitors: 35,
  inquiries: 8,
  activeBuilds: 9,
} as const;

export function applyPortfolioStatsBaseline(raw: {
  visitors: number;
  inquiries: number;
}): PortfolioStats {
  return {
    visitors: PORTFOLIO_STATS_BASELINE.visitors + raw.visitors,
    inquiries: PORTFOLIO_STATS_BASELINE.inquiries + raw.inquiries,
    activeBuilds: PORTFOLIO_STATS_BASELINE.activeBuilds,
  };
}

export const databasePortfolioStatsRepository: PortfolioStatsRepository = {
  async recordVisit(visitorId, seenAt) {
    await db
      .insert(portfolioVisitorsTable)
      .values({ visitorId, firstSeenAt: seenAt, lastSeenAt: seenAt })
      .onConflictDoUpdate({
        target: portfolioVisitorsTable.visitorId,
        set: {
          lastSeenAt: seenAt,
          visitCount: sql`${portfolioVisitorsTable.visitCount} + 1`,
        },
      });
  },

  async getStats() {
    const [[visitorResult], [inquiryResult]] = await Promise.all([
      db.select({ value: count() }).from(portfolioVisitorsTable),
      db.select({ value: count() }).from(contactMessagesTable),
    ]);

    return applyPortfolioStatsBaseline({
      visitors: visitorResult?.value ?? 0,
      inquiries: inquiryResult?.value ?? 0,
    });
  },
};
