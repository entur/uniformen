import type { Locale } from "../types";
import { BellIcon } from "./icons/BellIcon";

const texts = {
  "nb-NO": { varsler: "Varsler" },
  "nn-NO": { varsler: "Varsel" },
  "en-GB": { varsler: "Notifications" },
} as const;

/**
 * Notifications entry point. Visual only for now: there is no notifications API
 * to read an unread count from, so the button has no badge and no handler. It
 * ships in every bar regardless — deliberately, to keep the service knob-free
 * until there is something to wire it to.
 */
// TODO wire up to a notifications source (unread count + panel).
export function NotificationsButton({ locale }: { locale: Locale }) {
  const txt = texts[locale];
  return (
    <button type="button" class="uniformen-top-nav__action" aria-label={txt.varsler}>
      <BellIcon />
      <span class="uniformen-top-nav__action-label">{txt.varsler}</span>
    </button>
  );
}
