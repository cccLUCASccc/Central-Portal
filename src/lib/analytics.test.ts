import { test } from "node:test";
import assert from "node:assert/strict";
import { chartCoordinates, chartGroups, chartScale, readAnalyticsDaily, readAnalyticsSummary, readAnalyticsSessions } from "./analytics";

const metrics = { visitors: 10, sessions: 12, pageviews: 30, article_views: 15, cart_adds: 6, checkout_starts: 3, newsletter_signups: 2, favorites: 4 };
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

test("reads the exact eight metrics and period", async () => {
  assert.deepEqual(await readAnalyticsSummary(response({ days: 7, metrics })), { days: 7, metrics });
  assert.deepEqual(await readAnalyticsSummary(response({ days: 30, metrics })), { days: 30, metrics });
});

function daily(days = 7) {
  return {
    days, timezone: "UTC",
    series: Array.from({ length: days + 1 }, (_, index) => ({
      date: new Date(Date.UTC(2026, 8, 30 + index)).toISOString().slice(0, 10), metrics: { ...metrics }
    }))
  };
}
test("reads consecutive daily series for both periods including partial boundary dates", async () => {
  for (const days of [7, 30]) assert.deepEqual(await readAnalyticsDaily(response(daily(days))), daily(days));
});
test("rejects missing, duplicated, unordered or impossible chart dates and malformed counters", async () => {
  const value = daily();
  for (const invalid of [
    { ...value, days: 8 }, { ...value, timezone: "Europe/Brussels" }, { ...value, series: [] },
    { ...value, series: value.series.slice(1) },
    { ...value, series: [value.series[0], ...value.series.slice(0, -1)] },
    { ...value, series: value.series.toReversed() },
    { ...value, series: [{ ...value.series[0], date: "2026-02-30" }, ...value.series.slice(1)] },
    { ...value, series: [{ ...value.series[0], metrics: { ...metrics, cart_adds: -1 } }, ...value.series.slice(1)] }
  ]) await assert.rejects(readAnalyticsDaily(response(invalid)), /invalides|incohérentes/);
  await assert.rejects(readAnalyticsDaily(response({ error: "Quota PostHog dépassé" }, 502)), /Quota/);
});
test("chart scale and coordinates are finite, bounded and represent actual counts", () => {
  const points = daily().series;
  const series = chartGroups[0].series;
  const maximum = chartScale(points, series);
  assert.ok(maximum >= 12);
  const coordinates = chartCoordinates(points, "sessions", maximum);
  assert.equal(coordinates.length, 8);
  assert.equal(coordinates[0].x, 52);
  assert.equal(coordinates.at(-1)?.x, 672);
  assert.equal(coordinates[0].y, 220 - 12 / maximum * 200);
  for (const point of coordinates) {
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y) && point.y >= 20 && point.y <= 220);
  }
  const zeros = points.map(point => ({ ...point, metrics: Object.fromEntries(Object.keys(metrics).map(key => [key, 0])) as typeof metrics }));
  assert.equal(chartScale(zeros, series), 4);
  assert.ok(chartCoordinates(zeros, "sessions", 4).every(point => point.y === 220));
  for (const peak of [1, 5, 12, 80, 100, 1000]) {
    const sample = points.map(point => ({ ...point, metrics: { ...point.metrics, visitors: peak, sessions: 0 } }));
    const scale = chartScale(sample, series);
    assert.ok(scale >= peak && Number.isInteger(scale / 4), "axes need four evenly spaced integer intervals");
  }
});
test("rejects malformed metrics instead of displaying zero", async () => {
  for (const value of [
    { days: 8, metrics }, { days: 7, metrics: {} },
    { days: 7, metrics: { ...metrics, visitors: -1 } },
    { days: 7, metrics: { ...metrics, visitors: "10" } },
    { days: 7, metrics: { ...metrics, visitors: 1.5 } }
  ]) await assert.rejects(readAnalyticsSummary(response(value)), /invalides/);
});
test("surfaces configuration and non JSON errors", async () => {
  await assert.rejects(readAnalyticsSummary(response({ error: "PostHog non configuré" }, 503)), /503.*non configuré/);
  await assert.rejects(readAnalyticsSummary(new Response("<html>", { status: 502 })), /illisible.*502/);
});
test("validates safe replay links, UTC dates and counts", async () => {
  const session = {
    id: "0195cf12-1111-4444-aaaa-123456789abc", started_at: "2026-10-05T12:01:00Z",
    ended_at: "2026-10-05T12:02:30Z", pageviews: 3, events: 9,
    replay_url: "https://eu.posthog.com/project/123/replay/0195cf12-1111-4444-aaaa-123456789abc"
  };
  const value = { days: 7, user_id: "user_abc", sessions: [session] };
  assert.deepEqual(await readAnalyticsSessions(response(value)), value);
  assert.deepEqual((await readAnalyticsSessions(response({ ...value, sessions: [] }))).sessions, []);
  for (const invalid of [
    { ...session, replay_url: "javascript:alert(1)" }, { ...session, replay_url: session.replay_url + "?secret=1" },
    { ...session, started_at: "invalid" }, { ...session, events: -1 },
    { ...session, ended_at: "2026-10-04T12:00:00Z" }
  ]) await assert.rejects(readAnalyticsSessions(response({ ...value, sessions: [invalid] })), /invalides/);
});
