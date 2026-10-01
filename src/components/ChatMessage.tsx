import type { Locale } from "../types";
import { CustomerServiceIcon } from "./icons/CustomerServiceIcon";

export type ChatSender = "agent" | "user";

const texts = {
  "nb-NO": { you: "Deg" },
  "nn-NO": { you: "Deg" },
  "en-GB": { you: "You" },
} as const;

/**
 * Returns one chat message, with a name bar above the bubble. The sender decides the
 * name, the icon, the colour and which side the message is on.
 */
export function ChatMessage({
  sender,
  text,
  locale,
}: {
  sender: ChatSender;
  text: string;
  locale: Locale;
}) {
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
      <p class="uniformen-chat-bubble">{text}</p>
    </article>
  );
}
