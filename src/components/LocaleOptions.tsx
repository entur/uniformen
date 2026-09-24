import { LOCALE_NAMES, type Locale } from "../types";

/**
 * Renders the available languages as a group of radio menu items. The user menu and
 * the standalone switcher both use it, so they always offer the same options.
 *
 * The server renders the option for `locale` as checked. There is no client state,
 * and the wrong language is never shown. Clicks are handled in `localeHandlers`.
 *
 * `lang` on each option makes a screen reader pronounce "English" as English inside
 * a Norwegian page. That is also why the language names are not translated.
 *
 * A `role="menu"` group is one tab stop, so only the checked option has
 * `tabindex="0"`. It is set in the markup, not by script, so the tab stop is correct
 * before any script runs, and an app that hydrates this markup gets the same
 * attributes.
 */
export function LocaleOptions({
  availableLocales,
  locale,
  /** The id of the heading that names this group, if there is one. */
  labelledBy,
  /** The name of the group, used when there is no heading. */
  label,
}: {
  availableLocales: Locale[];
  locale: Locale;
  labelledBy?: string;
  label?: string;
}) {
  return (
    <div role="menu" aria-labelledby={labelledBy} aria-label={label}>
      {availableLocales.map((option) => (
        <button
          key={option}
          type="button"
          role="menuitemradio"
          aria-checked={option === locale ? "true" : "false"}
          lang={option}
          class="uniformen-user-menu__item uniformen-locale-menu__item"
          data-uniformen-locale={option}
          tabindex={option === locale ? 0 : -1}
        >
          {/* CSS draws the dot from `aria-checked`, so screen readers and the
              screen always show the same state. */}
          <span class="uniformen-locale-menu__marker" aria-hidden="true"></span>
          {LOCALE_NAMES[option]}
        </button>
      ))}
    </div>
  );
}
