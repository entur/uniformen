import type { Locale } from "../types";
import { ChatMessage } from "./ChatMessage";
import { ChatTextArea } from "./ChatTextArea";
import { CloseIcon } from "./icons/CloseIcon";
import { MapIcon } from "./icons/MapIcon";
import { NewChatButton } from "./NewChatButton";

const texts = {
  "nb-NO": {
    aiAgent: "KI agent",
    close: "Lukk skuff",
    agentPlaceholder: "Hei! Hva lurer du på?",
    userPlaceholder: "Hvordan endrer jeg passord?",
    userLocation: "Du er her: ",
    unspecifiedLocation: "hjemmesiden",
  },
  "nn-NO": {
    aiAgent: "KI agent",
    close: "Lukk skuff",
    agentPlaceholder: "Hei! Kva lurer du på?",
    userPlaceholder: "Korleis endrar eg passord?",
    userLocation: "Du er her: ",
    unspecifiedLocation: "heimesida",
  },
  "en-GB": {
    aiAgent: "AI agent",
    close: "Close drawer",
    agentPlaceholder: "Hi! What would you like to know?",
    userPlaceholder: "How do I change my password?",
    userLocation: "You are here: ",
    unspecifiedLocation: "homepage",
  },
} as const;

/**
 * Renders the Chat drawer.
 * It is a drawer that slides in from the right side of the screen.
 */
export function ChatDrawer({ locale }: { locale: Locale }) {
  const txt = texts[locale];
  return (
    <div
      hidden
      id="uniformen-chat-drawer"
      role="dialog"
      aria-modal="false"
      aria-labelledby="uniformen-chat-drawer-title"
      class="uniformen-chat-drawer"
    >
      <button
        type="button"
        class="uniformen-icon-button uniformen-chat-drawer__close"
        aria-label={txt.close}
        data-uniformen-chat-drawer-close
      >
        <CloseIcon />
      </button>
      <h2 class="uniformen-chat-drawer__title" id="uniformen-chat-drawer-title">
        Sporai
      </h2>
      {/* TODO: Remove these placeholder messages when the chat shows real messages. */}
      <div class="uniformen-chat-window" role="log">
        <ChatMessage sender="agent" text={txt.agentPlaceholder} locale={locale} />
        <ChatMessage sender="user" text={txt.userPlaceholder} locale={locale} />
        <ChatMessage sender="agent" typing locale={locale} />
      </div>
      <ChatTextArea locale={locale} />
      <div class="uniformen-chat-drawer__footer">
        <div class="uniformen-chat-drawer__location">
          <MapIcon />
          {/* One element, so the label and the location wrap together as one text. */}
          <span>
            {txt.userLocation}{" "}
            {/* The browser replaces this text with the current path, if a location is specified. See `aiAgentHandlers`. */}
            <span class="uniformen-chat-drawer__location-name">{txt.unspecifiedLocation}</span>
          </span>
        </div>
        <NewChatButton locale={locale} />
      </div>
    </div>
  );
}
