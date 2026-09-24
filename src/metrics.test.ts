import { describe, expect, test } from "bun:test";
import { app } from "./index";

/**
 * Returns the lines of the Prometheus scrape output. It requests the app, not the
 * registry, so the tests also check that the middleware and the route are set up.
 */
async function metricLines(): Promise<string[]> {
  const res = await app.request("/actuator/prometheus");
  expect(res.status).toBe(200);
  return (await res.text()).split("\n");
}

/** Returns the series lines for one metric, without the `# HELP` and `# TYPE` lines. */
const seriesFor = (lines: string[], name: string): string[] =>
  lines.filter((line) => line.startsWith(`${name}{`));

describe("http metrics", () => {
  test("requests are counted under the name Entur's shared dashboards look for", async () => {
    await app.request("/ssr?app=partner");

    const series = seriesFor(await metricLines(), "http_server_requests_seconds_count");
    expect(
      series.some((line) => line.includes('route="/ssr"') && line.includes('uri="/ssr"')),
    ).toBe(true);
  });

  test("actuator paths are not counted", async () => {
    await app.request("/actuator/health/liveness");
    await app.request("/actuator/health/readiness");

    const lines = await metricLines();
    expect(seriesFor(lines, "http_server_requests_seconds_count")).not.toContainEqual(
      expect.stringContaining("/actuator"),
    );
  });

  test("the library's duplicate request counter is disabled", async () => {
    expect(seriesFor(await metricLines(), "http_requests_total")).toBeEmpty();
  });

  test("process cpu and memory are exposed", async () => {
    const lines = await metricLines();
    expect(lines.some((line) => line.startsWith("process_cpu_seconds_total"))).toBe(true);
    expect(lines.some((line) => line.startsWith("nodejs_heap_size_used_bytes"))).toBe(true);
  });
});

describe("ssr request metric", () => {
  test("records the application id rather than its display name", async () => {
    await app.request("/ssr?app=partner");

    const series = seriesFor(await metricLines(), "uniformen_ssr_requests");
    expect(series).toContainEqual(expect.stringContaining('consumer_app="partner"'));
    expect(series).not.toContainEqual(expect.stringContaining('consumer_app="Partner"'));
  });

  test("a request without an app is counted as none", async () => {
    await app.request("/ssr");

    const series = seriesFor(await metricLines(), "uniformen_ssr_requests");
    expect(series).toContainEqual(expect.stringContaining('consumer_app="none"'));
    expect(series).not.toContainEqual(expect.stringContaining('consumer_app="undefined"'));
  });

  test("an unknown app is rejected before it can become a label", async () => {
    const res = await app.request("/ssr?app=not-an-app");
    expect(res.status).toBe(400);

    expect(seriesFor(await metricLines(), "uniformen_ssr_requests")).not.toContainEqual(
      expect.stringContaining("not-an-app"),
    );
  });
});
