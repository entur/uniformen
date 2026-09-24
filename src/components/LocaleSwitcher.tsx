import { LANGUAGE_LABEL, LOCALE_NAMES, type Locale } from "../types";
import { ChevronDownIcon } from "./icons/ChevronDownIcon";
import { GlobeIcon } from "./icons/GlobeIcon";
import { LocaleOptions } from "./LocaleOptions";

const PANEL_ID = "uniformen-locale-switcher-panel";

/**
 * Renders the language switcher as its own button in the top bar. It is for the
 * anonymous bar, which has no user menu. When there is a user menu, the switcher is
 * a section in it instead (`LocaleMenu`), so the bar never shows two language
 * controls.
 *
 * The button shows the name of the current language. On a login page the bar is
 * the only header, and users must see the language without opening anything.
 * `aria-label` also contains the name, because at mobile widths the text is hidden
 * and only the globe is shown. The label is in two languages, like the menu heading.
 */
export function LocaleSwitcher({
  availableLocales,
  locale,
}: {
  availableLocales: Locale[];
  locale: Locale;
}) {
  return (
    <div class="uniformen-locale-switcher">
      <button
        type="button"
        class="uniformen-top-nav__action uniformen-locale-switcher__toggle"
        aria-label={`${LANGUAGE_LABEL}: ${LOCALE_NAMES[locale]}`}
        aria-expanded="false"
        aria-haspopup="dialog"
        aria-controls={PANEL_ID}
        data-uniformen-locale-switcher-toggle
      >
        <GlobeIcon />
        <span class="uniformen-top-nav__action-label" lang={locale}>
          {LOCALE_NAMES[locale]}
        </span>
        <ChevronDownIcon />
      </button>
      <div
        id={PANEL_ID}
        class="uniformen-locale-switcher__panel"
        role="dialog"
        aria-label={LANGUAGE_LABEL}
      >
        <LocaleOptions availableLocales={availableLocales} locale={locale} label={LANGUAGE_LABEL} />
      </div>
    </div>
  );
}
