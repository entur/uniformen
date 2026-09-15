import { beforeEach, describe, expect, test } from "bun:test";
import { userInfoMock } from "../test/authTestSetup";
import { ENTUR_ORGANISATION_ID, ORGANISATION_ID_CLAIM } from "../auth/enturOrganisation";
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

/**
 * The signed-in bar. Every call site brings its own `sub`: userinfo is cached per
 * `tenant|sub` for the process' lifetime, so a sub another test has fetched would
 * serve that test's profile.
 */
async function signedIn(sub: string, query = ""): Promise<{ headerHtml: string }> {
  const token = await signInternalToken({ sub });
  return (await app.request(`/ssr${query}`, { headers: bearer(token) })).json();
}

/** Userinfo for a profile in the Entur organisation, which the env chip is for. */
const enturProfile = (extra: Record<string, unknown> = {}) => ({
  name: "Hallstein Bronskimlet",
  [ORGANISATION_ID_CLAIM]: ENTUR_ORGANISATION_ID,
  ...extra,
});

/** `signedIn`, for a user the organisation claim places inside Entur. */
async function enturSignedIn(
  sub: string,
  query = "",
): Promise<{ headerHtml: string; headAssets: string; scripts: string; csp: unknown }> {
  userInfoMock.respond = () => Response.json(enturProfile());
  const token = await signInternalToken({ sub });
  return (await app.request(`/ssr${query}`, { headers: bearer(token) })).json();
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
    const body = await (
      await app.request("/ssr?logoutUrl=/auth/logout", { headers: bearer(token) })
    ).json();
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
  test("loginUrl renders the link, pointing where it says", async () => {
    const res = await app.request("/ssr?loginUrl=/oauth/start");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.headerHtml).toContain('class="uniformen-top-nav__login"');
    expect(body.headerHtml).toContain('href="/oauth/start"');
    expect(body.headerHtml).toContain("Logg inn");
  });

  test("no loginUrl, no link", async () => {
    const res = await app.request("/ssr");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.headerHtml).not.toContain("uniformen-top-nav__login");
    expect(body.headerHtml).not.toContain("Logg inn");
  });

  test("authenticated request omits the login link, loginUrl or not", async () => {
    userInfoMock.respond = () => Response.json({ name: "Hallstein Bronskimlet" });
    const token = await signInternalToken({ sub: "auth0|abc123" });
    const res = await app.request("/ssr?loginUrl=/auth/login", { headers: bearer(token) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.headerHtml).not.toContain("uniformen-top-nav__login");
    expect(body.headerHtml).not.toContain('href="/auth/login"');
  });

  test("only a path on the consumer's own origin, the near misses included", async () => {
    for (const value of [
      "https://phish.example/login",
      "//phish.example/login",
      "/\\phish.example/login",
      "javascript:alert(1)",
      "auth/login",
      "",
      "/auth/login onclick=x",
    ]) {
      const res = await app.request(`/ssr?loginUrl=${encodeURIComponent(value)}`);
      expect(res.status).toBe(400);
    }
  });

  test("a path keeps its query and fragment", async () => {
    const body = await (
      await app.request(`/ssr?loginUrl=${encodeURIComponent("/auth/login?returnTo=/kort#top")}`)
    ).json();
    expect(body.headerHtml).toContain('href="/auth/login?returnTo=/kort#top"');
  });
});

