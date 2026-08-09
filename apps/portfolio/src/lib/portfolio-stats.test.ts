import assert from "node:assert/strict";
import { test } from "node:test";
import { PORTFOLIO_STATS_FALLBACK, toDisplayedStats } from "./portfolio-stats";

test("first render, before the query resolves (data undefined) displays the 35/8/9 baseline", () => {
  assert.deepEqual(toDisplayedStats(undefined), PORTFOLIO_STATS_FALLBACK);
});

test("query stuck pending (no data, no error) still displays 35/8/9, never dashes", () => {
  assert.deepEqual(toDisplayedStats(undefined), PORTFOLIO_STATS_FALLBACK);
});

test("API error with no usable data displays 35/8/9", () => {
  assert.deepEqual(toDisplayedStats(undefined), PORTFOLIO_STATS_FALLBACK);
});

test("a truthy but structurally invalid response (e.g. an HTML string from a dev-server SPA fallback) falls back to 35/8/9, not dashes", () => {
  // This reproduces the actual local-dev root cause: hitting the Vite dev
  // server with no API process behind /api returns index.html as a 200
  // text/html response. The fetch client resolves that as plain text, so
  // react-query's `data` is a truthy string — not a stats object.
  assert.deepEqual(toDisplayedStats("<!DOCTYPE html><html>...</html>"), PORTFOLIO_STATS_FALLBACK);
  assert.deepEqual(toDisplayedStats({ visitors: "35" }), PORTFOLIO_STATS_FALLBACK);
  assert.deepEqual(toDisplayedStats(null), PORTFOLIO_STATS_FALLBACK);
});

test("API success with baseline-only values displays 35/8/9 exactly", () => {
  const apiStats = { visitors: 35, inquiries: 8, activeBuilds: 9 };
  assert.deepEqual(toDisplayedStats(apiStats), apiStats);
});

test("API success with real activity on top of the baseline displays 42/10/9 exactly", () => {
  const apiStats = { visitors: 42, inquiries: 10, activeBuilds: 9 };
  assert.deepEqual(toDisplayedStats(apiStats), apiStats);
});

test("a later refetch failure after a successful {42,10,9} keeps displaying 42/10/9, since react-query retains the last good data", () => {
  // Simulates react-query's default behavior: a background refetch failure
  // does not clear `data` — the previous successful payload is still there.
  const lastGoodData = { visitors: 42, inquiries: 10, activeBuilds: 9 };
  assert.deepEqual(toDisplayedStats(lastGoodData), lastGoodData);
});

test("does not add the baseline a second time on top of a successful API value", () => {
  const apiStats = { visitors: 42, inquiries: 10, activeBuilds: 9 };
  const displayed = toDisplayedStats(apiStats);

  // 35 and 8 are the baseline constants. If the frontend ever adds them
  // again on top of an already-final API value, these would match — they
  // must not.
  assert.notEqual(displayed.visitors, apiStats.visitors + PORTFOLIO_STATS_FALLBACK.visitors);
  assert.notEqual(displayed.inquiries, apiStats.inquiries + PORTFOLIO_STATS_FALLBACK.inquiries);
});

test("the fallback constant is exactly the known public baseline", () => {
  assert.deepEqual(PORTFOLIO_STATS_FALLBACK, { visitors: 35, inquiries: 8, activeBuilds: 9 });
});
