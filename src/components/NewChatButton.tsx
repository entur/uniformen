import type { Locale } from "../types";
import { RefreshIcon } from "./icons/RefreshIcon";

const texts = {
  "nb-NO": { newChat: "Ny samtale" },
  "nn-NO": { newChat: "Ny samtale" },
  "en-GB": { newChat: "New chat" },
} as const;

/**
 * Renders the button that starts a new chat. It looks like the secondary button in
 * the Entur design system.
 */
export function NewChatButton({ locale }: { locale: Locale }) {
  const txt = texts[locale];
  return (
    <button
      type="button"
      class="uniformen-new-chat-button uniformen-top-nav__action uniformen-top-nav__action--secondary"
      data-uniformen-new-chat
    >
      <RefreshIcon />
      <span>{txt.newChat}</span>
    </button>
  );
}
