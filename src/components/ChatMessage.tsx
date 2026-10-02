import type { Locale } from "../types";
import { CustomerServiceIcon } from "./icons/CustomerServiceIcon";

export type ChatSender = "agent" | "user";

const texts = {
  "nb-NO": { you: "Deg", typing: "agenten skriver" },
  "nn-NO": { you: "Deg", typing: "agenten skriv" },
  "en-GB": { you: "You", typing: "The agent is typing" },
} as const;

/**
 * Returns one chat message, with a name bar above the bubble. The sender decides the
 * name, the icon, the colour and which side the message is on. With `typing`, the
 * bubble shows three animated dots that tell the user the agent is writing a reply.
 */
export function ChatMessage(
  props: { locale: Locale } & (
    | { sender: ChatSender; text: string; typing?: never }
    | { sender: "agent"; typing: true; text?: never }
  ),
) {
  const { sender, locale } = props;
  // "Partner Chat" is the name of the service, so it is not translated.
  const senders = {
    agent: { name: "Partner Chat", icon: <CustomerServiceIcon /> },
    user: { name: texts[locale].you, icon: null },
  } satisfies Record<ChatSender, { name: string; icon: unknown }>;
  const { name, icon } = senders[sender];
  return (
    <article class={`uniformen-chat-message uniformen-chat-message--${sender}`}>
      <p class="uniformen-chat-message__name">
        {icon}
        {name}
      </p>
      {"typing" in props ? (
        // Do not add role="status". The chat window is already a live region, and
        // screen readers do not handle a live region inside another one consistently.
        <p class="uniformen-chat-bubble uniformen-chat-typing">
          <span class="uniformen-chat-typing__dot" />
          <span class="uniformen-chat-typing__dot" />
          <span class="uniformen-chat-typing__dot" />
          <span class="uniformen-visually-hidden">{texts[locale].typing}</span>
        </p>
      ) : (
        <p class="uniformen-chat-bubble">{props.text}</p>
      )}
    </article>
  );
}
