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
  const locationName = drawer.querySelector(".uniformen-chat-drawer__location-name");
  // The location text that the server rendered. It is shown again when the path has
  // no part to show, for example after a navigation to the root path.
  const defaultLocation = locationName?.textContent ?? "";

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

  // A single-page app changes the path without loading a new page, so the location
  // is updated on every navigation, also while the drawer is open. The Navigation API
  // also sees `history.pushState`. Browsers without it only update on back and forward.
  const navigation = (window as { navigation?: EventTarget }).navigation;
  if (navigation) {
    navigation.addEventListener("currententrychange", displayLocation);
  } else {
    window.addEventListener("popstate", displayLocation);
  }

  button.addEventListener("click", () => setDrawerOpen(Boolean(drawer.hidden)));

  drawer.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    // `closest` also matches a click on the icon inside a button.
    if (target.closest("[data-uniformen-chat-drawer-close]")) {
      setDrawerOpen(false);
      button.focus();
    } else if (target.closest("[data-uniformen-chat-send]")) {
      void sendQuestion();
    } else if (target.closest("[data-uniformen-new-chat]")) {
      startNewChat();
    } else {
      const example = target.closest("[data-uniformen-chat-example]");
      if (example) useExample(example);
    }
  });

  // Enter sends the question. Shift+Enter adds a new line.
  drawer.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    if (!(event.target instanceof Element) || !event.target.closest(".uniformen-chat-textarea")) {
      return;
    }
    event.preventDefault();
    void sendQuestion();
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

  // The sporai session of this chat. The first reply gives it. `startNewChat`
  // forgets it, so the next question starts a new session.
  let sessionId: string | undefined;
  // Counts the questions sent. A reply that arrives after "New chat" belongs to
  // an older question, so it is not shown.
  let questionCount = 0;
  let awaitingReply = false;
  const errorText = drawer.getAttribute("data-uniformen-chat-error-text") ?? "";

  /**
   * Adds the question in the text field to the chat, empties the field and adds the
   * reply when it arrives. Does nothing when the field is empty, or while the reply
   * to the previous question is still on its way.
   */
  async function sendQuestion() {
    const field = textarea();
    const question = field?.value.trim();
    if (!field || !question || awaitingReply) return;

    toggleExamplesVisible(false);
    const message = addMessage("[data-uniformen-chat-user-template]");
    // Use `textContent`, not `innerHTML`, so the text cannot add HTML to the page.
    const bubble = message?.querySelector(".uniformen-chat-bubble");
    if (bubble) bubble.textContent = question;
    showTyping();
    field.value = "";
    field.focus();

    awaitingReply = true;
    const count = ++questionCount;
    let replyText = await fetchReply(question, count);
    // Sporai deletes a session that has not been used for a while.
    // Show the divider above the question, and ask again in a new session.
    if (replyText === null && count === questionCount) {
      const divider = addMessage("[data-uniformen-chat-restarted-template]");
      if (divider) message?.before(divider);
      replyText = await fetchReply(question, count);
    }
    if (count !== questionCount) return;
    awaitingReply = false;
    hideTyping();
    const reply = addMessage("[data-uniformen-chat-agent-template]");
    const replyBubble = reply?.querySelector(".uniformen-chat-bubble");
    if (replyBubble) renderMarkdown(replyBubble, replyText ?? errorText);
  }

  /**
   * Shows `text` in `target`, with the markdown that sporai uses: paragraphs, bullet
   * and numbered lists, headings and bold text. The reply comes from a language
   * model, so the elements are created here and the text is only ever added as text.
   * Other markdown, such as links, stays as plain text.
   */
  function renderMarkdown(target: Element, text: string) {
    target.textContent = "";
    let list: HTMLElement | null = null;
    let listTag = "";
    let paragraph: HTMLElement | null = null;
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      // A blank line ends the paragraph or list.
      if (!trimmed) {
        list = null;
        paragraph = null;
        continue;
      }
      const item = /^(?:[*-]|(\d+)\.)\s+(.*)$/.exec(trimmed);
      if (item) {
        const tag = item[1] ? "ol" : "ul";
        if (!list || listTag !== tag) {
          list = document.createElement(tag);
          listTag = tag;
          target.append(list);
        }
        const entry = document.createElement("li");
        addInline(entry, item[2] ?? "");
        list.append(entry);
        paragraph = null;
        continue;
      }
      list = null;
      const heading = /^#{1,6}\s+(.*)$/.exec(trimmed);
      if (heading) {
        // A heading in a short chat reply is shown as a bold paragraph.
        const strong = document.createElement("strong");
        addInline(strong, heading[1] ?? "");
        const block = document.createElement("p");
        block.append(strong);
        target.append(block);
        paragraph = null;
        continue;
      }
      // Lines next to each other belong to the same paragraph.
      if (paragraph) {
        paragraph.append(document.createElement("br"));
      } else {
        paragraph = document.createElement("p");
        target.append(paragraph);
      }
      addInline(paragraph, trimmed);
    }
  }

  /** Adds `text` to `target`, and makes the parts between pairs of `**` bold. */
  function addInline(target: Element, text: string) {
    const parts = text.split("**");
    // An even number of parts means a `**` without a partner. Keep the text as it is.
    if (parts.length % 2 === 0) {
      target.append(text);
      return;
    }
    for (const [index, part] of parts.entries()) {
      if (!part) continue;
      if (index % 2 === 0) {
        target.append(part);
      } else {
        const strong = document.createElement("strong");
        strong.textContent = part;
        target.append(strong);
      }
    }
  }

  /**
   * Sends the question to the chat proxy URL on the drawer, and returns the reply.
   * Returns `null` when sporai does not know the session that the request sent.
   * Returns the drawer's error
   * text when the request fails or the drawer has no chat proxy URL. Only updates the
   * session when `count` is still the newest question.
   */
  async function fetchReply(query: string, count: number): Promise<string | null> {
    const url = drawer?.getAttribute("data-uniformen-chat-proxy-url");
    const token = drawer
      ?.querySelector("[data-uniformen-chat-token]")
      ?.getAttribute("data-uniformen-chat-token");
    if (!url || !token) return errorText;
    const sentSessionId = sessionId;
    try {
      const res = await fetch(url, {
        method: "POST",
        // The token is the only credential. Cookies for the page must not be sent.
        credentials: "omit",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        // Send the raw path. Sporai rejects the comma-separated text that
        // `findLocation` makes.
        body: JSON.stringify({
          query,
          sessionId: sentSessionId,
          location: window.location.pathname,
        }),
      });
      // 404 means sporai does not know the session, so the next request starts a new one.
      // A 404 for a request without a session has another cause, so it is an error.
      if (res.status === 404 && sentSessionId) {
        if (count === questionCount) sessionId = undefined;
        return null;
      }
      if (!res.ok) return errorText;
      const body: { reply: string; sessionId: string } = await res.json();
      if (count === questionCount) sessionId = body.sessionId;
      return body.reply;
    } catch {
      return errorText;
    }
  }

  /** Sends the text of the example question that the user clicked. */
  function useExample(example: Element) {
    const field = textarea();
    if (!field) return;
    field.value = example.textContent ?? "";
    void sendQuestion();
  }

  /**
   * Removes the messages that the browser added to the chat, shows the example
   * questions again and empties the text field. The messages that the server
   * rendered stay.
   */
  function startNewChat() {
    // Sporai removes the old session by itself when it has not been used for a while.
    sessionId = undefined;
    questionCount++;
    awaitingReply = false;
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
    if (locationName) locationName.textContent = findLocation() || defaultLocation;
  }

  /**
   * Returns the name of the last part of the page's path, in the drawer's language.
   * Returns the path part itself when it has no name, and "" on the root path.
   * When the path has a `readonly`, `add`, `edit` or `create` or number part,
   * it uses the part before it
   */
  function findLocation() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    // `readonly`, `add`, `edit` and `create` are not pages. They show a page in
    // another mode. When one of them is in the path, use the part before it, and skip
    // the parts after it.
    const modes = new Set(["readonly", "add", "edit", "create"]);
    const stop = parts.findIndex((part) => modes.has(part));
    const pageParts = stop === -1 ? parts : parts.slice(0, stop);
    // A number at the end of the path is usually the id of one item, like the 123 in
    // `/turnover/123`. Skip it and use the part before it.
    const last = pageParts.findLast((part) => !/^\d+$/.test(part)) ?? "";
    const names: Record<string, string> = JSON.parse(
      drawer?.getAttribute("data-uniformen-chat-locations") ?? "{}",
    );
    // hasOwn, so a path like `/constructor` does not find a method of Object.
    return Object.hasOwn(names, last) ? names[last] : last;
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
