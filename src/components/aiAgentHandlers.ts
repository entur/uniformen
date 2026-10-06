export default function aiAgentHandlers() {
  /**
  * Positions the drawer correctly without conflicting with navbar and/or footer.
  */
  function placeDrawer() {
    const drawer = document.getElementById("uniformen-chat-drawer");
    if (!drawer || drawer.hidden) return;
    const placement = resolvePlacement();
    if (!placement) return;
    drawer.style.top = `${placement.top}px`;
    drawer.style.bottom = `${placement.bottom}px`;
  }


  // `passive` tells the browser that the listener never stops the scroll, so scrolling stays smooth.
  window.addEventListener("scroll", placeDrawer, { passive: true });
  window.addEventListener("resize", placeDrawer);

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const drawer = document.getElementById("uniformen-chat-drawer");
    const button = document.querySelector("[data-uniformen-ai-agent-toggle]");
    // If they aren't in the page, the AI agent is turned off.
    if (!drawer || !button) return;

    // `closest` also matches a click on the icon inside a button.
    if (target.closest("[data-uniformen-ai-agent-toggle]")) {
      setDrawerOpen(drawer, button, Boolean(drawer.hidden));
    } else if (target.closest("[data-uniformen-chat-drawer-close]")) {
      setDrawerOpen(drawer, button, false);
    } else if (target.closest("[data-uniformen-chat-send]")) {
      sendQuestion(drawer);
    } else {
      const example = target.closest<HTMLElement>("[data-uniformen-chat-example]");
      if (example) useExample(drawer, example);
    }
  });

  /** Opens or closes the drawer, and updates the button to match. */
  function setDrawerOpen(drawer: HTMLElement, button: Element, open: boolean) {
    drawer.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    if (!open) return;
    displayLocation(drawer);
    // The page may have scrolled while the drawer was closed.
    placeDrawer();
  }

  /**
   * Adds the question in the text field to the chat, and empties the field. Does
   * nothing when the field is empty.
   */
  function sendQuestion(drawer: HTMLElement) {
    const textarea = drawer.querySelector<HTMLTextAreaElement>(".uniformen-chat-textarea");
    const question = textarea?.value.trim();
    if (!textarea || !question) return;

    // TODO: Call `toggleExamplesVisible(drawer, true)` when the user starts a new chat.
    toggleExamplesVisible(drawer, false);
    // Remove the typing message first, so the new question is added after the
    // earlier messages and not after the typing dots.
    hideTyping(drawer);
    const message = addMessage(drawer, "[data-uniformen-chat-user-template]");
    // Use `textContent`, not `innerHTML`, so the text cannot add HTML to the page.
    const bubble = message?.querySelector(".uniformen-chat-bubble");
    if (bubble) bubble.textContent = question;
    showTyping(drawer);
    // TODO: Send the question to the backend here. Call `hideTyping` when the reply
    // arrives, before the reply is added to the chat.
    textarea.value = "";
    textarea.focus();
  }

  /** Puts the example question in the text field and hides the example questions. */
  function useExample(drawer: HTMLElement, example: HTMLElement) {
    toggleExamplesVisible(drawer, false);
    const textarea = drawer.querySelector<HTMLTextAreaElement>(".uniformen-chat-textarea");
    if (!textarea) return;
    // TODO: Send the question to the agent instead of putting it in the field.
    textarea.value = example.textContent ?? "";
    textarea.focus();
  }

  /**
   * Uses findlocation to display where the user is located in the application
   * @param drawer HTMLElement of where the location is to be displayed
   */
  function displayLocation(drawer:HTMLElement) {
    const locationName = drawer.querySelector<HTMLElement>(".uniformen-chat-drawer__location-name");

    const location = findLocation();
    // When the path is empty, keep the server-rendered text.
    if (locationName && location) locationName.textContent = location;
  }

  /**
   * Uses window.location.pathname to find user location in the app.
   * @return Returns the user location as a string, ex. price-and-product, fare-structures
   */
  function findLocation() {return window.location.pathname.split("/").filter(Boolean).join(", ")}

  /** Shows the example questions when `visible` is true, and hides them when it is false. */
  function toggleExamplesVisible(drawer: HTMLElement, visible: boolean) {
    const examples = drawer.querySelector<HTMLElement>("[data-uniformen-chat-examples]");
    if (examples) examples.hidden = !visible;
  }

  /**
   * Copies the message in the template that matches `templateSelector` to the end of
   * the chat, and scrolls the chat down to it. Returns the new message, or `null` when
   * the template or the chat window is missing.
   */
  function addMessage(drawer: HTMLElement, templateSelector: string) {
    const template = drawer.querySelector<HTMLTemplateElement>(templateSelector);
    const chatWindow = drawer.querySelector<HTMLElement>(".uniformen-chat-window");
    const message = template?.content.firstElementChild?.cloneNode(true);
    if (!chatWindow || !(message instanceof HTMLElement)) return null;
    chatWindow.append(message);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return message;
  }

  /**
   * Shows the agent's typing message at the end of the chat. Does nothing when it is
   * already shown, so the chat never has more than one.
   */
  function showTyping(drawer: HTMLElement) {
    const message = drawer.querySelector("[data-uniformen-chat-typing]");
    if (message) return;
    addMessage(drawer, "[data-uniformen-chat-typing-template]")?.setAttribute(
      "data-uniformen-chat-typing",
      "",
    );
  }

  /** Removes the agent's typing message from the chat, if it is shown. */
  function hideTyping(drawer: HTMLElement) {
    drawer.querySelector("[data-uniformen-chat-typing]")?.remove();
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
