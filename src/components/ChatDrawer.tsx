import type { Locale } from "../types";

const texts = {
  "nb-NO": { aiAgent: "KI agent" },
  "nn-NO": { aiAgent: "KI agent" },
  "en-GB": { aiAgent: "AI agent" },
} as const;

/**
 * Renders the Chat drawer. 
 * It is a drawer that slides in from the right side of the screen.
 */
export function ChatDrawer({ locale }: { locale: Locale }) {
  const txt = texts[locale];
  return (
    <div hidden id="uniformen-chat-drawer" role="dialog" aria-modal="false" aria-labelledby="uniformen-chat-drawer-title" class="uniformen-chat-drawer">
      <button
        class="eds-icon-button eds-drawer__close-button eds-icon-button--size-medium"
        aria-disabled="false"
        type="button"
        aria-label="Lukk skuff"
        data-uniformen-chat-drawer-close 
      >
        <svg
          aria-hidden="true"
          xml:space="preserve"
          x="0"
          y="0"
          viewBox="0 0 16 16"
          width="1em"
          height="1em"
          class="eds-icon "
          color="currentColor"
        >
          <path
            fill="currentColor"
            fill-rule="evenodd"
            d="m14.075 1 .925.925L8.924 8 15 14.075l-.925.925L8 8.924 1.925 15 1 14.075 7.075 8 1 1.925 1.925 1 8 7.075z"
            clip-rule="evenodd"
          ></path>
        </svg>
      </button>
      <div class="eds-drawer__content">
        <h2 class="eds-h3" id=":rrl:" tabindex="-1" data-autofocus="">
          Litt mer informasjon
        </h2>
        <p class="eds-paragraph eds-paragraph--margin-bottom">
          Denne drawer-komponenten skal i hovedsak kun brukes til å gi mer informasjon - litt som et
          mer avansert tooltip. Et eksempel kan være å vise flere detaljer om et valgt produkt,
          reise eller lignende. Du kan lenke til mer funksjonalitet om ønskelig.
        </p>
        <p class="eds-paragraph eds-paragraph--margin-bottom">
          Man skal aldri plassere tekstfelt, radioknapper og lignende i drawers. Lenk heller til
          egne views for å endre dette - eller tilby disse kontrollene kontekstuelt.
        </p>
      </div>
    </div>
  );
}
