import { describe, expect, test } from "bun:test";
import { app } from "../index";

describe("/ssr", () => {
  test("valid nonce returns 200 with all body keys as non-empty strings", async () => {
    const res = await app.request("/ssr?nonce=abc123");
    expect(res.status).toBe(200);

    const body = await res.json();
    for (const key of ["headAssets", "headerHtml", "footerHtml", "scripts"]) {
      expect(typeof body[key]).toBe("string");
      expect(body[key].length).toBeGreaterThan(0);
    }
  });

  test("missing nonce returns 400", async () => {
    const res = await app.request("/ssr");
    expect(res.status).toBe(400);
  });

  test("nonce with invalid characters returns 400", async () => {
    const res = await app.request(`/ssr?nonce=${encodeURIComponent("bad nonce!")}`);
    expect(res.status).toBe(400);
  });

  test("nonce with valid edge characters returns 200", async () => {
    const res = await app.request("/ssr?nonce=a-b_c");
    expect(res.status).toBe(200);
  });

  test("nonce is injected into headAssets style tag", async () => {
    const res = await app.request("/ssr?nonce=abc123");
    const body = await res.json();
    expect(body.headAssets).toContain('<style nonce="abc123">');
  });

  test("nonce is injected into scripts script tag", async () => {
    const res = await app.request("/ssr?nonce=abc123");
    const body = await res.json();
    expect(body.scripts).toContain('<script nonce="abc123">');
  });
});
