import { SendIcon } from "./icons/SendIcon";

/** Returns the button that sends the chat message. */
export const SendIconButton = ({ label }: { label: string }) => (
  <button
    type="button"
    class="uniformen-floating-button uniformen-chat-textarea__send"
    aria-label={label}
    data-uniformen-chat-send
  >
    <SendIcon />
  </button>
);
