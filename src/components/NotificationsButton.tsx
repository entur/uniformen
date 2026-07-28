import { BellIcon } from "./icons/BellIcon";

/**
 * Notifications entry point. Visual only for now: there is no notifications API
 * to read an unread count from, so the button has no badge and no handler. It
 * ships in every bar regardless — deliberately, to keep the service knob-free
 * until there is something to wire it to.
 */
// TODO wire up to a notifications source (unread count + panel).
export function NotificationsButton() {
  // aria-label, not just the span: the label is hidden under the mobile
  // breakpoint, and the button still needs an accessible name there.
  return (
    <button type="button" class="uniformen-top-nav__action" aria-label="Varsler">
      <BellIcon />
      <span class="uniformen-top-nav__action-label">Varsler</span>
    </button>
  );
}
