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
    if (event.key !== "Escape" || event.defaultPrevented || drawer.hidden) return;
    // Ignore Escape from the rest of the page, such as a modal in the app.
    const active = document.activeElement;
    if (!drawer.contains(active) && !button.contains(active)) return;
    setDrawerOpen(false);
    button.focus();
  });

  /** Opens or closes the drawer, and updates the button to match. */
  function setDrawerOpen(open: boolean) {
    if (!drawer || !button) return;
    drawer.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    if (!open) return;
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
  const errorTextRefresh = drawer.getAttribute("data-uniformen-chat-error-text-refresh") ?? "";
  const errorTextRateLimit = drawer.getAttribute("data-uniformen-chat-error-text-rate-limit") ?? "";
  // Has `{seconds}` where the number of seconds to wait goes.
  const errorTextRateLimitWait =
    drawer.getAttribute("data-uniformen-chat-error-text-rate-limit-wait") ?? "";

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
    const chatWindow = drawer?.querySelector<HTMLElement>(".uniformen-chat-window");
    const followReply = !chatWindow || isNearBottom(chatWindow);
    const reply = addMessage("[data-uniformen-chat-agent-template]");
    const replyBubble = reply?.querySelector(".uniformen-chat-bubble");
    if (replyBubble) renderMarkdown(replyBubble, replyText ?? errorText);
    // `addMessage` scrolled to the bottom while the bubble was empty. Scroll again
    // after the text is added, so the user reads a long reply from its start. A short
    // reply still ends at the bottom, because the chat cannot scroll further. Do not
    // scroll when the user has scrolled up to read something older.
    if (followReply) reply?.scrollIntoView({ block: "start" });
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
          // Use the number from the text, so a list that a blank line split still counts up.
          if (item[1]) list.setAttribute("start", item[1]);
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
        // Stop waiting after 45 seconds. The catch below then shows the error text.
        signal: AbortSignal.timeout(45_000),
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        // Send the path, not the name that is shown. The proxy leaves out a location
        // that sporai would reject.
        body: JSON.stringify({
          query,
          sessionId: sentSessionId,
          location: readPath(),
        }),
      });
      // 404 means sporai does not know the session, so the next request starts a new one.
      // A 404 for a request without a session has another cause, so it is an error.
      if (res.status === 404 && sentSessionId) {
        if (count === questionCount) sessionId = undefined;
        return null;
      }
      if (res.status === 401) return errorTextRefresh;
      if (res.status === 429) return rateLimitText(res.headers.get("Retry-After"));
      if (!res.ok) return errorText;
      const body: { reply: string; sessionId: string } = await res.json();
      if (count === questionCount) sessionId = body.sessionId;
      return body.reply;
    } catch {
      return errorText;
    }
  }

  /**
   * Returns the rate limit text with the seconds in it. Returns the text without
   * seconds when `retryAfter` is not a positive whole number.
   */
  function rateLimitText(retryAfter: string | null) {
    const seconds = retryAfter !== null && /^\d+$/.test(retryAfter) ? Number(retryAfter) : 0;
    if (seconds <= 0 || !errorTextRateLimitWait) return errorTextRateLimit;
    return errorTextRateLimitWait.replace("{seconds}", String(seconds));
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

  /**
   * Returns the page's path, or "homepage" on the root path. Returns "location-not-found" when the path cannot be
   * read. Sporai only accepts path characters, so the values cannot contain spaces.
   */
  function readPath() {
    try {
      const path = window.location.pathname;
      if (typeof path !== "string" || !path) return "location-not-found";
      return path === "/" ? "homepage" : path;
    } catch {
      return "location-not-found";
    }
  }

  /** Shows the example questions when `visible` is true, and hides them when it is false. */
  function toggleExamplesVisible(visible: boolean) {
    const examples = drawer?.querySelector<HTMLElement>("[data-uniformen-chat-examples]");
    if (examples) examples.hidden = !visible;
  }

  /** Returns true when the chat is scrolled to the bottom, or less than 100 pixels from it. */
  function isNearBottom(chatWindow: HTMLElement) {
    return chatWindow.scrollHeight - chatWindow.scrollTop - chatWindow.clientHeight < 100;
  }

  /**
   * Copies the message in the template that matches `templateSelector` to the end of
   * the chat. Scrolls the chat down to it, but only when the user was already near the
   * bottom. Returns the new message, or `null` when the template or the chat window
   * is missing.
   */
  function addMessage(templateSelector: string) {
    const template = drawer?.querySelector<HTMLTemplateElement>(templateSelector);
    const chatWindow = drawer?.querySelector<HTMLElement>(".uniformen-chat-window");
    const message = template?.content.firstElementChild?.cloneNode(true);
    if (!chatWindow || !(message instanceof HTMLElement)) return null;
    // `startNewChat` removes the messages that have this attribute.
    message.setAttribute("data-uniformen-chat-added", "");
    // Measure before the message is added, because the message makes the chat taller.
    const followMessage = isNearBottom(chatWindow);
    chatWindow.append(message);
    if (followMessage) chatWindow.scrollTop = chatWindow.scrollHeight;
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
