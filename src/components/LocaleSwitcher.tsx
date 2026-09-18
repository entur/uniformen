import { LANGUAGE_LABEL, LOCALE_NAMES, type Locale } from "../types";
import { ChevronDownIcon } from "./icons/ChevronDownIcon";
import { GlobeIcon } from "./icons/GlobeIcon";
import { LocaleOptions } from "./LocaleOptions";

const PANEL_ID = "uniformen-locale-switcher-panel";

/**
 * The language switcher as a control of its own, for the bar that has no user menu
 * to hold it: the anonymous one. Wherever there is a menu, `simple` or not, the
 * switcher is a section of it (`LocaleMenu`) — one control on screen, not two chips
 * side by side saying different things.
 *
 * The chip names the current language rather than only marking the panel: on a login
 * page the bar is the whole chrome, and which language the page is in has to be
 * readable without opening anything. `aria-label` repeats it for the mobile
 * breakpoint, where the label is hidden and the globe stands alone — bilingual, like
 * everywhere else the control names itself.
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
