import { LANGUAGE_LABEL, type Locale } from "../types";
import { LocaleOptions } from "./LocaleOptions";

const HEADING_ID = "uniformen-locale-heading";

/**
 * The language switcher as a section of the signed-in user's menu, which is where it
 * lives whenever there is a menu to hold it — the barebones `simple` menu included.
 * The bar's own control (`LocaleSwitcher`) is for the anonymous bar, which has none.
 *
 * The heading is bilingual whatever the locale: see `LANGUAGE_LABEL`.
 */
export function LocaleMenu({
  availableLocales,
  locale,
}: {
  availableLocales: Locale[];
  locale: Locale;
}) {
  return (
    <div class="uniformen-locale-menu">
      <span class="uniformen-locale-menu__heading" id={HEADING_ID}>
        {LANGUAGE_LABEL}
      </span>
      <LocaleOptions availableLocales={availableLocales} locale={locale} labelledBy={HEADING_ID} />
    </div>
  );
}
