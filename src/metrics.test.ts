import { describe, expect, test } from "bun:test";
import { app } from "./index";
import { clientVersionLabel, MAX_CLIENT_VERSIONS } from "./metrics";

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

  test("a request is labelled with the app in the X-Uniformen-Consumer header", async () => {
    await app.request("/ssr", { headers: { "X-Uniformen-Consumer": "partner" } });

    const series = seriesFor(await metricLines(), "http_server_requests_seconds_count");
    expect(series).toContainEqual(
      expect.stringMatching(/(?=.*route="\/ssr")(?=.*consumer_app="partner")(?=.*status="200")/),
    );
  });

  test("a request that fails validation is still labelled from the header", async () => {
    const res = await app.request("/ssr?app=not-an-app", {
      headers: { "X-Uniformen-Consumer": "partner" },
    });
    expect(res.status).toBe(400);

    const series = seriesFor(await metricLines(), "http_server_requests_seconds_count");
    expect(series).toContainEqual(
      expect.stringMatching(/(?=.*route="\/ssr")(?=.*consumer_app="partner")(?=.*status="400")/),
    );
  });

  test("a header that is not a portal application id is counted as other", async () => {
    await app.request("/ssr", { headers: { "X-Uniformen-Consumer": "not-an-app" } });

    const series = seriesFor(await metricLines(), "http_server_requests_seconds_count");
    expect(series).toContainEqual(
      expect.stringMatching(/(?=.*route="\/ssr")(?=.*consumer_app="other")/),
    );
    expect(series).not.toContainEqual(expect.stringContaining("not-an-app"));
  });

  test("the app query parameter does not set the label", async () => {
    const res = await app.request("/ssr?app=nplan");
    expect(res.status).toBe(200);

    const series = seriesFor(await metricLines(), "http_server_requests_seconds_count");
    expect(series).not.toContainEqual(expect.stringContaining('consumer_app="nplan"'));
  });

  test("a request without the header is counted as none", async () => {
    await app.request("/ssr");

    const series = seriesFor(await metricLines(), "http_server_requests_seconds_count");
    expect(series).toContainEqual(
      expect.stringMatching(/(?=.*route="\/ssr")(?=.*consumer_app="none")(?=.*status="200")/),
    );
  });

  test("routes other than /ssr are labelled from the header too", async () => {
    await app.request("/", { headers: { "X-Uniformen-Consumer": "partner" } });

    const series = seriesFor(await metricLines(), "http_server_requests_seconds_count");
    expect(series).toContainEqual(
      expect.stringMatching(/(?=.*route="\/")(?=.*consumer_app="partner")/),
    );
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
    expect(series).toContainEqual(expect.stringContaining('rendered_app="partner"'));
    expect(series).not.toContainEqual(expect.stringContaining('rendered_app="Partner"'));
  });

  test("labels the app from the query parameter, not the X-Uniformen-Consumer header", async () => {
    await app.request("/ssr?app=nplan", { headers: { "X-Uniformen-Consumer": "partner" } });

    const series = seriesFor(await metricLines(), "uniformen_ssr_requests");
    expect(series).toContainEqual(expect.stringContaining('rendered_app="nplan"'));
    expect(series).not.toContainEqual(expect.stringContaining("consumer_app"));
  });

  test("a request without an app is counted as none", async () => {
    await app.request("/ssr");

    const series = seriesFor(await metricLines(), "uniformen_ssr_requests");
    expect(series).toContainEqual(expect.stringContaining('rendered_app="none"'));
    expect(series).not.toContainEqual(expect.stringContaining('rendered_app="undefined"'));
  });

  test("an unknown app is rejected before it can become a label", async () => {
    const res = await app.request("/ssr?app=not-an-app");
    expect(res.status).toBe(400);

    expect(seriesFor(await metricLines(), "uniformen_ssr_requests")).not.toContainEqual(
      expect.stringContaining("not-an-app"),
    );
  });
});

describe("client version label", () => {
  test("records the version the package sends", async () => {
    await app.request("/ssr", { headers: { "X-Uniformen-Client": "@entur/uniformen@0.16.0" } });

    const series = seriesFor(await metricLines(), "uniformen_ssr_requests");
    expect(series).toContainEqual(expect.stringContaining('client_version="0.16.0"'));
  });

  test("a request without the header is counted as none", async () => {
    await app.request("/ssr");

    const series = seriesFor(await metricLines(), "uniformen_ssr_requests");
    expect(series).toContainEqual(expect.stringContaining('client_version="none"'));
  });

  test("a header in another format is counted as unknown", () => {
    expect(clientVersionLabel("curl/8.0")).toBe("unknown");
    expect(clientVersionLabel("@entur/uniformen@1.0.0 extra")).toBe("unknown");
    expect(clientVersionLabel("@entur/uniformen@1.0")).toBe("unknown");
  });

  test("stops adding versions to the label after the limit", async () => {
    for (let i = 0; i < MAX_CLIENT_VERSIONS + 20; i++) {
      await app.request("/ssr", { headers: { "X-Uniformen-Client": `@entur/uniformen@9.9.${i}` } });
    }

    const versions = new Set(
      seriesFor(await metricLines(), "uniformen_ssr_requests").map(
        (line) => /client_version="([^"]*)"/.exec(line)?.[1],
      ),
    );
    // "none", "unknown" and "other" can also be present.
    expect(versions.size).toBeLessThanOrEqual(MAX_CLIENT_VERSIONS + 3);
    expect(versions).toContain("other");
  });
});
