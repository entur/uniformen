import { LANGUAGE_LABEL, type Locale } from "../types";
import { LocaleOptions } from "./LocaleOptions";

const HEADING_ID = "uniformen-locale-heading";

/**
 * Renders the language switcher as a section of the signed-in user's menu. It is
 * also used in the `simple` menu. See `LocaleSwitcher` for the version used when
 * there is no user menu.
 *
 * The heading is in two languages for every locale. See `LANGUAGE_LABEL`.
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
