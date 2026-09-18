import type { Locale } from "../types";
import { SidebarToggleIcon } from "./icons/SidebarToggleIcon";

const texts = {
  "nb-NO": { skjulEllerVisSidemeny: "Skjul eller vis sidemeny" },
  "nn-NO": { skjulEllerVisSidemeny: "Skjul eller vis sidemeny" },
  "en-GB": { skjulEllerVisSidemeny: "Hide or show side menu" },
} as const;

/**
 * Collapse/expand control for the consuming app's side navigation. Uniformen
 * renders no sidebar itself. Clicking flips `data-uniformen-sidebar` on `<html>`
 * and the app reacts to that (see `sidebarHandlers`).
 *
 * Nothing is bound here: the head script delegates the click and restores the state
 * before this markup is parsed, and the icon follows the root attribute in CSS.
 * `aria-expanded` is the one thing rendered here that script has to correct on load,
 * since it can't be derived in CSS. The default matches an expanded sidebar.
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
