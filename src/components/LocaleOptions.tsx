import { LOCALE_NAMES, type Locale } from "../types";

/**
 * The languages on offer, as a group of radio items — the same list whether it is a
 * section of the user menu or the standalone switcher's panel, so the two can't
 * drift in what they offer or how they announce it.
 *
 * `locale` is checked, server-rendered: no client state, and no flash of the wrong
 * language. A pick only announces itself — `localeHandlers` dispatches
 * `uniformen:locale` and the app does the rest — so nothing here re-labels or
 * re-checks anything.
 *
 * `lang` on each option is what makes a screen reader pronounce "English" as English
 * inside a Norwegian document, and it is why the labels are not translated.
 *
 * The group is one tab stop, not one per option — what `role="menu"` promises — so
 * exactly one option carries `tabindex="0"`: the checked one. Rendered rather than
 * scripted, so the arrows work from the first keypress, and an app hydrating this
 * markup into its own tree finds the attributes it rendered.
 */
export function LocaleOptions({
  availableLocales,
  locale,
  /** The heading naming this group, when the surrounding markup renders one. */
  labelledBy,
  /** The group's name where there is no heading to point at. */
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
          {/* The dot is drawn in CSS off `aria-checked`, so the state a reader
              announces and the state an eye sees are the same attribute. */}
          <span class="uniformen-locale-menu__marker" aria-hidden="true"></span>
          {LOCALE_NAMES[option]}
        </button>
      ))}
    </div>
  );
}
