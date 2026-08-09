export type PortfolioStatsResponse = {
  visitors: number;
  inquiries: number;
  activeBuilds: number;
};

/**
 * Known public baseline, mirroring the backend's `PORTFOLIO_STATS_BASELINE`
 * (see the API's portfolio-stats service). Used as the initial display state
 * and as the fallback whenever the API hasn't given us a real, valid
 * response yet — the strip must never show "—" or be blank.
 */
export const PORTFOLIO_STATS_FALLBACK: PortfolioStatsResponse = {
  visitors: 35,
  inquiries: 8,
  activeBuilds: 9,
};

/**
 * A truthy `data` value from the query client is not proof of a real API
 * response — react-query's fetch layer infers "text" for any non-JSON
 * content type (e.g. `text/html`) and resolves successfully with that raw
 * string instead of throwing. That happens in this very workspace: hitting
 * the portfolio's Vite dev server directly, with no API process behind
 * `/api`, returns Vite's SPA-fallback `index.html` as a 200 `text/html`
 * response. `stats.isError` stays `false` and `stats.data` becomes that HTML
 * string — truthy, but not usable stats. So validity is checked on the
 * actual shape of the data, not on the query's error/loading flags.
 */
function isValidPortfolioStats(value: unknown): value is PortfolioStatsResponse {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    Number.isFinite(candidate.visitors) &&
    Number.isFinite(candidate.inquiries) &&
    Number.isFinite(candidate.activeBuilds)
  );
}

/**
 * The backend applies the public stats baseline exactly once and returns
 * final values. The frontend must never re-apply it:
 *
 * - Valid API data (a real `{visitors, inquiries, activeBuilds}` object):
 *   render those numbers exactly as returned. This also covers a background
 *   refetch failure after an earlier success — react-query keeps the last
 *   good `data` in that case, so it's still valid and still wins.
 * - Anything else — first render, still loading, pending, fetching, errored,
 *   or a malformed/non-JSON response — the known public baseline. There is
 *   no third "unknown" display state.
 */
export function toDisplayedStats(stats: unknown): PortfolioStatsResponse {
  if (isValidPortfolioStats(stats)) {
    return {
      visitors: stats.visitors,
      inquiries: stats.inquiries,
      activeBuilds: stats.activeBuilds,
    };
  }
  return { ...PORTFOLIO_STATS_FALLBACK };
}
