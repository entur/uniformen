import type { Locale } from "../types";
import { SidebarToggleIcon } from "./icons/SidebarToggleIcon";

const texts = {
  "nb-NO": { skjulEllerVisSidemeny: "Skjul eller vis sidemeny" },
  "nn-NO": { skjulEllerVisSidemeny: "Skjul eller vis sidemeny" },
  "en-GB": { skjulEllerVisSidemeny: "Hide or show side menu" },
} as const;

/**
 * Renders the button that collapses and expands the consuming app's sidebar.
 * Uniformen does not render a sidebar. A click toggles `data-uniformen-sidebar` on
 * `<html>`, and the app styles its sidebar from it. See `sidebarHandlers`.
 *
 * No click handler is attached here, and CSS picks the icon from the attribute.
 * `aria-expanded` is rendered as `true` to match an expanded sidebar. Script fixes
 * it on load, because CSS cannot set it.
 */
export function SidebarToggle({ locale }: { locale: Locale }) {
  const txt = texts[locale];
  return (
    <button
      type="button"
      class="uniformen-icon-button uniformen-top-nav__sidebar-toggle"
      aria-label={txt.skjulEllerVisSidemeny}
      aria-expanded="true"
      data-uniformen-sidebar-toggle
    >
      <SidebarToggleIcon />
    </button>
  );
}
