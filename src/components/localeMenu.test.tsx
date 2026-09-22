import { describe, expect, test } from "bun:test";
import { LocaleMenu } from "./LocaleMenu";
import { UserMenu } from "./UserMenu";
import { renderComponentToString } from "../ssr/renderComponentToString";
import type { Locale } from "../types";

const render = (availableLocales: Locale[], locale: Locale = "nb-NO") =>
  renderComponentToString(<LocaleMenu availableLocales={availableLocales} locale={locale} />);

/**
 * The options as rendered, in document order. The label is read as the text after
 * the marker span rather than by stripping tags out of the row: an option is
 * `<button …><span class="…__marker"></span>Norsk bokmål</button>`, and matching
 * that shape is both exact and free of the half-sanitising a tag-stripping regex
 * would be.
 */
const options = (html: string): { locale: string; checked: boolean; label: string }[] =>
  [
    ...html.matchAll(
      /aria-checked="(true|false)" lang="([^"]+)"[^>]*>(?:<span[^>]*><\/span>)?([^<]*)<\/button>/g,
    ),
  ].map((match) => ({
    checked: match[1] === "true",
    locale: match[2] as string,
    label: match[3] as string,
  }));

/** The options' tab stops, in document order: which one Tab would reach. */
const tabstops = (html: string): (string | undefined)[] =>
  [...html.matchAll(/role="menuitemradio"[^>]*?tabindex="(-?\d+)"/g)].map((match) => match[1]);

describe("locale menu rendering", () => {
  test("offers exactly the languages it was given, in that order", async () => {
    const html = await render(["en-GB", "nb-NO"], "nb-NO");
    expect(options(html).map((option) => option.locale)).toEqual(["en-GB", "nb-NO"]);
    // Not the service's supported set: an app that translates two of three offers two.
    expect(html).not.toContain("nn-NO");
  });

  test("the current locale is the checked option, server-rendered", async () => {
    // No client state and no flash of the wrong label: the checked option is in
    // the markup the app receives.
    const html = await render(["nb-NO", "nn-NO", "en-GB"], "nn-NO");
    expect(
      options(html)
        .filter((option) => option.checked)
        .map((option) => option.locale),
    ).toEqual(["nn-NO"]);
  });

  test("each language is named in itself, never in the current one", async () => {
    // A label you can't read is one you can't pick your way out of.
    const html = await render(["nb-NO", "nn-NO", "en-GB"], "en-GB");
    expect(options(html).map((option) => option.label)).toEqual([
      "Norsk bokmål",
      "Norsk nynorsk",
      "English",
    ]);
  });

  test("the option's own tag is on the option, so it is pronounced as what it says", async () => {
    const html = await render(["nb-NO", "en-GB"], "nb-NO");
    expect(html).toContain('lang="en-GB"');
    expect(html).toContain('lang="nb-NO"');
  });

  test("the group is a labelled radio menu", async () => {
    const html = await render(["nb-NO", "en-GB"], "nb-NO");
    expect(html).toContain('role="menu"');
    expect(html).toContain('aria-labelledby="uniformen-locale-heading"');
    expect(html).toContain('id="uniformen-locale-heading"');
    expect(html.match(/role="menuitemradio"/g)).toHaveLength(2);
  });

  test("the group is one tab stop, on the checked option, as rendered", async () => {
    const html = await render(["nb-NO", "nn-NO", "en-GB"], "nn-NO");
    expect(tabstops(html)).toEqual(["-1", "0", "-1"]);
  });

  test("the heading is bilingual in every locale, unlike everything else in the bar", async () => {
    // It is the signpost for a user who cannot read the locale the page is in, so a
    // Norwegian page has to say "Language" too.
    for (const locale of ["nb-NO", "nn-NO", "en-GB"] as const) {
      expect(await render(["nb-NO", "en-GB"], locale)).toContain(">Språk / Language<");
    }
  });

  test("every option is a button: picking a language is not a navigation", async () => {
    // The app reloads once it has persisted the choice; a link would take the page
    // somewhere on its own.
    const html = await render(["nb-NO", "en-GB"], "nb-NO");
    expect(html).not.toContain("href=");
    expect(html.match(/type="button"/g)).toHaveLength(2);
    expect(html.match(/data-uniformen-locale="/g)).toHaveLength(2);
  });
});

describe("locale menu in the user menu", () => {
  const renderMenu = (availableLocales?: Locale[], simple?: boolean) =>
    renderComponentToString(
      <UserMenu
        user={{ name: "Navn Navnesen" }}
        locale="nb-NO"
        availableLocales={availableLocales}
        simple={simple}
        logoutUrl="/auth/logout"
      />,
    );

  test("the switcher sits between the links and the way out", async () => {
    const html = await renderMenu(["nb-NO", "en-GB"]);
    expect(html.indexOf("Mine tilganger")).toBeLessThan(html.indexOf("uniformen-locale-menu"));
    expect(html.indexOf("uniformen-locale-menu")).toBeLessThan(html.indexOf("Logg ut"));
  });

  test("no languages, no switcher: an app that translates nothing offers nothing", async () => {
    expect(await renderMenu()).not.toContain("uniformen-locale-menu");
    expect(await renderMenu([])).not.toContain("uniformen-locale-menu");
  });

  test("the simple menu keeps it, unlike the links above it", async () => {
    // The barebones menu is still a menu, and a language chip beside the chip that
    // opens it would be two controls where the bar has room for one.
    const html = await renderMenu(["nb-NO", "en-GB"], true);
    expect(html).toContain("uniformen-locale-menu");
    expect(html).not.toContain("Mine tilganger");
  });
});
