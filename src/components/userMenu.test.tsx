import { describe, expect, test } from "bun:test";
import { UserMenu } from "./UserMenu";
import { renderComponentToString } from "../ssr/renderComponentToString";
import type { Environment } from "../config";
import type { Locale } from "../types";

// The test server always runs as dev (see test/authTestSetup). The menu takes the
// environment as a prop, so these tests can render the other environments too.
const ENVIRONMENTS: Environment[] = ["local", "dev", "staging", "production"];

/** Returns the hrefs in document order. */
const hrefs = (html: string): string[] =>
  [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1] as string);

// A typical logout path that a consuming app would pass in.
const LOGOUT_URL = "/auth/logout";

const render = (
  user: { name: string; email?: string },
  environment?: Environment,
  locale: Locale = "nb-NO",
  logoutUrl: string = LOGOUT_URL,
) =>
  renderComponentToString(
    <UserMenu user={user} environment={environment} locale={locale} logoutUrl={logoutUrl} />,
  );

describe("user menu rendering", () => {
  test("names the user on the chip and in the panel", async () => {
    const html = await render({ name: "Navn Navnesen" });
    expect(html.match(/Navn Navnesen/g)).toHaveLength(2);
  });

  test("the email is the panel's second line, and is left out when absent", async () => {
    const withEmail = await render({
      name: "Navn Navnesen",
      email: "navn.navnesen@entur.org",
    });
    expect(withEmail).toContain('class="uniformen-user-menu__email">navn.navnesen@entur.org<');

    const without = await render({ name: "Navn Navnesen" });
    expect(without).not.toContain("uniformen-user-menu__email");
  });

  test("the chip is a collapsed toggle wired to the panel", async () => {
    const html = await render({ name: "Navn Navnesen" });
    expect(html).toContain("data-uniformen-user-menu-toggle");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-controls="uniformen-user-menu-panel"');
    expect(html).toContain('id="uniformen-user-menu-panel"');
  });

  test("the account link points at Partner in the environment served", async () => {
    const expected: Record<Environment, string> = {
      // A local header links to dev, because the user cannot be sent to localhost.
      local: "https://entur-partner.dev.entur.org/permission-admin/my-profile",
      dev: "https://entur-partner.dev.entur.org/permission-admin/my-profile",
      staging: "https://entur-partner.staging.entur.org/permission-admin/my-profile",
      production: "https://entur-partner.entur.org/permission-admin/my-profile",
    };
    for (const env of ENVIRONMENTS) {
      const html = await render({ name: "Navn Navnesen" }, env);
      expect(hrefs(html)).toEqual([expected[env], "/auth/logout"]);
    }
  });

  test("the way out points where logoutUrl says, in every environment", async () => {
    for (const env of ENVIRONMENTS) {
      const html = await render({ name: "Navn Navnesen" }, env, "nb-NO", "/oauth/end");
      expect(html).toContain('href="/oauth/end"');
      expect(html).toContain(">Logg ut<");
    }
  });

  test("no logoutUrl, no way out: the menu is the rest of itself", async () => {
    const html = await renderComponentToString(
      <UserMenu user={{ name: "Navn Navnesen" }} locale="nb-NO" />,
    );
    expect(html).not.toContain("uniformen-user-menu__logout");
    expect(html).not.toContain("Logg ut");
    expect(html).toContain("Mine tilganger");
    expect(html).toContain('id="uniformen-user-menu-panel"');
  });

  test("a name long enough to break the layout is still rendered whole", async () => {
    const name = "Navnesen ".repeat(20).trim();
    const html = await render({ name });
    expect(html.match(/Navnesen/g)).toHaveLength(40);
  });

  test("the name is escaped, not interpolated", async () => {
    const html = await render({ name: "<script>alert(1)</script>", email: "a&b@entur.org" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("a&amp;b@entur.org");
  });

  test("every string in the menu follows the locale, the panel's own label included", async () => {
    const en = await render({ name: "Navn Navnesen" }, undefined, "en-GB");
    expect(en).toContain('aria-label="User menu"');
    expect(en).toContain(">My access<");
    expect(en).toContain(">Log out<");
    expect(en).not.toContain("Mine tilganger");

    const nn = await render({ name: "Navn Navnesen" }, undefined, "nn-NO");
    expect(nn).toContain('aria-label="Brukarmeny"');
    expect(nn).toContain(">Mine tilgangar<");

    expect(en).toContain("Navn Navnesen");
  });
});

describe("simple user menu", () => {
  const renderSimple = (user: { name: string; email?: string }) =>
    renderComponentToString(<UserMenu user={user} simple locale="nb-NO" logoutUrl={LOGOUT_URL} />);

  test("the way out is the only row", async () => {
    const html = await renderSimple({ name: "Navn Navnesen" });
    expect(hrefs(html)).toEqual(["/auth/logout"]);
    expect(html).not.toContain("Mine tilganger");
    expect(html).not.toContain("uniformen-user-menu__list");
  });

  test("the identity block stays: at mobile widths the chip is an icon alone", async () => {
    const html = await renderSimple({ name: "Navn Navnesen", email: "navn@entur.org" });
    expect(html).toContain('class="uniformen-user-menu__name">Navn Navnesen<');
    expect(html).toContain('class="uniformen-user-menu__email">navn@entur.org<');
  });

  test("the panel is marked simple, so the iconless indent can be dropped", async () => {
    const html = await renderSimple({ name: "Navn Navnesen" });
    expect(html).toContain("uniformen-user-menu__panel--simple");
    expect(
      await renderComponentToString(
        <UserMenu user={{ name: "N" }} locale="nb-NO" logoutUrl={LOGOUT_URL} />,
      ),
    ).not.toContain("uniformen-user-menu__panel--simple");
  });

  test("the toggle and panel are wired the same way, so one handler serves both forms", async () => {
    const html = await renderSimple({ name: "Navn Navnesen" });
    expect(html).toContain("data-uniformen-user-menu-toggle");
    expect(html).toContain('aria-controls="uniformen-user-menu-panel"');
    expect(html).toContain('id="uniformen-user-menu-panel"');
  });
});
