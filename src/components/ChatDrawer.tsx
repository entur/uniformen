import type { ChatAccessToken } from "../chat/chatProxy";
import type { Locale } from "../types";
import { examplesByApp } from "./chatExamples";
import { ChatMessage } from "./ChatMessage";
import { ChatTextArea } from "./ChatTextArea";
import { CloseIcon } from "./icons/CloseIcon";
import { NewChatButton } from "./NewChatButton";
import type { PortalApplicationId } from "./portalApplications";

const texts = {
  "nb-NO": {
    close: "Lukk skuff",
    agentWelcomeText: "Hei! Hva lurer du på?",
    error: "Beklager, jeg kunne ikke svare nå. Prøv igjen litt senere.",
    errorRefresh: "Samtalen har vært åpen for lenge. Last inn nettsiden på nytt og prøv igjen.",
    errorRateLimit: "Du sender spørsmål for raskt. Vent litt og prøv igjen.",
    errorTooManyChats: "Du har for mange samtaler åpne samtidig. Vent litt og prøv igjen.",
    restarted:
      "Samtalen ble tidsavbrutt og startet på nytt. Assistenten husker ikke meldingene over.",
    examples: ["Hvor er jeg?", "Hva kan du hjelpe meg med?", "Hvem kontakter man ved problemer?"],
  },
  "nn-NO": {
    close: "Lukk skuff",
    agentWelcomeText: "Hei! Kva lurer du på?",
    error: "Beklagar, eg kunne ikkje svare no. Prøv igjen litt seinare.",
    errorRefresh: "Samtalen har vore open for lenge. Last inn nettsida på nytt og prøv igjen.",
    errorRateLimit: "Du sender spørsmål for raskt. Vent litt og prøv igjen.",
    errorTooManyChats: "Du har for mange samtalar opne samtidig. Vent litt og prøv igjen.",
    restarted:
      "Samtalen vart tidsavbroten og starta på nytt. Assistenten hugsar ikkje meldingane over.",
    examples: ["Kvar er eg?", "Kva kan du hjelpe meg med?", "Kven kontaktar ein ved problem?"],
  },
  "en-GB": {
    close: "Close drawer",
    agentWelcomeText: "Hi! What would you like to know?",
    error: "Sorry, I could not answer right now. Please try again later.",
    errorRefresh:
      "The conversation has been open for too long. Please refresh the website and try again.",
    errorRateLimit: "You are sending questions too fast. Please wait a moment and try again.",
    errorTooManyChats:
      "You have too many chats open at the same time. Please wait a moment and try again.",
    restarted:
      "The conversation timed out and was restarted. The assistant does not remember the messages above.",
    examples: [
      "Where am I?",
      "What can you help me with?",
      "Who do I contact if there are problems?",
    ],
  },
} as const;

//The text at the top of the chat-drawer
const drawerName = "Sporai";

/**
 * Renders the AI agent's chat drawer. It is hidden until the user clicks the AI agent
 * button, and then it slides in from the right side of the window.
 */
export function ChatDrawer({
  locale,
  chatAccessToken,
  appName, //used to specify chat-responder
  activeAppId,
}: {
  locale: Locale;
  /** Without it, every question gets the error text. */
  chatAccessToken?: ChatAccessToken;
  appName?: string;
  /** Picks the example questions. Without it, or without questions for it, the general ones are used. */
  activeAppId?: PortalApplicationId;
}) {
  const txt = texts[locale];
  const examples = (activeAppId && examplesByApp[activeAppId]?.[locale]) ?? txt.examples;
  return (
    <div
      hidden
      id="uniformen-chat-drawer"
      data-uniformen-chat-proxy-url={chatAccessToken?.url}
      data-uniformen-chat-error-text={txt.error}
      data-uniformen-chat-error-text-refresh={txt.errorRefresh}
      data-uniformen-chat-error-text-rate-limit={txt.errorRateLimit}
      data-uniformen-chat-error-text-too-many-chats={txt.errorTooManyChats}
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
        {drawerName}
      </h2>
      <div class="uniformen-chat-window" role="log">
        <ChatMessage sender="agent" text={txt.agentWelcomeText} locale={locale} appName={appName} />
        <ChatMessage sender="system" questions={examples} locale={locale} />
      </div>
      {/* The browser copies these messages into the chat. See `aiAgentHandlers`. */}
      <template data-uniformen-chat-user-template>
        <ChatMessage sender="user" text="" locale={locale} />
      </template>
      <template data-uniformen-chat-agent-template>
        <ChatMessage sender="agent" text="" locale={locale} appName={appName} />
      </template>
      <template data-uniformen-chat-typing-template>
        <ChatMessage sender="agent" typing locale={locale} appName={appName} />
      </template>
      <template data-uniformen-chat-restarted-template>
        <p class="uniformen-chat-restarted">{txt.restarted}</p>
      </template>
      <ChatTextArea locale={locale} />
      <div class="uniformen-chat-drawer__footer">
        <NewChatButton locale={locale} />
      </div>
    </div>
  );
}
