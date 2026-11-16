import { describe, expect, test } from "bun:test";
import { app } from "./index";
import { beginShutdown, isReady } from "./lifecycle";

describe("server", () => {
  test("liveness UP", async () => {
    const res = await app.request("/actuator/health/liveness");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "UP" });
  });

  test("readiness UP", async () => {
    const res = await app.request("/actuator/health/readiness");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "UP" });
  });

  test("root responds", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Entur");
  });

  test.each([
    ["/favicon.ico", "image/x-icon"],
    ["/favicon.svg", "image/svg+xml; charset=utf-8"],
    ["/apple-touch-icon.png", "image/png"],
    ["/apple-touch-icon-precomposed.png", "image/png"],
    ["/robots.txt", "text/plain; charset=utf-8"],
  ])("%s responds with %s", async (path, contentType) => {
    const res = await app.request(path);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(contentType);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=604800");
  });

  test("robots.txt disallows all crawling", async () => {
    const res = await app.request("/robots.txt");
    expect(await res.text()).toBe("User-agent: *\nDisallow: /\n");
  });
});

// Keep this block last in the file. Nothing resets the shutdown state, so every
// test after it would see a server that is shutting down.
describe("shutdown", () => {
  test("readiness fails once a shutdown has begun, and liveness does not", async () => {
    expect(isReady()).toBe(true);
    expect(beginShutdown()).toBe(true);

    const readiness = await app.request("/actuator/health/readiness");
    expect(readiness.status).toBe(503);
    expect(await readiness.json()).toEqual({ status: "OUT_OF_SERVICE" });

    const liveness = await app.request("/actuator/health/liveness");
    expect(liveness.status).toBe(200);
    const ssr = await app.request("/ssr");
    expect(ssr.status).toBe(200);
  });

  test("a second signal does not start a second drain", () => {
    expect(beginShutdown()).toBe(false);
  });
});
