import { describe, expect, test } from "bun:test";
import { UserMenu } from "./UserMenu";
import { renderComponentToString } from "../ssr/renderComponentToString";
import type { Environment } from "../config";

// The server resolves its environment once at startup, so the suite as a whole
// only ever runs as one of them (dev, see test/authTestSetup). The menu takes the
// environment as a prop so the other environments' links can be rendered here.
const ENVIRONMENTS: Environment[] = ["local", "dev", "staging", "production"];

/** Hrefs in document order. */
const hrefs = (html: string): string[] =>
  [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1] as string);

const render = (user: { name: string; email?: string }, environment?: Environment) =>
  renderComponentToString(<UserMenu user={user} environment={environment} />);

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
      // Nobody can be sent to localhost, so a local header links to dev.
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

  test("logging out is relative in every environment, like logging in", async () => {
    // The session belongs to the consuming app, so the link has to resolve
    // against its host rather than ours or Partner's.
    for (const env of ENVIRONMENTS) {
      const html = await render({ name: "Navn Navnesen" }, env);
      expect(html).toContain('href="/auth/logout"');
      expect(html).toContain(">Logg ut<");
    }
  });

  test("a name long enough to break the layout is still rendered whole", async () => {
    // The panel bounds its own width in CSS; nothing here truncates the name.
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
});
