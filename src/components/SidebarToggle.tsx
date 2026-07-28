import { SidebarToggleIcon } from "./icons/SidebarToggleIcon";

/**
 * Collapse/expand control for the consuming app's side navigation. Uniformen
 * renders no sidebar itself, so the button only flips `aria-expanded` and
 * dispatches `uniformen:toggle-sidebar` on `window`.
 *
 * `expanded` is the app's starting state: an app that restores a collapsed
 * sidebar has to say so, or the button ships out of sync with what the user
 * sees and the first click looks like a no-op.
 */
export function SidebarToggle({ expanded }: { expanded: boolean }) {
  return (
    <button
      type="button"
      class="uniformen-icon-button uniformen-top-nav__sidebar-toggle"
      aria-label="Skjul eller vis sidemeny"
      aria-expanded={expanded ? "true" : "false"}
      data-uniformen-sidebar-toggle
    >
      <SidebarToggleIcon />
    </button>
  );
}
