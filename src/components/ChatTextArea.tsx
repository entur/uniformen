import type { Locale } from "../types";
import { SendIconButton } from "./SendIconButton";

const texts = {
  "nb-NO": { label: "Hvordan kan jeg hjelpe deg i dag?", send: "Send melding" },
  "nn-NO": { label: "Korleis kan eg hjelpe deg i dag?", send: "Send melding" },
  "en-GB": { label: "How can I help you today?", send: "Send message" },
} as const;

/** Returns the field where the user writes a message to the AI agent. */
export function ChatTextArea({ locale }: { locale: Locale }) {
  const txt = texts[locale];
  return (
    <div class="uniformen-chat-textarea__wrapper">
      <textarea
        class="uniformen-chat-textarea"
        rows={3}
        placeholder={txt.label}
        aria-label={txt.label}
      />
      <SendIconButton label={txt.send} />
    </div>
  );
}
