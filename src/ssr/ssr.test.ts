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

describe("/ssr user menu", () => {
  test("the signed-in user gets a menu, with the email under the name", async () => {
    userInfoMock.respond = () =>
      Response.json({ name: "Hallstein Bronskimlet", email: "hallstein@entur.org" });
    // Its own sub: userinfo is cached per `tenant|sub` for the process' lifetime,
    // so a sub another test has already fetched would serve that test's profile.
    const token = await signInternalToken({ sub: "auth0|withemail" });
    const body = await (await app.request("/ssr", { headers: bearer(token) })).json();
    expect(body.headerHtml).toContain('id="uniformen-user-menu-panel"');
    expect(body.headerHtml).toContain("hallstein@entur.org");
    // Tests run with ENVIRONMENT=dev (see test/authTestSetup).
    expect(body.headerHtml).toContain(
      'href="https://entur-partner.dev.entur.org/permission-admin/my-profile"',
    );
    expect(body.headerHtml).toContain('href="/auth/logout"');
  });

  test("a nameless profile is labelled by its email, which is then not repeated", async () => {
    userInfoMock.respond = () => Response.json({ email: "navnlos@entur.org" });
    const token = await signInternalToken({ sub: "auth0|nameless" });
    const body = await (await app.request("/ssr", { headers: bearer(token) })).json();
    expect(body.headerHtml.match(/navnlos@entur\.org/g)).toHaveLength(2);
    expect(body.headerHtml).not.toContain("uniformen-user-menu__email");
    expect(body.headerHtml).not.toContain("auth0|nameless");
  });

  test("a profile with neither name nor email still gets a menu", async () => {
    userInfoMock.respond = () => Response.json({});
    const token = await signInternalToken({ sub: "auth0|bare" });
    const body = await (await app.request("/ssr", { headers: bearer(token) })).json();
    expect(body.headerHtml).toContain("Bruker uten navn");
    expect(body.headerHtml).not.toContain("uniformen-user-menu__email");
    expect(body.headerHtml).not.toContain("auth0|bare");
  });

  test("anonymous requests carry no menu and no account links", async () => {
    const body = await (await app.request("/ssr")).json();
    expect(body.headerHtml).not.toContain("uniformen-user-menu");
    expect(body.headerHtml).not.toContain("/auth/logout");
  });
});

