import type { Locale } from "../types";
import { RefreshIcon } from "./icons/RefreshIcon";

const texts = {
  "nb-NO": { newChat: "Ny samtale" },
  "nn-NO": { newChat: "Ny samtale" },
  "en-GB": { newChat: "New chat" },
} as const;

/**
 * Renders the new chat button. It looks like the secondary button in the Entur
 * design system. It has no click handler yet.
 */
// TODO clears the chat when the button is clicked.
export function NewChatButton({ locale }: { locale: Locale }) {
  const txt = texts[locale];
  return (
    <button
      type="button"
      class="uniformen-new-chat-button uniformen-top-nav__action uniformen-top-nav__action--secondary"
    >
      <RefreshIcon />
      <span>{txt.newChat}</span>
    </button>
  );
}