describe("/ssr logout link", () => {
  const authed = async (query = "") => {
    userInfoMock.respond = () => Response.json({ name: "Hallstein Bronskimlet" });
    // Its own sub: userinfo is cached per `tenant|sub` for the process' lifetime,
    // so a sub another test has already fetched would serve that test's profile.
    const token = await signInternalToken({ sub: "auth0|logout" });
    return app.request(`/ssr${query}`, { headers: bearer(token) });
  };

  test("logoutUrl renders the row, pointing where it says", async () => {
    const res = await authed("?logoutUrl=/oauth/end");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.headerHtml).toContain(
      'class="uniformen-user-menu__item uniformen-user-menu__logout"',
    );
    expect(body.headerHtml).toContain('href="/oauth/end"');
    expect(body.headerHtml).toContain("Logg ut");
  });

  test("no logoutUrl, no row: the rest of the menu is untouched", async () => {
    const body = await (await authed()).json();
    expect(body.headerHtml).not.toContain("uniformen-user-menu__logout");
    expect(body.headerHtml).not.toContain("Logg ut");
    expect(body.headerHtml).toContain('id="uniformen-user-menu-panel"');
    expect(body.headerHtml).toContain("Mine tilganger");
  });

  test("anonymous request renders no menu, logoutUrl or not", async () => {
    const body = await (await app.request("/ssr?logoutUrl=/auth/logout")).json();
    expect(body.headerHtml).not.toContain("uniformen-user-menu");
    expect(body.headerHtml).not.toContain('href="/auth/logout"');
  });

  test("only a path on the consumer's own origin, the near misses included", async () => {
    for (const value of [
      "https://phish.example/logout",
      "//phish.example/logout",
      "/\\phish.example/logout",
      "javascript:alert(1)",
      "auth/logout",
      "",
      "/auth/logout onclick=x",
    ]) {
      const res = await app.request(`/ssr?logoutUrl=${encodeURIComponent(value)}`);
      expect(res.status).toBe(400);
    }
  });

  test("a path keeps its query and fragment", async () => {
    const body = await (
      await authed(`?logoutUrl=${encodeURIComponent("/auth/logout?returnTo=/kort#top")}`)
    ).json();
    expect(body.headerHtml).toContain('href="/auth/logout?returnTo=/kort#top"');
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
    expect(body.scripts.match(/panelToggle\("/g)).toHaveLength(4);
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
    ["skoleskyss", "Skoleskyss"],
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

  test("an unlisted app names itself without joining the switcher", async () => {
    // Tests run as dev (see test/authTestSetup), which Skoleskyss has no deploy in,
    // so the chip is static here too.
    const body = await enturSignedIn("auth0|app-unlisted", "?app=skoleskyss");
    expect(body.headerHtml).toContain('<span class="uniformen-logo__app">Skoleskyss</span>');
    expect(body.headerHtml).toContain("data-uniformen-app-switcher-toggle");
    expect(body.headerHtml).not.toContain("skoleskyss.entur.no");
    expect(body.headerHtml).not.toContain("data-uniformen-env-switcher-toggle");
    expect(body.headerHtml).toContain('class="uniformen-env-badge"');
  });

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

describe("/ssr simple query param", () => {
  const ssr = (query = "") => app.request(`/ssr${query}`);
  const authed = async (query = "") => {
    userInfoMock.respond = () =>
      Response.json({ name: "Hallstein Bronskimlet", email: "hallstein@entur.org" });
    // Its own sub: userinfo is cached per `tenant|sub` for the process' lifetime,
    // so a sub another test has already fetched would serve that test's profile.
    const token = await signInternalToken({ sub: "auth0|simple" });
    return (await app.request(`/ssr${query}`, { headers: bearer(token) })).json();
  };

  test("the anonymous bar keeps the logo and the login link, and loses the rest", async () => {
    const body = await (await ssr("?simple=true&app=partner&loginUrl=/auth/login")).json();
    expect(body.headerHtml).toContain('href="/auth/login"');
    expect(body.headerHtml).toContain("uniformen-logo");
    expect(body.headerHtml).not.toContain('aria-label="Velg applikasjon"');
    expect(body.headerHtml).not.toContain("data-uniformen-app-switcher-toggle");
    expect(body.headerHtml).not.toContain("uniformen-top-nav__divider");
    expect(body.headerHtml).not.toContain('aria-label="Varsler"');
  });

  test("the app name and the environment stay: they say where you are, not where to go", async () => {
    const body = await enturSignedIn("auth0|simple-entur", "?simple=true&app=partner");
    expect(body.headerHtml).toContain('class="uniformen-logo__app">Partner<');
    expect(body.headerHtml).toContain('data-uniformen-environment="dev"');
    expect(body.headerHtml).toContain('class="uniformen-env-badge__label">DEV');
    // The env switcher is the badge's own control, not the app switcher's, so
    // naming an app still hands it its hosts.
    expect(body.headerHtml).toContain("data-uniformen-env-switcher-toggle");
    expect(body.headerHtml).toContain('id="uniformen-environment-switcher-panel"');
  });

  test("the signed-in bar names the user, with a menu that only logs out", async () => {
    const body = await authed("?simple=true&logoutUrl=/auth/logout");
    expect(body.headerHtml).toContain("Hallstein Bronskimlet");
    expect(body.headerHtml).toContain('href="/auth/logout"');
    expect(body.headerHtml).toContain("data-uniformen-user-menu-toggle");
    expect(body.headerHtml).toContain("uniformen-user-menu__email");
    expect(body.headerHtml).not.toContain("Mine tilganger");
    expect(body.headerHtml).not.toContain("my-profile");
    expect(body.headerHtml).not.toContain('aria-label="Varsler"');
  });

  test("simple=false and no param render the full bar", async () => {
    for (const [index, query] of ["", "?simple=false"].entries()) {
      const body = await signedIn(`auth0|full-bar-${index}`, query);
      expect(body.headerHtml).toContain('aria-label="Velg applikasjon"');
      expect(body.headerHtml).toContain("uniformen-top-nav__divider");
    }
  });

  test("anything other than true or false is rejected", async () => {
    for (const query of ["?simple=yes", "?simple=1", "?simple="]) {
      expect((await ssr(query)).status).toBe(400);
    }
  });

  test("simple wins over sidebar: a barebones bar carries no controls", async () => {
    const body = await (await ssr("?simple=true&sidebar=true")).json();
    expect(body.headerHtml).not.toContain("data-uniformen-sidebar-toggle");
    // The head script is unconditional, so an app styling off the root attribute
    // keeps its own sidebar working — it just loses our button.
    expect(body.headAssets).toContain("data-uniformen-sidebar");
  });

  test("the footer is untouched, and so are the hashes", async () => {
    const simple = await (await ssr("?simple=true")).json();
    const full = await (await ssr()).json();
    expect(simple.footerHtml).toBe(full.footerHtml);
    expect(simple.headAssets).toBe(full.headAssets);
    expect(simple.scripts).toBe(full.scripts);
    expect(simple.csp).toEqual(full.csp);
  });

  test("the localised strings that survive are still localised", async () => {
    const body = await (await ssr("?simple=true&locale=en-GB&loginUrl=/auth/login")).json();
    expect(body.headerHtml).toContain('aria-label="Log in"');
    expect(body.headerHtml).toContain('aria-label="Top navigation"');
  });
});

describe("/ssr top bar chrome", () => {
  test("renders the environment badge for the running environment", async () => {
    const body = await enturSignedIn("auth0|chrome-env");
    // Tests run with ENVIRONMENT=dev (see test/authTestSetup).
    expect(body.headerHtml).toContain('data-uniformen-environment="dev"');
    expect(body.headerHtml).toContain('class="uniformen-env-badge__label">DEV');
    // Non-prod environments carry the strip pointer; production drops both.
    expect(body.headerHtml).toContain("uniformen-env-badge__pointer");
    expect(body.headAssets).toContain("--uniformen-env-strip-height: 0.25rem");
  });

  test("renders the right-hand action cluster", async () => {
    const body = await signedIn("auth0|cluster");
    expect(body.headerHtml).toContain('aria-label="Velg applikasjon"');
    expect(body.headerHtml).toContain("uniformen-top-nav__divider");
  });

  test("the app switcher rides along with the user, not the anonymous bar", async () => {
    const body = await (await app.request("/ssr?app=partner&loginUrl=/auth/login")).json();
    expect(body.headerHtml).not.toContain('aria-label="Velg applikasjon"');
    expect(body.headerHtml).not.toContain("data-uniformen-app-switcher-toggle");
    expect(body.headerHtml).not.toContain("uniformen-top-nav__divider");
    // The rest of the anonymous bar is untouched.
    expect(body.headerHtml).toContain('href="/auth/login"');
    expect(body.headerHtml).toContain('class="uniformen-logo__app">Partner<');
  });

  // TODO enable this test once the notification panel is wired up
  test.skip("notifications ride along with the user, not the anonymous bar", async () => {
    userInfoMock.respond = () => Response.json({ name: "Hallstein Bronskimlet" });
    const token = await signInternalToken({ sub: "auth0|abc123" });
    const authed = await (await app.request("/ssr", { headers: bearer(token) })).json();
    expect(authed.headerHtml).toContain('aria-label="Varsler"');

    const anonymous = await (await app.request("/ssr")).json();
    expect(anonymous.headerHtml).not.toContain('aria-label="Varsler"');
  });

  test("the chip panels hang leftwards, so none of them can run off the page", async () => {
    // They are wider than the chips they belong to, and the chips sit at the right
    // end of the bar: growing rightwards puts a panel past the viewport and the page
    // into horizontal scroll. On a simple bar the user chip is the last thing in the
    // row, which is where that used to happen.
    const body = await (await app.request("/ssr")).json();
    const rule = body.headAssets.match(
      /\.uniformen-user-menu__panel,\s*\.uniformen-locale-switcher__panel \{([^}]*)\}/,
    )?.[1];
    // Against the chip rather than the viewport, and hanging from its right edge:
    // a panel belongs to the control that opened it, and travels with the bar.
    expect(rule).toContain("position: absolute");
    expect(rule).toContain("right: 0");
    expect(rule).not.toContain("left: 0");
    // And no breakpoint puts either of them back: one alignment at every width.
    expect(body.headAssets).not.toMatch(/@media[^{]*\{[^}]*__panel[^}]*left: auto/);
  });

  test("the app switcher panel is still wired to its toggle", async () => {
    const body = await signedIn("auth0|switcher-wiring");
    expect(body.headerHtml).toContain("data-uniformen-app-switcher-toggle");
    expect(body.headerHtml).toContain('id="uniformen-app-switcher-panel"');
  });

  test("the switcher links to the environment this instance serves", async () => {
    const body = await signedIn("auth0|switcher-env");
    // Tests run with ENVIRONMENT=dev (see test/authTestSetup): a dev header must
    // not hand its user production apps.
    expect(body.headerHtml).toContain('href="https://sorvis.dev.entur.io"');
    expect(body.headerHtml).not.toContain('href="https://sorvis.entur.io"');
  });

  test("the requesting app is marked as the current one", async () => {
    // The `app` value and the switcher entry it marks are the same string, so
    // `?app=partner` marks the Partner entry, whose host is `entur-partner`.
    const withApp = await signedIn("auth0|current-app", "?app=partner");
    expect(withApp.headerHtml).toContain('aria-current="page"');
    expect(withApp.headerHtml).toMatch(
      /entur-partner\.dev\.entur\.org[\s\S]{0,200}aria-current="page"/,
    );

    const withoutApp = await signedIn("auth0|current-none");
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

/**
 * Which environment a page is served from, and being able to land on the same page in
 * another one, is Entur's own chrome. The gate is the organisation claim on the
 * profile behind the token: not a query param, and not the anonymous bar.
 */
describe("/ssr environment selector", () => {
  const ssr = (query = "") => app.request(`/ssr${query}`);
  /** The header of a bar rendered for one profile. Own `sub`: userinfo is cached. */
  const forProfile = async (sub: string, profile: unknown, query = "") => {
    userInfoMock.respond = () => Response.json(profile);
    const token = await signPartnerToken({ sub });
    const body = await (await app.request(`/ssr${query}`, { headers: bearer(token) })).json();
    return body.headerHtml as string;
  };

  test("an Entur user gets the chip, and the switcher once an app is named", async () => {
    const chip = await enturSignedIn("auth0|env-entur");
    expect(chip.headerHtml).toContain('class="uniformen-env-badge"');
    expect(chip.headerHtml).not.toContain("data-uniformen-env-switcher-toggle");

    const switcher = await enturSignedIn("auth0|env-entur-app", "?app=nplan");
    expect(switcher.headerHtml).toContain("data-uniformen-env-switcher-toggle");
    expect(switcher.headerHtml).toContain('href="https://nplan.staging.entur.org"');
  });

  test("another organisation gets neither, app named or not", async () => {
    const other = { name: "Ollvar O. Kleppvold", [ORGANISATION_ID_CLAIM]: 9999 };
    const header = await forProfile("auth0|env-other-org", other, "?app=nplan");
    // Signed in, with everything else the bar gives them.
    expect(header).toContain("Ollvar O. Kleppvold");
    expect(header).toContain("data-uniformen-app-switcher-toggle");
    expect(header).not.toContain("uniformen-env-badge");
    expect(header).not.toContain("data-uniformen-env-switcher-toggle");
  });

  test("a profile carrying no organisation is not placed in one", async () => {
    const header = await forProfile("auth0|env-no-claim", { name: "Sigmunn Sagbladet" });
    expect(header).toContain("Sigmunn Sagbladet");
    expect(header).not.toContain("uniformen-env-badge");
  });

  test("the claim is the number, not a string that looks like it", async () => {
    // Reading a spelling of the id as the id is the one direction with a cost, so an
    // upstream that changes the claim's shape loses the chip rather than leaks it.
    for (const [index, value] of [
      String(ENTUR_ORGANISATION_ID),
      [ENTUR_ORGANISATION_ID],
      null,
    ].entries()) {
      const header = await forProfile(`auth0|env-shape-${index}`, {
        name: "Sigmunn Sagbladet",
        [ORGANISATION_ID_CLAIM]: value,
      });
      expect(header).not.toContain("uniformen-env-badge");
    }
  });

  test("anonymous requests get no chip: no token, no organisation", async () => {
    const body = await (await ssr("?app=nplan")).json();
    expect(body.headerHtml).not.toContain("uniformen-env-badge");
    expect(body.headerHtml).not.toContain("data-uniformen-env-switcher-toggle");
  });

  test("a userinfo failure fails closed", async () => {
    // The organisation is the userinfo's to say, so an outage costs an Entur user the
    // chip rather than handing everyone one.
    userInfoMock.respond = () => new Response("server error", { status: 500 });
    const token = await signInternalToken({ sub: "auth0|env-userinfo-500" });
    const body = await (await app.request("/ssr?app=nplan", { headers: bearer(token) })).json();
    expect(body.headerHtml).not.toContain("uniformen-env-badge");
  });

  test("the strip stays whoever is looking: it warns, it does not navigate", async () => {
    const entur = await enturSignedIn("auth0|env-strip");
    const anonymous = await (await ssr()).json();
    expect(anonymous.headerHtml).not.toContain("uniformen-env-badge");
    for (const body of [entur, anonymous]) {
      expect(body.headAssets).toContain("--uniformen-env-strip-height: 0.25rem");
      expect(body.headAssets).toContain("border-top: var(--uniformen-env-strip-height)");
    }
  });

  test("one stylesheet and one bundle serve both, so the hashes never fork", async () => {
    const entur = await enturSignedIn("auth0|env-hashes");
    const anonymous = await (await ssr()).json();
    expect(entur.headAssets).toBe(anonymous.headAssets);
    expect(entur.scripts).toBe(anonymous.scripts);
    expect(entur.csp).toEqual(anonymous.csp);
    // The handler ships to a page with no switcher, and bails out there.
    expect(anonymous.scripts).toContain("data-uniformen-env-switcher-toggle");
  });

  test("no query param unlocks it", async () => {
    // Being in an organisation is something a token establishes. `/ssr` ignores
    // unknown params, so these render the plain anonymous bar.
    for (const query of [
      "?isEnturUser=true",
      "?debugEnturUser=true",
      "?app=nplan&isEnturUser=true",
    ]) {
      const body = await (await ssr(query)).json();
      expect(body.headerHtml).not.toContain("uniformen-env-badge");
    }
  });
});

describe("/ssr locale", () => {
  test("no locale is bokmål, so a consumer that sends none keeps its markup", async () => {
    const body = await (await app.request("/ssr?loginUrl=/auth/login")).json();
    expect(body.headerHtml).toContain('aria-label="Toppnavigasjon"');
    expect(body.headerHtml).toContain(">Logg inn<");
    expect(body.footerHtml).toContain(">Informasjon<");
  });

  test("every string in the bar follows the locale, header and footer alike", async () => {
    const en = await (
      await app.request("/ssr?locale=en-GB&sidebar=true&loginUrl=/auth/login")
    ).json();
    expect(en.headerHtml).toContain('aria-label="Top navigation"');
    expect(en.headerHtml).toContain('aria-label="Hide or show side menu"');
    expect(en.headerHtml).toContain(">Log in<");
    expect(en.footerHtml).toContain(">Information<");
    expect(en.footerHtml).toContain(">Services<");
    expect(en.headerHtml).not.toContain("Logg inn");
    expect(en.footerHtml).not.toContain("Tjenester");

    const nn = await (await app.request("/ssr?locale=nn-NO")).json();
    expect(nn.footerHtml).toContain(">Tenester<");
  });

  test("the signed-in half is translated too", async () => {
    userInfoMock.respond = () => Response.json({ name: "Hallstein Bronskimlet" });
    const token = await signInternalToken({ sub: "auth0|abc123" });
    const body = await (
      await app.request("/ssr?locale=en-GB&logoutUrl=/auth/logout", { headers: bearer(token) })
    ).json();
    expect(body.headerHtml).toContain('aria-label="Choose application"');
    expect((await signedIn("auth0|nynorsk", "?locale=nn-NO")).headerHtml).toContain(
      'aria-label="Vel applikasjon"',
    );
    expect(body.headerHtml).toContain('aria-label="User menu"');
    expect(body.headerHtml).toContain(">My access<");
    expect(body.headerHtml).toContain(">Log out<");
  });

  test("a nameless profile gets its placeholder in the locale", async () => {
    userInfoMock.respond = () => Response.json({});
    // Own `sub`: userinfo is cached per subject.
    const token = await signInternalToken({ sub: "auth0|bare-en" });
    const body = await (await app.request("/ssr?locale=en-GB", { headers: bearer(token) })).json();
    expect(body.headerHtml).toContain("User without a name");
  });

  test("product and environment names are not translated", async () => {
    const body = await enturSignedIn("auth0|product-names", "?locale=en-GB&app=partner");
    expect(body.headerHtml).toContain(">Partner<");
    expect(body.headerHtml).toContain(">Sørvis<");
    expect(body.headerHtml).toContain('class="uniformen-env-badge__label">DEV');
  });

  test("a locale the service does not render is rejected, not fallen back on", async () => {
    for (const query of [
      "?locale=de-DE",
      "?locale=",
      // One spelling per language: the bare language subtag is not an alias for
      // the region-qualified tag, and matching is exact, not case-folded.
      "?locale=nb",
      "?locale=nb-no",
      "?locale=en",
      "?locale=en-US",
    ]) {
      expect((await app.request(`/ssr${query}`)).status).toBe(400);
    }
  });
});

describe("/ssr availableLocales query param", () => {
  const ssr = (query = "") => app.request(`/ssr${query}`);
  const authed = async (query = "") => {
    userInfoMock.respond = () => Response.json({ name: "Sigmunn Sagbladet" });
    // Its own sub: userinfo is cached per `tenant|sub` for the process' lifetime.
    const token = await signInternalToken({ sub: "auth0|availableLocales" });
    return (await app.request(`/ssr${query}`, { headers: bearer(token) })).json();
  };

  test("the switcher offers what was asked for, checked at the locale rendered", async () => {
    const body = await authed("?locale=en-GB&availableLocales=nb-NO&availableLocales=en-GB");
    expect(body.headerHtml).toContain("uniformen-locale-menu");
    expect(body.headerHtml).toContain(
      '<button type="button" role="menuitemradio" aria-checked="false" lang="nb-NO"',
    );
    expect(body.headerHtml).toContain(
      '<button type="button" role="menuitemradio" aria-checked="true" lang="en-GB"',
    );
    // Not the service's supported set — Partner translates two of the three.
    expect(body.headerHtml).not.toContain("Norsk nynorsk");
  });

  test("one language is a list, and no param renders no switcher", async () => {
    expect((await authed("?availableLocales=nb-NO")).headerHtml).toContain("uniformen-locale-menu");
    expect((await authed()).headerHtml).not.toContain("uniformen-locale-menu");
  });

  test("an anonymous bar gets the switcher as a control of its own, before the login link", async () => {
    const res = await ssr("?availableLocales=nb-NO&availableLocales=en-GB&loginUrl=/auth/login");
    expect(res.status).toBe(200);
    const { headerHtml } = await res.json();
    expect(headerHtml).toContain("data-uniformen-locale-switcher-toggle");
    expect(headerHtml).toContain('id="uniformen-locale-switcher-panel"');
    // The bar's own control, not the menu's section: there is no menu to hold it.
    expect(headerHtml).not.toContain("uniformen-locale-menu__heading");
    expect(headerHtml.indexOf("uniformen-locale-switcher")).toBeLessThan(
      headerHtml.indexOf('href="/auth/login"'),
    );
  });

  test("a simple bar keeps it: anonymous as a chip, signed in as a menu section", async () => {
    const anonymous = await (
      await ssr("?simple=true&availableLocales=nb-NO&availableLocales=en-GB")
    ).json();
    expect(anonymous.headerHtml).toContain("data-uniformen-locale-switcher-toggle");

    // The barebones menu keeps the language, unlike the links it drops: a chip
    // beside the chip that opens it would be two controls in one bar.
    const signedIn = await authed("?simple=true&availableLocales=nb-NO&availableLocales=en-GB");
    expect(signedIn.headerHtml).toContain("uniformen-locale-menu__heading");
    expect(signedIn.headerHtml).not.toContain("data-uniformen-locale-switcher-toggle");
    expect(signedIn.headerHtml).not.toContain("Mine tilganger");
  });

  test("only one control at a time: a signed-in bar has the section, not the chip", async () => {
    const body = await authed("?availableLocales=nb-NO&availableLocales=en-GB");
    expect(body.headerHtml).toContain("uniformen-locale-menu__heading");
    expect(body.headerHtml).not.toContain("data-uniformen-locale-switcher-toggle");
  });

  test("the chip names the current language, and announces it where the label is hidden", async () => {
    const body = await (
      await ssr("?locale=en-GB&availableLocales=nb-NO&availableLocales=en-GB")
    ).json();
    expect(body.headerHtml).toContain('aria-label="Språk / Language: English"');
    expect(body.headerHtml).toContain(
      'class="uniformen-top-nav__action-label" lang="en-GB">English<',
    );
  });

  test("a language the service does not render is rejected, not dropped", async () => {
    for (const query of [
      "?availableLocales=de-DE",
      "?availableLocales=",
      "?availableLocales=nb",
      "?availableLocales=nb-no",
      "?availableLocales=nb-NO&availableLocales=en",
    ]) {
      expect((await ssr(query)).status).toBe(400);
    }
  });

  test("a list that contradicts itself is rejected, not read past", async () => {
    // A repeat would render the language twice, and a list without the locale being
    // rendered would leave every option unchecked.
    expect((await ssr("?availableLocales=nb-NO&availableLocales=nb-NO")).status).toBe(400);
    expect((await ssr("?locale=nn-NO&availableLocales=nb-NO&availableLocales=en-GB")).status).toBe(
      400,
    );
    expect((await ssr("?availableLocales=en-GB")).status).toBe(400);
  });

  test("the client half ships with every layout, switcher rendered or not", async () => {
    // One bundle serves every combination of controls, and the handler bails out
    // when the markup is absent.
    const without = await (await ssr()).json();
    const with_ = await authed("?availableLocales=nb-NO&availableLocales=en-GB");
    expect(without.scripts).toContain("uniformen:locale");
    expect(with_.scripts).toBe(without.scripts);
    expect(with_.csp).toEqual(without.csp);
  });
});
/**
 * The bar names the signed-in user, so what a cache in front of the service is
 * allowed to keep is part of the endpoint's contract rather than a detail of it: one
 * stored authenticated response is one user's name handed to another.
 */
describe("/ssr caching", () => {
  test("an anonymous response is cacheable, and varies on the token", async () => {
    const res = await app.request("/ssr");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=60");
    expect(res.headers.get("Vary")).toBe("Authorization");
  });

  test("an authenticated response is nobody's to store", async () => {
    userInfoMock.respond = () => Response.json({ name: "Hallstein Bronskimlet" });
    const token = await signInternalToken({ sub: "auth0|abc123" });
    const res = await app.request("/ssr", { headers: bearer(token) });
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("Vary")).toBe("Authorization");
  });

  test("a request carrying a token it could not verify is not cached either", async () => {
    // It renders the anonymous bar, so the body is shareable — but the caller sent
    // credentials, and a response to those is not something to leave lying around
    // on the strength of what we made of them.
    const token = await signInternalToken({ aud: "https://wrong.audience" });
    const res = await app.request("/ssr", { headers: bearer(token) });
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  test("the same query with and without a token gets different caching", async () => {
    userInfoMock.respond = () => Response.json({ name: "Hallstein Bronskimlet" });
    const token = await signInternalToken({ sub: "auth0|abc123" });
    const authed = await app.request("/ssr?app=partner", { headers: bearer(token) });
    const anonymous = await app.request("/ssr?app=partner&loginUrl=/auth/login");
    expect(authed.headers.get("Cache-Control")).not.toBe(anonymous.headers.get("Cache-Control"));
  });
});
