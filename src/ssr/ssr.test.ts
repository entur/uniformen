import { describe, expect, test } from "bun:test";
import { signToken } from "../test/authTestKeys";
import { app } from "../index";

function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

describe("/ssr auth (optional)", () => {
  test("no token returns 200 (public) with empty user slot", async () => {
    const res = await app.request("/ssr?nonce=abc123");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.headerHtml).not.toContain("uniformen-top-nav__user");
  });

  test("token with wrong audience is ignored, returns 200 anonymous", async () => {
    const token = await signToken({ aud: "https://wrong.audience" });
    const res = await app.request("/ssr?nonce=abc123", { headers: bearer(token) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.headerHtml).not.toContain("uniformen-top-nav__user");
  });

  test("token with wrong issuer is ignored, returns 200 anonymous", async () => {
    const token = await signToken({ iss: "https://evil.example/" });
    const res = await app.request("/ssr?nonce=abc123", { headers: bearer(token) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.headerHtml).not.toContain("uniformen-top-nav__user");
  });

  test("expired token is ignored, returns 200 anonymous", async () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    const token = await signToken({ exp: past, iat: past - 3600 });
    const res = await app.request("/ssr?nonce=abc123", { headers: bearer(token) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.headerHtml).not.toContain("uniformen-top-nav__user");
  });
});

describe("/ssr user in top navigation", () => {
  test("valid token renders sub in the right nav slot", async () => {
    const token = await signToken({ sub: "auth0|abc123" });
    const res = await app.request("/ssr?nonce=abc123", { headers: bearer(token) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.headerHtml).toContain('class="uniformen-top-nav__user"');
    expect(body.headerHtml).toContain("auth0|abc123");
  });

  test("name claim takes priority over sub", async () => {
    const token = await signToken({ sub: "auth0|abc123", name: "Ada Lovelace" });
    const res = await app.request("/ssr?nonce=abc123", { headers: bearer(token) });
    const body = await res.json();
    expect(body.headerHtml).toContain("Ada Lovelace");
    expect(body.headerHtml).not.toContain("auth0|abc123");
  });
});

describe("/ssr", () => {
  test("nonce + no token returns 200 with all body keys as non-empty strings", async () => {
    const res = await app.request("/ssr?nonce=abc123");
    expect(res.status).toBe(200);

    const body = await res.json();
    for (const key of ["headAssets", "headerHtml", "footerHtml", "scripts"]) {
      expect(typeof body[key]).toBe("string");
      expect(body[key].length).toBeGreaterThan(0);
    }
  });

  test("missing nonce returns 200", async () => {
    const res = await app.request("/ssr");
    expect(res.status).toBe(200);
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
    expect(body.headAssets).toContain('nonce="abc123"');
  });

  test("nonce is injected into scripts script tag", async () => {
    const res = await app.request("/ssr?nonce=abc123");
    const body = await res.json();
    expect(body.scripts).toContain('nonce="abc123"');
  });

  test("no nonce omits nonce attribute from headAssets", async () => {
    const res = await app.request("/ssr");
    const body = await res.json();
    expect(body.headAssets).not.toContain("nonce=");
  });

  test("no nonce omits nonce attribute from scripts", async () => {
    const res = await app.request("/ssr");
    const body = await res.json();
    expect(body.scripts).not.toContain("nonce=");
  });
});
