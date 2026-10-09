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

  // The sporai session of this chat. The first answer gives it. `startNewChat`
  // forgets it, so the next question starts a new session.
  let session: string | undefined;
  // Counts the questions sent. An answer that arrives after "New chat" belongs to
  // an older question, so it is not shown.
  let questionCount = 0;
  let waiting = false;

  /**
   * Adds the question in the text field to the chat, empties the field and adds the
   * answer when it arrives. Does nothing when the field is empty, or while the
   * answer to the previous question is still on its way.
   */
  async function sendQuestion() {
    const field = textarea();
    const question = field?.value.trim();
    if (!field || !question || waiting) return;

    toggleExamplesVisible(false);
    const message = addMessage("[data-uniformen-chat-user-template]");
    // Use `textContent`, not `innerHTML`, so the text cannot add HTML to the page.
    const bubble = message?.querySelector(".uniformen-chat-bubble");
    if (bubble) bubble.textContent = question;
    showTyping();
    field.value = "";
    field.focus();

    waiting = true;
    const count = ++questionCount;
    const reply = await askAgent(question, count);
    if (count !== questionCount) return;
    waiting = false;
    hideTyping();
    const answer = addMessage("[data-uniformen-chat-agent-template]");
    const answerBubble = answer?.querySelector(".uniformen-chat-bubble");
    if (answerBubble) renderMarkdown(answerBubble, reply);
  }

  /**
   * Shows `text` in `target`, with the markdown that sporai uses: paragraphs, bullet
   * and numbered lists, headings and bold text. The answer comes from a language
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
        // A heading in a short chat answer is shown as a bold paragraph.
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
   * Sends the question to the chat URL on the drawer, and returns the answer. Returns
   * the drawer's error text when the request fails or the drawer has no chat URL.
   * Only updates the session when `count` is still the newest question.
   */
  async function askAgent(text: string, count: number): Promise<string> {
    const url = drawer?.getAttribute("data-uniformen-chat-url");
    const token = drawer?.getAttribute("data-uniformen-chat-token");
    const errorText = drawer?.getAttribute("data-uniformen-chat-error") ?? "";
    if (!url || !token) return errorText;
    try {
      const res = await fetch(url, {
        method: "POST",
        // The token is the only credential. Cookies for the page must not be sent.
        credentials: "omit",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text, session, page: window.location.pathname }),
      });
      // 410 means the session has expired, so the next question starts a new one.
      if (res.status === 410 && count === questionCount) session = undefined;
      if (!res.ok) return errorText;
      const body: { reply: string; session: string } = await res.json();
      if (count === questionCount) session = body.session;
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
    session = undefined;
    questionCount++;
    waiting = false;
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
