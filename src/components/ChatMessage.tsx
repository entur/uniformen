import type { Locale } from "../types";
import { CommentIcon } from "./icons/CommentIcon";
import { CustomerServiceIcon } from "./icons/CustomerServiceIcon";

export type ChatSender = "agent" | "user" | "system";

const texts = {
  "nb-NO": { you: "Du", typing: "agenten skriver", faq: "Ofte stilte spørsmål" },
  "nn-NO": { you: "Du", typing: "agenten skriv", faq: "Ofte stilte spørsmål" },
  "en-GB": { you: "You", typing: "The agent is typing", faq: "Frequently asked questions" },
} as const;

/**
 * Returns one chat message, with a name bar above the bubble. The sender decides the
 * name, the icon, the colour and which side the message is on. With `typing`, the
 * bubble shows three animated dots that tell the user the agent is writing a reply.
 * A system message shows `questions` as buttons the user can click to ask them.
 */
export function ChatMessage(
  props: { locale: Locale } & (
    | { sender: "agent" | "user"; text: string; typing?: never }
    | { sender: "agent"; typing: true; text?: never }
    | { sender: "system"; questions: readonly string[] }
  ),
) {
  const { sender, locale } = props;
  // "Partner Chat" is the name of the service, so it is not translated.
  const senders = {
    agent: { name: "Partner Chat", icon: <CustomerServiceIcon /> },
    user: { name: texts[locale].you, icon: null },
    system: { name: texts[locale].faq, icon: <CommentIcon /> },
  } satisfies Record<ChatSender, { name: string; icon: unknown }>;
  const { name, icon } = senders[sender];
  return (
    <article
      class={`uniformen-chat-message uniformen-chat-message--${sender}`}
      // The browser hides the example questions after the first question. See `aiAgentHandlers`.
      data-uniformen-chat-examples={"questions" in props ? true : undefined}
    >
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
      ) : "questions" in props ? (
        <ul class="uniformen-chat-examples">
          {props.questions.map((question) => (
            <li>
              <button type="button" class="uniformen-chat-example" data-uniformen-chat-example>
                {question}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        // A `div`, because an answer can hold paragraphs and lists.
        <div class="uniformen-chat-bubble">{props.text}</div>
      )}
    </article>
  );
}