describe("/ssr login link", () => {
  test("anonymous request renders a login link to /auth/login", async () => {
    const res = await app.request("/ssr");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.headerHtml).toContain('class="uniformen-top-nav__login"');
    expect(body.headerHtml).toContain('href="/auth/login"');
    expect(body.headerHtml).toContain("Logg inn");
  });

  test("authenticated request omits the login link", async () => {
    userInfoMock.respond = () => Response.json({ name: "Hallstein Bronskimlet" });
    const token = await signInternalToken({ sub: "auth0|abc123" });
    const res = await app.request("/ssr", { headers: bearer(token) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.headerHtml).not.toContain("uniformen-top-nav__login");
    expect(body.headerHtml).not.toContain('href="/auth/login"');
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

  test("every handler ships in the inline bundle", async () => {
    // The failure this covers is silent: drop a handler from the array and the
    // control it wires up simply never responds in a consumer's page, with no
    // markup missing and no other assertion to notice. Each handler is keyed by
    // the attribute it queries for.
    const res = await app.request("/ssr");
    const body = await res.json();
    for (const attribute of [
      "data-uniformen-app-switcher-toggle",
      "data-uniformen-env-switcher-toggle",
      "data-uniformen-env-switcher-link",
      "data-uniformen-user-menu-toggle",
    ]) {
      expect(body.scripts).toContain(attribute);
    }
  });

  test("the panels share one copy of their behaviour, called once each", async () => {
    const body = await (await app.request("/ssr")).json();
    expect(body.scripts.match(/function panelToggle/g)).toHaveLength(1);
    expect(body.scripts.match(/panelToggle\("/g)).toHaveLength(3);
  });

  test("the inline bundle is valid JavaScript", async () => {
    // The bundle is assembled as source text, so nothing but a browser would
    // otherwise notice a syntax error. Emitting the handlers as the declarations
    // they are is what makes them callable by name below them: rewrite one as an
    // arrow function, or rename it without the call following, and this is where it
    // surfaces rather than in a consumer's console.
    const body = await (await app.request("/ssr")).json();
    const scripts = body.scripts.trim();
    const hasOpenTag = scripts.slice(0, 8).toLowerCase() === "<script>";
    const hasCloseTag = scripts.slice(-9).toLowerCase() === "</script>";
    const source =
      hasOpenTag && hasCloseTag ? scripts.slice("<script>".length, -"</script>".length) : scripts;
    expect(() => new Function(source)).not.toThrow();
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

describe("/ssr app query param", () => {
  const APP_NAMES: [slug: string, rendered: string][] = [
    ["partner", "Partner"],
    ["sorvis", "Sørvis"],
    ["cleos", "CLEOS"],
    ["nplan", "Nplan"],
    ["ops-center", "Ops Center"],
  ];

  const ssr = (query = "") => app.request(`/ssr${query}`);

  for (const [slug, rendered] of APP_NAMES) {
    test(`app=${slug} renders "${rendered}" in the logo slot`, async () => {
      const res = await ssr(`?app=${slug}`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.headerHtml).toContain(`<span class="uniformen-logo__app">${rendered}</span>`);
    });
  }

  test("no app param renders the logo without an app name slot", async () => {
    const res = await app.request("/ssr");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.headerHtml).toContain('class="uniformen-logo"');
    expect(body.headerHtml).not.toContain("uniformen-logo__app");
  });

  test("app param does not affect the footer or csp hashes", async () => {
    const plain = await (await ssr()).json();
    const withApp = await (await ssr("?app=partner")).json();
    expect(withApp.footerHtml).toBe(plain.footerHtml);
    expect(withApp.csp).toEqual(plain.csp);
    expect(withApp.headAssets).toBe(plain.headAssets);
    expect(withApp.scripts).toBe(plain.scripts);
  });

  test("app param works alongside an authenticated user", async () => {
    userInfoMock.respond = () => Response.json({ name: "Kari Nordmann" });
    const token = await signInternalToken({ sub: "auth0|appparam" });
    const res = await app.request("/ssr?app=cleos", { headers: bearer(token) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.headerHtml).toContain("uniformen-top-nav__user");
    expect(body.headerHtml).toContain("Kari Nordmann");
    expect(body.headerHtml).toContain("CLEOS");
  });

  test("unknown app value is rejected by query validation", async () => {
    const res = await ssr("?app=evil");
    expect(res.status).toBe(400);
  });

  test("empty app value is rejected by query validation", async () => {
    const res = await ssr("?app=");
    expect(res.status).toBe(400);
  });

  test("unrecognised query params are ignored", async () => {
    const res = await ssr("?app=partner&nonsense=1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.headerHtml).toContain("Partner");
  });
});

describe("/ssr sidebar query param", () => {
  const ssr = (query = "") => app.request(`/ssr${query}`);

  test("sidebar=true renders the collapse control", async () => {
    const res = await ssr("?sidebar=true");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.headerHtml).toContain("data-uniformen-sidebar-toggle");
    expect(body.headerHtml).toContain('aria-label="Skjul eller vis sidemeny"');
  });

  test("sidebar=false and no param omit the collapse control", async () => {
    for (const query of ["", "?sidebar=false"]) {
      const body = await (await ssr(query)).json();
      expect(body.headerHtml).not.toContain("data-uniformen-sidebar-toggle");
    }
  });

  test("the param says whether the app has a sidebar, never which state it is in", async () => {
    // The state is a per-user preference restored on the client, so it must not
    // reach the markup — one response body serves every user of the app.
    const body = await (await ssr("?sidebar=true")).json();
    expect(body.headerHtml).not.toContain('data-uniformen-sidebar="');
    for (const query of ["?sidebar=expanded", "?sidebar=collapsed", "?sidebar=yes"]) {
      expect((await ssr(query)).status).toBe(400);
    }
  });

  test("the handlers ship regardless, so the same script hashes serve both", async () => {
    const withToggle = await (await ssr("?sidebar=true")).json();
    const without = await (await ssr()).json();
    expect(withToggle.headAssets).toContain("uniformen:sidebar");
    expect(withToggle.headAssets).toBe(without.headAssets);
    expect(withToggle.scripts).toBe(without.scripts);
    expect(withToggle.csp).toEqual(without.csp);
  });

  test("the whole sidebar ships from the head, not the end of the body", async () => {
    const body = await (await ssr("?sidebar=true")).json();
    // `scripts` ships at the end of the body, which is too late twice over: the
    // expanded sidebar would paint first and then collapse, and an app that writes
    // the state attribute before that point would have the write go unobserved.
    expect(body.headAssets).toContain("data-uniformen-sidebar");
    expect(body.headAssets).toContain("uniformen:sidebar");
    expect(body.headAssets).toContain("MutationObserver");
    expect(body.scripts).not.toContain("data-uniformen-sidebar");
    // Both inline blocks are hashed for the consumer's script-src.
    expect(body.csp["script-src"]).toHaveLength(2);
    for (const source of body.csp["script-src"]) expect(source).toStartWith("'sha256-");
  });

  test("the icon ships both chevron directions, and the stylesheet picks one per state", async () => {
    const body = await (await ssr("?sidebar=true")).json();
    expect(body.headerHtml).toContain("uniformen-sidebar-toggle__chevron--collapse");
    expect(body.headerHtml).toContain("uniformen-sidebar-toggle__chevron--expand");
    // Only CSS distinguishes the two, so the rules have to be in the served
    // stylesheet — otherwise the button looks identical expanded and collapsed.
    expect(body.headAssets).toMatch(
      /:root\[data-uniformen-sidebar="collapsed"\]\s*\.uniformen-sidebar-toggle__chevron--collapse/,
    );
    expect(body.headAssets).toMatch(
      /:root:not\(\[data-uniformen-sidebar="collapsed"\]\)\s*\.uniformen-sidebar-toggle__chevron--expand/,
    );
  });
});

describe("/ssr top bar chrome", () => {
  test("renders the environment badge for the running environment", async () => {
    const body = await (await app.request("/ssr")).json();
    // Tests run with ENVIRONMENT=dev (see test/authTestSetup).
    expect(body.headerHtml).toContain('data-uniformen-environment="dev"');
    expect(body.headerHtml).toContain('class="uniformen-env-badge__label">DEV');
    // Non-prod environments carry the strip pointer; production drops both.
    expect(body.headerHtml).toContain("uniformen-env-badge__pointer");
    expect(body.headAssets).toContain("--uniformen-env-strip-height: 0.25rem");
  });

  test("renders the right-hand action cluster", async () => {
    const body = await (await app.request("/ssr")).json();
    expect(body.headerHtml).toContain('aria-label="Velg applikasjon"');
    expect(body.headerHtml).toContain("uniformen-top-nav__divider");
  });

  test("notifications ride along with the user, not the anonymous bar", async () => {
    userInfoMock.respond = () => Response.json({ name: "Hallstein Bronskimlet" });
    const token = await signInternalToken({ sub: "auth0|abc123" });
    const authed = await (await app.request("/ssr", { headers: bearer(token) })).json();
    expect(authed.headerHtml).toContain('aria-label="Varsler"');

    const anonymous = await (await app.request("/ssr")).json();
    expect(anonymous.headerHtml).not.toContain('aria-label="Varsler"');
  });

  test("the app switcher panel is still wired to its toggle", async () => {
    const body = await (await app.request("/ssr")).json();
    expect(body.headerHtml).toContain("data-uniformen-app-switcher-toggle");
    expect(body.headerHtml).toContain('id="uniformen-app-switcher-panel"');
  });

  test("the switcher links to the environment this instance serves", async () => {
    const body = await (await app.request("/ssr")).json();
    // Tests run with ENVIRONMENT=dev (see test/authTestSetup): a dev header must
    // not hand its user production apps.
    expect(body.headerHtml).toContain('href="https://sorvis.dev.entur.io"');
    expect(body.headerHtml).not.toContain('href="https://sorvis.entur.io"');
  });

  test("the requesting app is marked as the current one", async () => {
    // The `app` value and the switcher entry it marks are the same string, so
    // `?app=partner` marks the Partner entry, whose host is `entur-partner`.
    const withApp = await (await app.request("/ssr?app=partner")).json();
    expect(withApp.headerHtml).toContain('aria-current="page"');
    expect(withApp.headerHtml).toMatch(
      /entur-partner\.dev\.entur\.org[\s\S]{0,200}aria-current="page"/,
    );

    const withoutApp = await (await app.request("/ssr")).json();
    expect(withoutApp.headerHtml).not.toContain('aria-current="page"');
  });

  test("style tag carries the environment palette", async () => {
    const body = await (await app.request("/ssr")).json();
    for (const name of [
      "--uniformen-color-env:",
      "--uniformen-color-env-tint:",
      "--uniformen-color-env-border:",
      "--uniformen-color-env-text:",
    ]) {
      expect(body.headAssets).toContain(name);
    }
  });
});
