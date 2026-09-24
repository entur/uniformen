import type { Locale } from "../types";
import { BellIcon } from "./icons/BellIcon";

const texts = {
  "nb-NO": { varsler: "Varsler" },
  "nn-NO": { varsler: "Varsel" },
  "en-GB": { varsler: "Notifications" },
} as const;

/**
 * Renders the notifications button. It only shows an icon for now. There is no
 * notifications API to get an unread count from, so the button has no badge and
 * no click handler. It is shown in every bar on purpose, so the service needs no
 * option for it until it does something.
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
