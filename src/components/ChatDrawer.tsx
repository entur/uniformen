import type { ChatAccessToken } from "../chat/chatProxy";
import type { Locale } from "../types";
import { locationNames } from "./chatLocations";
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
    unspecifiedLocation: "Hjemmesiden",
    error: "Beklager, jeg kunne ikke svare nå. Prøv igjen litt senere.",
    errorRefresh: "Samtalen har vært åpen for lenge. Last inn nettsiden på nytt og prøv igjen.",
    errorRateLimit: "Du sender spørsmål for raskt. Vent litt og prøv igjen.",
    errorTooManyChats: "Du har for mange samtaler åpne samtidig. Vent litt og prøv igjen.",
    restarted:
      "Samtalen ble tidsavbrutt og startet på nytt. Assistenten husker ikke meldingene over.",
    examples: [
      "Hvor ser jeg mine avtaler?",
      "Hvor kan jeg se terminalrapporter?",
      "Hvem kontakter man ved problemer?",
    ],
  },
  "nn-NO": {
    close: "Lukk skuff",
    agentWelcomeText: "Hei! Kva lurer du på?",
    userLocation: "Du er her: ",
    unspecifiedLocation: "Heimesida",
    error: "Beklagar, eg kunne ikkje svare no. Prøv igjen litt seinare.",
    errorRefresh: "Samtalen har vore open for lenge. Last inn nettsida på nytt og prøv igjen.",
    errorRateLimit: "Du sender spørsmål for raskt. Vent litt og prøv igjen.",
    errorTooManyChats: "Du har for mange samtalar opne samtidig. Vent litt og prøv igjen.",
    restarted:
      "Samtalen vart tidsavbroten og starta på nytt. Assistenten hugsar ikkje meldingane over.",
    examples: [
      "Kvar ser eg avtalene mine?",
      "Kvar kan eg sjå terminalrapportar?",
      "Kven kontaktar ein ved problem?",
    ],
  },
  "en-GB": {
    close: "Close drawer",
    agentWelcomeText: "Hi! What would you like to know?",
    userLocation: "You are here: ",
    unspecifiedLocation: "Homepage",
    error: "Sorry, I could not answer right now. Please try again later.",
    errorRefresh:
      "The conversation has been open for too long. Please refresh the website and try again.",
    errorRateLimit: "You are sending questions too fast. Please wait a moment and try again.",
    errorTooManyChats:
      "You have too many chats open at the same time. Please wait a moment and try again.",
    restarted:
      "The conversation timed out and was restarted. The assistant does not remember the messages above.",
    examples: [
      "Where can I see my agreements?",
      "Where can I see terminal reports?",
      "Who do I contact if there are problems?",
    ],
  },
} as const;

/**
 * Renders the AI agent's chat drawer. It is hidden until the user clicks the AI agent
 * button, and then it slides in from the right side of the window.
 */
export function ChatDrawer({
  locale,
  chatAccessToken,
}: {
  locale: Locale;
  /** Without it, every question gets the error text. */
  chatAccessToken?: ChatAccessToken;
}) {
  const txt = texts[locale];
  return (
    <div
      hidden
      id="uniformen-chat-drawer"
      data-uniformen-chat-proxy-url={chatAccessToken?.url}
      data-uniformen-chat-error-text={txt.error}
      data-uniformen-chat-error-text-refresh={txt.errorRefresh}
      data-uniformen-chat-error-text-rate-limit={txt.errorRateLimit}
      data-uniformen-chat-error-text-too-many-chats={txt.errorTooManyChats}
      data-uniformen-chat-locations={JSON.stringify(locationNames[locale])}
      role="dialog"
      aria-modal="false"
      aria-labelledby="uniformen-chat-drawer-title"
      class="uniformen-chat-drawer"
      // A click on text or empty space in the drawer then puts focus on the drawer,
      // so Escape still closes it.
      tabindex={-1}
    >
      {/* `ph-no-capture` stops PostHog session replay from recording the token. The
          class must not be on the drawer, because autocapture should still record
          clicks on the drawer's buttons. */}
      {chatAccessToken && (
        <div hidden class="ph-no-capture" data-uniformen-chat-token={chatAccessToken.token} />
      )}
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
      <template data-uniformen-chat-agent-template>
        <ChatMessage sender="agent" text="" locale={locale} />
      </template>
      <template data-uniformen-chat-typing-template>
        <ChatMessage sender="agent" typing locale={locale} />
      </template>
      <template data-uniformen-chat-restarted-template>
        <p class="uniformen-chat-restarted">{txt.restarted}</p>
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
