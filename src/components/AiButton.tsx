import type { Locale } from "../types";
import { AiIcon } from "./icons/AiIcon";

const texts = {
  "nb-NO": { aiAgent: "KI agent" },
  "nn-NO": { aiAgent: "KI agent" },
  "en-GB": { aiAgent: "AI agent" },
} as const;

/**
 * Renders the AI agent button. It looks like the secondary button in the Entur
 * design system. It has no click handler yet.
 */
// TODO open the AI agent when the button is clicked.
export function AiButton({ locale }: { locale: Locale }) {
  const txt = texts[locale];
  return (
    <button
      type="button"
      class="uniformen-top-nav__action uniformen-top-nav__action--secondary"
      aria-label={txt.aiAgent}
    >
      <AiIcon />
      <span class="uniformen-top-nav__action-label">{txt.aiAgent}</span>
    </button>
  );
}
