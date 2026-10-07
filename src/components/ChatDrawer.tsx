import type { Locale } from "../types";
import { ChatMessage } from "./ChatMessage";
import { ChatTextArea } from "./ChatTextArea";
import { CloseIcon } from "./icons/CloseIcon";
import { MapIcon } from "./icons/MapIcon";
import { NewChatButton } from "./NewChatButton";

const texts = {
  "nb-NO": {
    close: "Lukk skuff",
    agentWelcomeText: "Hei! Hva lurer du på?",
    userLocation: "Du er her: ",
    unspecifiedLocation: "hjemmesiden",
    examples: [
      "Hvordan endrer jeg passord?",
      "Hvordan gir jeg en kollega tilgang?",
      "Hvor finner jeg fakturaene mine?",
    ],
  },
  "nn-NO": {
    close: "Lukk skuff",
    agentWelcomeText: "Hei! Kva lurer du på?",
    userLocation: "Du er her: ",
    unspecifiedLocation: "heimesida",
    examples: [
      "Korleis endrar eg passord?",
      "Korleis gir eg ein kollega tilgang?",
      "Kvar finn eg fakturaene mine?",
    ],
  },
  "en-GB": {
    close: "Close drawer",
    agentWelcomeText: "Hi! What would you like to know?",
    userLocation: "You are here: ",
    unspecifiedLocation: "homepage",
    examples: [
      "How do I change my password?",
      "How do I give a colleague access?",
      "Where can I find my invoices?",
    ],
  },
} as const;

/**
 * Renders the AI agent's chat drawer. It is hidden until the user clicks the AI agent
 * button, and then it slides in from the right side of the window.
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
      <div class="uniformen-chat-window" role="log">
        <ChatMessage sender="agent" text={txt.agentWelcomeText} locale={locale} />
        <ChatMessage sender="system" questions={txt.examples} locale={locale} />
      </div>
      {/* The browser copies these messages into the chat. See `aiAgentHandlers`. */}
      <template data-uniformen-chat-user-template>
        <ChatMessage sender="user" text="" locale={locale} />
      </template>
      <template data-uniformen-chat-typing-template>
        <ChatMessage sender="agent" typing locale={locale} />
      </template>
      <ChatTextArea locale={locale} />
      <div class="uniformen-chat-drawer__footer">
        <div class="uniformen-chat-drawer__location">
          <MapIcon />
          {/* One element, so the label and the location wrap together as one text. */}
          <span>
            {txt.userLocation}{" "}
            {/* The browser replaces this text with the current path when the path is
                not empty. See `aiAgentHandlers`. */}
            <span class="uniformen-chat-drawer__location-name">{txt.unspecifiedLocation}</span>
          </span>
        </div>
        <NewChatButton locale={locale} />
      </div>
    </div>
  );
}
