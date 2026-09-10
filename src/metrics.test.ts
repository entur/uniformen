import { describe, expect, test } from "bun:test";
import { app } from "./index";

/**
 * The scrape output, one line per series. Read through the app rather than the
 * registry: the wiring — the middleware being mounted, the route serving it — is
 * as much of what these tests hold in place as the metric definitions are.
 */
async function metricLines(): Promise<string[]> {
  const res = await app.request("/actuator/prometheus");
  expect(res.status).toBe(200);
  return (await res.text()).split("\n");
}

/** Lines for one metric, dropping the `# HELP`/`# TYPE` headers. */
const seriesFor = (lines: string[], name: string): string[] =>
  lines.filter((line) => line.startsWith(`${name}{`));

describe("http metrics", () => {
  test("requests are counted under the name Entur's shared dashboards look for", async () => {
    await app.request("/ssr?app=partner");

    const series = seriesFor(await metricLines(), "http_server_requests_seconds_count");
    // `uri` duplicates `route` on purpose: the dashboards group by the Micrometer
    // spelling, and renaming the label the library sets is not ours to do.
    expect(
      series.some((line) => line.includes('route="/ssr"') && line.includes('uri="/ssr"')),
    ).toBe(true);
  });

  /**
   * Probes hit liveness and readiness every five seconds per pod, so counting the
   * actuator paths would leave every traffic panel measuring Kubernetes rather
   * than consumers — and the availability panel reading healthy through an outage,
   * since probes keep passing while `/ssr` is broken.
   */
  test("actuator paths are not counted", async () => {
    await app.request("/actuator/health/liveness");
    await app.request("/actuator/health/readiness");

    const lines = await metricLines();
    expect(seriesFor(lines, "http_server_requests_seconds_count")).not.toContainEqual(
      expect.stringContaining("/actuator"),
    );
  });

  /**
   * The histogram's `_count` series already is the request counter, so the
   * library's separate one would only be a second name for the same events —
   * without the `uri` label, and free to drift once someone builds a panel on it.
   */
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
  /**
   * The id, not `portalApplicationName`'s display text. A display name is UI copy:
   * retitling an app in the switcher would start a new series and break the panel
   * at that date, for a change that has nothing to do with who is calling.
   */
  test("records the application id rather than its display name", async () => {
    await app.request("/ssr?app=partner");

    const series = seriesFor(await metricLines(), "uniformen_ssr_requests");
    expect(series).toContainEqual(expect.stringContaining('consumer_app="partner"'));
    expect(series).not.toContainEqual(expect.stringContaining('consumer_app="Partner"'));
  });

  /**
   * `portalApplicationName` answers `undefined` for a request with no app, and
   * prom-client would render that as the five-letter string — an application
   * called `undefined` sitting in the chart beside the real ones.
   */
  test("a request without an app is counted as none", async () => {
    await app.request("/ssr");

    const series = seriesFor(await metricLines(), "uniformen_ssr_requests");
    expect(series).toContainEqual(expect.stringContaining('consumer_app="none"'));
    expect(series).not.toContainEqual(expect.stringContaining('consumer_app="undefined"'));
  });

  /**
   * The label values can only be the ids zod accepts, because the counter reads
   * the validated query rather than the raw one. An arbitrary `?app=` is a 400
   * that never reaches the handler — which is what bounds the series count.
   */
  test("an unknown app is rejected before it can become a label", async () => {
    const res = await app.request("/ssr?app=not-an-app");
    expect(res.status).toBe(400);

    expect(seriesFor(await metricLines(), "uniformen_ssr_requests")).not.toContainEqual(
      expect.stringContaining("not-an-app"),
    );
  });
});
