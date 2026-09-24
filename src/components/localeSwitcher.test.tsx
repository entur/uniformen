import { describe, expect, test } from "bun:test";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { TopNavigation } from "../ssr/TopNavigation";
import { renderComponentToString } from "../ssr/renderComponentToString";
import type { Locale } from "../types";

const render = (availableLocales: Locale[], locale: Locale = "nb-NO") =>
  renderComponentToString(<LocaleSwitcher availableLocales={availableLocales} locale={locale} />);

describe("locale switcher", () => {
  test("the chip is a collapsed toggle wired to its panel, like the bar's others", async () => {
    const html = await render(["nb-NO", "en-GB"]);
    expect(html).toContain("data-uniformen-locale-switcher-toggle");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-controls="uniformen-locale-switcher-panel"');
    expect(html).toContain('id="uniformen-locale-switcher-panel"');
  });

  test("the chip names the current language, in that language", async () => {
    const html = await render(["nb-NO", "en-GB"], "en-GB");
    expect(html).toContain('class="uniformen-top-nav__action-label" lang="en-GB">English<');
  });

  test("the accessible name survives the breakpoint that hides the label", async () => {
    expect(await render(["nb-NO", "en-GB"])).toContain(
      'aria-label="Språk / Language: Norsk bokmål"',
    );
    expect(await render(["nb-NO", "en-GB"], "en-GB")).toContain(
      'aria-label="Språk / Language: English"',
    );
  });

  test("the panel holds the same radio group the user menu's section does", async () => {
    const html = await render(["nb-NO", "nn-NO", "en-GB"], "nn-NO");
    expect(html).toContain('role="dialog"');
    expect(html).toContain('role="menu"');
    expect(html.match(/role="menuitemradio"/g)).toHaveLength(3);
    expect(html).toContain('aria-checked="true" lang="nn-NO"');
    expect(html.match(/data-uniformen-locale="/g)).toHaveLength(3);
    expect(html.match(/tabindex="-1"/g)).toHaveLength(2);
    expect(html).toContain('data-uniformen-locale="nn-NO" tabindex="0"');
    expect(html).toContain('aria-label="Språk / Language"');
  });
});

describe("which control the bar renders", () => {
  const user = { name: "Navn Navnesen" };
  const bar = (props: {
    user?: { name: string };
    simple?: boolean;
    availableLocales?: Locale[];
    loginUrl?: string;
  }) => renderComponentToString(<TopNavigation locale="nb-NO" {...props} />);

  const hasChip = (html: string) => html.includes("data-uniformen-locale-switcher-toggle");
  const hasSection = (html: string) => html.includes("uniformen-locale-menu__heading");

  test("signed in, barebones or not: the user menu holds it", async () => {
    for (const props of [
      { user, availableLocales: ["nb-NO", "en-GB"] as Locale[] },
      { user, simple: true, availableLocales: ["nb-NO", "en-GB"] as Locale[] },
    ]) {
      const html = await bar(props);
      expect(hasSection(html)).toBe(true);
      expect(hasChip(html)).toBe(false);
    }
  });

  test("no user menu to hold it — the anonymous bar — and it is a chip of its own", async () => {
    for (const props of [
      { availableLocales: ["nb-NO", "en-GB"] as Locale[] },
      { simple: true, availableLocales: ["nb-NO", "en-GB"] as Locale[] },
    ]) {
      const html = await bar(props);
      expect(hasChip(html)).toBe(true);
      expect(hasSection(html)).toBe(false);
    }
  });

  test("the chip leads the login link: language is chrome, not identity", async () => {
    const anonymous = await bar({ availableLocales: ["nb-NO", "en-GB"], loginUrl: "/auth/login" });
    expect(anonymous.indexOf("uniformen-locale-switcher")).toBeLessThan(
      anonymous.indexOf('href="/auth/login"'),
    );
  });

  test("no languages, no control, whichever bar it is", async () => {
    for (const props of [{}, { simple: true }, { user }, { user, simple: true }]) {
      const html = await bar({ ...props, availableLocales: [] });
      expect(hasChip(html)).toBe(false);
      expect(hasSection(html)).toBe(false);
    }
  });
});
