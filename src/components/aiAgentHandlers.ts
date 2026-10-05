/// <reference lib="dom" />

/**
 * Dispatches `uniformen:ai-agent` on `window` when the AI agent button is clicked,
 * so the consuming app can open its agent.
 */
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

  // Wait for clicks anywhere on the page.
  document.addEventListener("click", (event) => {
    // `event.target` is the element that was clicked
    const target = event.target;
    // TypeScript doesn't know `target` is an element, so we check first.
    if (!(target instanceof Element)) return;

    // Find the drawer and the button by their names.
    const drawer = document.getElementById("uniformen-chat-drawer");
    const button = document.querySelector("[data-uniformen-ai-agent-toggle]");

    // If they aren't in the page (aiAgent is off), do nothing.
    if (!drawer || !button) return;

    //show where the user is located (homepage / a micro-frontend)
    displayLocation(drawer);

    // Hide the example questions when the user clicks one of them, or sends a
    // question of their own. The send button only counts when the field has text.
    // TODO: Call `setExamplesVisible(drawer, true)` when the user starts a new chat.
    const example = target.closest<HTMLElement>("[data-uniformen-chat-example]");
    const textarea = drawer.querySelector<HTMLTextAreaElement>(".uniformen-chat-textarea");
    const sent = target.closest("[data-uniformen-chat-send]") && textarea?.value.trim();
    if (example || sent) toggleExamplesVisible(drawer, false);
    if (sent && textarea) {
      // Remove the typing message first, so the new question is added after the
      // earlier messages and not after the typing dots.
      hideTyping(drawer);
      const bubble = addMessage(drawer, "[data-uniformen-chat-user-template]")?.querySelector(
        ".uniformen-chat-bubble",
      );
      // Use `textContent`, not `innerHTML`, so the text cannot add HTML to the page.
      if (bubble) bubble.textContent = textarea.value.trim();
      showTyping(drawer);
      // TODO: Send the question to the backend here. Call `hideTyping` when the reply
      // arrives, before the reply is added to the chat.
      textarea.value = "";
      textarea.focus();
    }
    // TODO: Send the question to the agent instead of putting it in the field.
    if (example && textarea) {
      textarea.value = example.textContent ?? "";
      textarea.focus();
    }
    // `closest` checks the clicked element and its parents. So a click on the icon
    // inside the button still counts as a click on the button.
    if (target.closest("[data-uniformen-ai-agent-toggle]")) {
      drawer.hidden = !drawer.hidden; // flip: hidden -> shown, shown -> hidden
    } else if (target.closest("[data-uniformen-chat-drawer-close]")) {
      drawer.hidden = true;
    } else {
      return;
    }
    button.setAttribute("aria-expanded", drawer.hidden ? "false" : "true");
    // The page may have scrolled while the drawer was closed.
    placeDrawer();
  });

  /**
   * Uses findlocation to display where the user is located in the application and display
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
