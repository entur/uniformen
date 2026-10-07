/// <reference lib="dom" />

/**
 * Makes the AI agent's chat drawer work. The AI agent button opens and closes the
 * drawer. Opening moves focus to the text field. Escape or the close button closes
 * the drawer and moves focus back to the AI agent button. The drawer also handles
 * sending a question, the example questions and starting a new chat.
 *
 * Does nothing if the button or the drawer is not in the page.
 */
export default function aiAgentHandlers() {
  const button = document.querySelector("[data-uniformen-ai-agent-toggle]");
  if (!(button instanceof HTMLElement)) return;

  const drawer = document.getElementById("uniformen-chat-drawer");
  if (!drawer) return;

  const textarea = () => drawer.querySelector<HTMLTextAreaElement>(".uniformen-chat-textarea");

  /** Moves the drawer so it is below the bar and above the footer. */
  function placeDrawer() {
    if (!drawer || drawer.hidden) return;
    const placement = resolvePlacement();
    if (!placement) return;
    drawer.style.top = `${placement.top}px`;
    drawer.style.bottom = `${placement.bottom}px`;
  }

  // `passive` tells the browser that the listener never stops the scroll, so
  // scrolling stays smooth.
  window.addEventListener("scroll", placeDrawer, { passive: true });
  window.addEventListener("resize", placeDrawer);

  button.addEventListener("click", () => setDrawerOpen(Boolean(drawer.hidden)));

  drawer.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    // `closest` also matches a click on the icon inside a button.
    if (target.closest("[data-uniformen-chat-drawer-close]")) {
      setDrawerOpen(false);
      button.focus();
    } else if (target.closest("[data-uniformen-chat-send]")) {
      sendQuestion();
    } else if (target.closest("[data-uniformen-new-chat]")) {
      startNewChat();
    } else {
      const example = target.closest("[data-uniformen-chat-example]");
      if (example) useExample(example);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !drawer.hidden) {
      setDrawerOpen(false);
      button.focus();
    }
  });

  /** Opens or closes the drawer, and updates the button to match. */
  function setDrawerOpen(open: boolean) {
    if (!drawer || !button) return;
    drawer.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    if (!open) return;
    displayLocation();
    // The page may have scrolled while the drawer was closed.
    placeDrawer();
    textarea()?.focus();
  }

  /**
   * Adds the question in the text field to the chat, and empties the field. Does
   * nothing when the field is empty.
   */
  function sendQuestion() {
    const field = textarea();
    const question = field?.value.trim();
    if (!field || !question) return;

    toggleExamplesVisible(false);
    // Remove the typing message first, so the new question is added after the
    // earlier messages and not after the typing dots.
    hideTyping();
    const message = addMessage("[data-uniformen-chat-user-template]");
    // Use `textContent`, not `innerHTML`, so the text cannot add HTML to the page.
    const bubble = message?.querySelector(".uniformen-chat-bubble");
    if (bubble) bubble.textContent = question;
    showTyping();
    // TODO: Send the question to the backend here. Call `hideTyping` when the reply
    // arrives, before the reply is added to the chat.
    field.value = "";
    field.focus();
  }

  /** Sends the text of the example question that the user clicked. */
  function useExample(example: Element) {
    const field = textarea();
    if (!field) return;
    field.value = example.textContent ?? "";
    sendQuestion();
  }

  /**
   * Removes the messages that the browser added to the chat, shows the example
   * questions again and empties the text field. The messages that the server
   * rendered stay.
   */
  function startNewChat() {
    // TODO: Ask the backend to start a new chat when the chat is connected to it.
    for (const message of drawer?.querySelectorAll("[data-uniformen-chat-added]") ?? []) {
      message.remove();
    }
    toggleExamplesVisible(true);
    const field = textarea();
    if (!field) return;
    field.value = "";
    field.focus();
  }

  /** Shows the user's current place in the app at the bottom of the drawer. */
  function displayLocation() {
    const locationName = drawer?.querySelector(".uniformen-chat-drawer__location-name");
    const location = findLocation();
    // When the path is empty, keep the server-rendered text.
    if (locationName && location) locationName.textContent = location;
  }

  /**
   * Returns the parts of the page's path, separated by commas. For
   * `/price-and-product/fare-structures` it returns
   * "price-and-product, fare-structures".
   */
  function findLocation() {
    return window.location.pathname.split("/").filter(Boolean).join(", ");
  }

  /** Shows the example questions when `visible` is true, and hides them when it is false. */
  function toggleExamplesVisible(visible: boolean) {
    const examples = drawer?.querySelector<HTMLElement>("[data-uniformen-chat-examples]");
    if (examples) examples.hidden = !visible;
  }

  /**
   * Copies the message in the template that matches `templateSelector` to the end of
   * the chat, and scrolls the chat down to it. Returns the new message, or `null` when
   * the template or the chat window is missing.
   */
  function addMessage(templateSelector: string) {
    const template = drawer?.querySelector<HTMLTemplateElement>(templateSelector);
    const chatWindow = drawer?.querySelector<HTMLElement>(".uniformen-chat-window");
    const message = template?.content.firstElementChild?.cloneNode(true);
    if (!chatWindow || !(message instanceof HTMLElement)) return null;
    // `startNewChat` removes the messages that have this attribute.
    message.setAttribute("data-uniformen-chat-added", "");
    chatWindow.append(message);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return message;
  }

  /**
   * Shows the agent's typing message at the end of the chat. Does nothing when it is
   * already shown, so the chat never has more than one.
   */
  function showTyping() {
    if (drawer?.querySelector("[data-uniformen-chat-typing]")) return;
    addMessage("[data-uniformen-chat-typing-template]")?.setAttribute(
      "data-uniformen-chat-typing",
      "",
    );
  }

  /** Removes the agent's typing message from the chat, if it is shown. */
  function hideTyping() {
    drawer?.querySelector("[data-uniformen-chat-typing]")?.remove();
  }

  /**
   * Returns how far, in pixels, the drawer's top and bottom must be from the edges of
   * the window, so the drawer is below the bar and above the footer. When the bar or
   * the footer is scrolled out of view, the drawer goes to that edge of the window.
   * Returns `null` when the bar is not in the page.
   */
  function resolvePlacement() {
    const bar = document.getElementById("top-navigation");
    if (!bar) return null;
    // The app may not show the footer. Then the drawer goes to the bottom of the window.
    const footer = document.getElementById("footer");
    const footerTop = footer ? footer.getBoundingClientRect().top : window.innerHeight;
    return {
      top: Math.max(0, bar.getBoundingClientRect().bottom),
      bottom: Math.max(0, window.innerHeight - footerTop),
    };
  }
}
