import { beforeEach, describe, expect, test } from "bun:test";
import { userInfoMock } from "../test/authTestSetup";
import {
  INTERNAL_AUDIENCE,
  INTERNAL_ISSUER,
  PARTNER_AUDIENCE,
  signPartnerToken,
  signInternalToken,
} from "../test/authTestKeys";
import { app } from "../index";

function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

beforeEach(() => userInfoMock.reset());

describe("/ssr auth (optional)", () => {
  test("no token returns 200 (public) with empty user slot", async () => {
    const res = await app.request("/ssr");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.headerHtml).not.toContain("uniformen-top-nav__user");
  });

  test("token with wrong audience is ignored, returns 200 anonymous", async () => {
    const token = await signInternalToken({ aud: "https://wrong.audience" });
    const res = await app.request("/ssr", { headers: bearer(token) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.headerHtml).not.toContain("uniformen-top-nav__user");
  });

  test("token with wrong issuer is ignored, returns 200 anonymous", async () => {
    const token = await signInternalToken({ iss: "https://evil.example/" });
    const res = await app.request("/ssr", { headers: bearer(token) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.headerHtml).not.toContain("uniformen-top-nav__user");
  });

  test("expired token is ignored, returns 200 anonymous", async () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    const token = await signInternalToken({ exp: past, iat: past - 3600 });
    const res = await app.request("/ssr", { headers: bearer(token) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.headerHtml).not.toContain("uniformen-top-nav__user");
  });
});

describe("/ssr auth (partner tenant)", () => {
  test("valid partner token renders the userinfo name, not the sub", async () => {
    userInfoMock.respond = () => Response.json({ name: "Ollvar O. Kleppvold" });
    const token = await signPartnerToken({ sub: "auth0|partner123" });
    const res = await app.request("/ssr", { headers: bearer(token) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.headerHtml).toContain('class="uniformen-top-nav__user"');
    expect(body.headerHtml).toContain("Ollvar O. Kleppvold");
    expect(body.headerHtml).not.toContain("auth0|partner123");
  });

  test("partner-issued token with internal audience is rejected (no cross-pairing)", async () => {
    const token = await signPartnerToken({ aud: INTERNAL_AUDIENCE });
    const res = await app.request("/ssr", { headers: bearer(token) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.headerHtml).not.toContain("uniformen-top-nav__user");
  });

  test("internal-issued token with partner audience is rejected (no cross-pairing)", async () => {
    const token = await signInternalToken({ aud: PARTNER_AUDIENCE });
    const res = await app.request("/ssr", { headers: bearer(token) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.headerHtml).not.toContain("uniformen-top-nav__user");
  });

  test("token signed with partner key but claiming internal issuer is rejected", async () => {
    const token = await signPartnerToken({ iss: INTERNAL_ISSUER, aud: INTERNAL_AUDIENCE });
    const res = await app.request("/ssr", { headers: bearer(token) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.headerHtml).not.toContain("uniformen-top-nav__user");
  });
});

describe("/ssr user in top navigation", () => {
  test("valid token renders the userinfo name, not the sub", async () => {
    userInfoMock.respond = () => Response.json({ name: "Hallstein Bronskimlet" });
    const token = await signInternalToken({ sub: "auth0|abc123" });
    const res = await app.request("/ssr", { headers: bearer(token) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.headerHtml).toContain('class="uniformen-top-nav__user"');
    expect(body.headerHtml).toContain("Hallstein Bronskimlet");
    expect(body.headerHtml).not.toContain("auth0|abc123");
  });

  test("userinfo failure renders anonymous nav, never the sub", async () => {
    userInfoMock.respond = () => new Response("server error", { status: 500 });
    const token = await signInternalToken({ sub: "auth0|fail500" });
    const res = await app.request("/ssr", { headers: bearer(token) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.headerHtml).not.toContain("uniformen-top-nav__user");
    expect(body.headerHtml).not.toContain("auth0|fail500");
  });
});

describe("/ssr", () => {
  test("returns 200 with all body keys as non-empty strings", async () => {
    const res = await app.request("/ssr");
    expect(res.status).toBe(200);

    const body = await res.json();
    for (const key of ["headAssets", "headerHtml", "footerHtml", "scripts"]) {
      expect(typeof body[key]).toBe("string");
      expect(body[key].length).toBeGreaterThan(0);
    }
    expect(body.headAssets).toContain("<style>");
    expect(body.scripts).toContain("<script>");
  });

  test("csp field carries sha256 hashes for the inline blocks", async () => {
    const res = await app.request("/ssr");
    const body = await res.json();
    expect(Array.isArray(body.csp["script-src"])).toBe(true);
    expect(Array.isArray(body.csp["style-src"])).toBe(true);
    expect(body.csp["script-src"].some((s: string) => s.startsWith("'sha256-"))).toBe(true);
    expect(body.csp["style-src"].some((s: string) => s.startsWith("'sha256-"))).toBe(true);
  });

  test("published hashes match the exact rendered inline bytes", async () => {
    const res = await app.request("/ssr");
    const body = await res.json();

    const sha256 = async (content: string) => {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
      return `'sha256-${Buffer.from(digest).toString("base64")}'`;
    };
    const inner = (s: string, open: string, close: string) =>
      s.slice(s.indexOf(open) + open.length, s.lastIndexOf(close));

    const styleBody = inner(body.headAssets, "<style>", "</style>");
    const scriptBody = inner(body.scripts, "<script>", "</script>");

    expect(body.csp["style-src"]).toContain(await sha256(styleBody));
    expect(body.csp["script-src"]).toContain(await sha256(scriptBody));
  });
});
