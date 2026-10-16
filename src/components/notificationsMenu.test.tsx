import { describe, expect, test } from "bun:test";
import { NotificationsMenu } from "./NotificationsMenu";
import { renderComponentToString } from "../ssr/renderComponentToString";
import type { Locale, NotificationList } from "../types";

// The test server always runs as dev (see test/authTestSetup), and the menu reads the
// environment from the config, so every link points at Partner in dev.
const PERMISSION_ADMIN = "https://entur-partner.dev.entur.org/permission-admin";

/** Returns the hrefs in document order. */
const hrefs = (html: string): string[] =>
  [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1] as string);

const notification = (overrides: Partial<NotificationList[number]> = {}) => ({
  referenceId: "42",
  date: "2026-10-01T09:00:00Z",
  message: "Navn Navnesen ber om tilgang",
  ...overrides,
});

const render = (notifications?: NotificationList, locale: Locale = "nb-NO") =>
  renderComponentToString(<NotificationsMenu locale={locale} notifications={notifications} />);

describe("notifications menu", () => {
  test("the bell is a collapsed toggle wired to its panel, like the bar's others", async () => {
    const html = await render([notification()]);
    expect(html).toContain("data-uniformen-notifications-menu-toggle");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-controls="uniformen-notifications-menu-panel"');
    expect(html).toContain('id="uniformen-notifications-menu-panel"');
  });

  test("the panel is a named dialog, so it is announced when it opens", async () => {
    expect(await render([notification()])).toContain('role="dialog" aria-label="Varsler"');
    expect(await render([notification()], "en-GB")).toContain(
      'role="dialog" aria-label="Notifications"',
    );
  });

  // Skipped till read-action for notifications is implemented
  test.skip("the red dot has a spoken equivalent: the accessible name says whether there is news", async () => {
    expect(await render([notification()])).toContain('aria-label="Nye varsler"');
    expect(await render([])).toContain('aria-label="Ingen nye varsler"');

    expect(await render([notification()], "nn-NO")).toContain('aria-label="Nye varslar"');
    expect(await render([], "nn-NO")).toContain('aria-label="Ingen nye varslar"');

    expect(await render([notification()], "en-GB")).toContain('aria-label="New notifications"');
    expect(await render([], "en-GB")).toContain('aria-label="No new notifications"');
  });

  test("the dot's class is on the bell only when there is something new", async () => {
    expect(await render([notification()])).toContain("uniformen-notifications-button__badge");
    expect(await render([])).not.toContain("uniformen-notifications-button__badge");
    expect(await render()).not.toContain("uniformen-notifications-button__badge");
  });

  test("a notification's own text is kept out of PostHog autocapture", async () => {
    const html = await render([notification({ message: "Navn Navnesen ber om tilgang" })]);
    const text = html.indexOf("Navn Navnesen");
    const marker = html.lastIndexOf("ph-no-capture", text);
    // The name must be inside the element that carries the class, not before it.
    expect(marker).toBeGreaterThan(-1);
    expect(html.slice(marker, text)).not.toContain("</div>");
  });

  test("an item with a referenceId links to that request, one without goes to the profile", async () => {
    const html = await render([
      notification({ referenceId: "7" }),
      notification({ referenceId: null, message: "Du har fått en ny rolle" }),
    ]);
    expect(hrefs(html)).toEqual([
      `${PERMISSION_ADMIN}/requests/request/7`,
      `${PERMISSION_ADMIN}/my-profile`,
      `${PERMISSION_ADMIN}/requests`,
    ]);
  });

  test("the footer leaves for the request list, not the embedding app's front page", async () => {
    const html = await render();
    expect(hrefs(html)).toEqual([`${PERMISSION_ADMIN}/requests`]);
  });

  test("the panel shows five items at most, and the footer counts them all", async () => {
    const many = Array.from({ length: 8 }, (_, index) =>
      notification({ referenceId: String(index), message: `Varsel ${index}` }),
    );
    const html = await render(many);
    expect(html.match(/uniformen-notifications-menu__item"/g)).toHaveLength(5);
    expect(html).toContain(">Se alle 8 hendelser<");
    expect(html).toContain("Varsel 4");
    expect(html).not.toContain("Varsel 5");
  });

  test("an empty list says so, and the footer drops the count", async () => {
    const html = await render([]);
    expect(html).toContain(">Ingen nye varsler<");
    expect(html).not.toContain("uniformen-notifications-menu__list");
    expect(html).toContain(">Se alle hendelser<");
  });

  test("no notifications at all reads the same as an empty list", async () => {
    expect(await render()).toContain(">Ingen nye varsler<");
  });

  test("every string in the menu follows the locale", async () => {
    const nn = await render([notification()], "nn-NO");
    expect(nn).toContain(">Varsel<");
    expect(nn).toContain(">Sjå alle 1 hendingar<");

    const en = await render([], "en-GB");
    expect(en).toContain(">No new notifications<");
    expect(en).toContain(">See all notifications<");
    expect(en).not.toContain("hendelser");
  });

  test("a message is escaped, not interpolated", async () => {
    const html = await render([notification({ message: "<script>alert(1)</script>" })]);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
