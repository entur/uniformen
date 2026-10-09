import { afterEach, describe, expect, test } from "bun:test";
import aiAgentHandlers from "./aiAgentHandlers";

/**
 * The handler is sent to the browser as source text, so it only uses browser globals.
 * These fakes provide the parts of `document`, `window` and the DOM classes that it
 * uses, and the tests run the real handler against them. The selectors only support
 * one class (`.name`) or one attribute (`[name]`), because the handler uses no others.
 */
type Listener = (event: unknown) => void;

class FakeElement {
  /** Lower case, unlike the real DOM. `#text` for the text that `append` adds. */
  tagName = "div";
  readonly attributes = new Map<string, string>();
  readonly children: FakeElement[] = [];
  parent: FakeElement | null = null;
  hidden = false;
  value = "";
  scrollTop = 0;
  scrollHeight = 100;
  focused = 0;
  readonly style: Record<string, string> = {};
  text = "";
  private readonly listeners = new Map<string, Listener[]>();
  /** Called when the element gets focus. The setup uses it to set `document.activeElement`. */
  onFocus?: (element: FakeElement) => void;

  constructor(attributes: Record<string, string> = {}, children: FakeElement[] = []) {
    for (const [name, value] of Object.entries(attributes)) this.attributes.set(name, value);
    for (const child of children) this.append(child);
  }

  get textContent(): string {
    return this.text + this.children.map((child) => child.textContent).join("");
  }

  set textContent(value: string) {
    this.text = value;
    this.children.length = 0;
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  matches(selector: string): boolean {
    if (selector.startsWith(".")) {
      return (this.getAttribute("class") ?? "").split(" ").includes(selector.slice(1));
    }
    const attribute = /^\[([\w-]+)\]$/.exec(selector)?.[1];
    if (!attribute) throw new Error(`The fake does not support the selector ${selector}`);
    return this.attributes.has(attribute);
  }

  closest(selector: string): FakeElement | null {
    if (this.matches(selector)) return this;
    return this.parent?.closest(selector) ?? null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    return this.children.flatMap((child) => [
      ...(child.matches(selector) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }

  querySelector(selector: string): FakeElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  append(child: FakeElement | string): void {
    if (typeof child === "string") {
      const text = new FakeElement();
      text.tagName = "#text";
      text.textContent = child;
      child = text;
    }
    child.parent = this;
    this.children.push(child);
  }

  /** Returns the elements and text inside this element, written as HTML without attributes. */
  markup(): string {
    return this.children
      .map((child) =>
        child.tagName === "#text"
          ? child.textContent
          : `<${child.tagName}>${child.text}${child.markup()}</${child.tagName}>`,
      )
      .join("");
  }

  remove(): void {
    if (!this.parent) return;
    this.parent.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = null;
  }

  cloneNode(): FakeElement {
    const copy = new FakeElement(
      Object.fromEntries(this.attributes),
      this.children.map((child) => child.cloneNode()),
    );
    copy.text = this.text;
    return copy;
  }

  focus(): void {
    this.focused += 1;
    this.onFocus?.(this);
  }

  getBoundingClientRect() {
    return { top: 0, bottom: 0 };
  }

  addEventListener(type: string, listener: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  /** Runs the listeners for `type` on this element only. */
  fire(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  /** Runs the click listeners on this element and on each parent, as a bubbling click does. */
  click(target: FakeElement = this): void {
    for (const listener of this.listeners.get("click") ?? []) listener({ target });
    this.parent?.click(target);
  }
}

/** Holds its message in `content`, outside the tree, like a real `<template>`. */
class FakeTemplate extends FakeElement {
  readonly content: { firstElementChild: FakeElement };

  constructor(attribute: string, message: FakeElement) {
    super({ [attribute]: "" });
    this.content = { firstElementChild: message };
  }
}

class FakeDocument {
  private readonly listeners = new Map<string, Listener[]>();
  activeElement: unknown = null;

  constructor(
    private readonly button: FakeElement | null,
    private readonly drawer: FakeElement | null,
  ) {}

  querySelector(selector: string): FakeElement | null {
    expect(selector).toBe("[data-uniformen-ai-agent-toggle]");
    return this.button;
  }

  getElementById(id: string): FakeElement | null {
    return id === "uniformen-chat-drawer" ? this.drawer : null;
  }

  createElement(tagName: string): FakeElement {
    const element = new FakeElement();
    element.tagName = tagName;
    return element;
  }

  addEventListener(type: string, listener: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  fire(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

class FakeWindow {
  readonly listened: string[] = [];
  readonly innerHeight = 800;

  constructor(readonly location: { pathname: string }) {}

  addEventListener(type: string): void {
    this.listened.push(type);
  }
}

const globals = globalThis as unknown as Record<string, unknown>;
const saved = {
  Element: globals["Element"],
  HTMLElement: globals["HTMLElement"],
  document: globals["document"],
  window: globals["window"],
  fetch: globals["fetch"],
};

type FetchCall = { url: string; init: RequestInit & { body: string } };

function bubble(text = ""): FakeElement {
  const element = new FakeElement({ class: "uniformen-chat-bubble" });
  element.textContent = text;
  return element;
}

function install({
  pathname = "/",
  button: withButton = true,
  drawer: withDrawer = true,
  chat = true,
  respond = () => Response.json({ reply: "Svar", session: "s-1" }),
}: {
  pathname?: string;
  button?: boolean;
  drawer?: boolean;
  /** Whether the drawer has a chat URL and token. */
  chat?: boolean;
  /** The answer from `/chat`. */
  respond?: () => Response | Promise<Response>;
} = {}) {
  const button = new FakeElement({
    "data-uniformen-ai-agent-toggle": "",
    "aria-expanded": "false",
  });
  const icon = new FakeElement();
  button.append(icon);

  const example = new FakeElement({ "data-uniformen-chat-example": "" });
  example.textContent = "Hvordan endrer jeg passord?";
  const examples = new FakeElement({ "data-uniformen-chat-examples": "" }, [example]);
  const welcome = new FakeElement({ class: "uniformen-chat-message" }, [bubble("Hei!")]);
  const chatWindow = new FakeElement({ class: "uniformen-chat-window" }, [welcome, examples]);
  const textarea = new FakeElement({ class: "uniformen-chat-textarea" });
  const send = new FakeElement({ "data-uniformen-chat-send": "" });
  const close = new FakeElement({ "data-uniformen-chat-drawer-close": "" });
  const newChat = new FakeElement({ "data-uniformen-new-chat": "" });
  const locationName = new FakeElement({ class: "uniformen-chat-drawer__location-name" });
  locationName.textContent = "hjemmesiden";

  const chatAttributes: Record<string, string> = chat
    ? { "data-uniformen-chat-url": "https://uniformen.test/chat", "data-uniformen-chat-token": "t" }
    : {};
  const drawer = new FakeElement(
    { id: "uniformen-chat-drawer", "data-uniformen-chat-error": "Feil", ...chatAttributes },
    [
      close,
      chatWindow,
      new FakeTemplate(
        "data-uniformen-chat-user-template",
        new FakeElement({ class: "uniformen-chat-message" }, [bubble()]),
      ),
      new FakeTemplate(
        "data-uniformen-chat-agent-template",
        new FakeElement({ class: "uniformen-chat-message" }, [bubble()]),
      ),
      new FakeTemplate(
        "data-uniformen-chat-typing-template",
        new FakeElement({ class: "uniformen-chat-message" }, [
          new FakeElement({ class: "uniformen-chat-typing" }),
        ]),
      ),
      textarea,
      send,
      newChat,
      locationName,
    ],
  );
  drawer.hidden = true;

  const doc = new FakeDocument(withButton ? button : null, withDrawer ? drawer : null);
  for (const element of [button, textarea]) {
    element.onFocus = (focused) => (doc.activeElement = focused);
  }
  const win = new FakeWindow({ pathname });
  globals["Element"] = FakeElement;
  globals["HTMLElement"] = FakeElement;
  globals["document"] = doc;
  globals["window"] = win;
  const calls: FetchCall[] = [];
  globals["fetch"] = async (url: string, init: FetchCall["init"]) => {
    calls.push({ url, init });
    return respond();
  };

  aiAgentHandlers();

  /** Returns the text of each message bubble in the chat, in order. */
  const messages = () =>
    chatWindow.querySelectorAll(".uniformen-chat-bubble").map((node) => node.textContent);
  const type = (text: string) => (textarea.value = text);

  return {
    doc,
    win,
    button,
    icon,
    drawer,
    textarea,
    examples,
    example,
    chatWindow,
    send,
    close,
    newChat,
    locationName,
    messages,
    type,
    typing: () => chatWindow.querySelectorAll("[data-uniformen-chat-typing]").length,
    escape: () => doc.fire("keydown", { key: "Escape" }),
    /** Presses a key in the text field. Returns whether the default action was stopped. */
    press: (key: string, shiftKey = false) => {
      let prevented = false;
      drawer.fire("keydown", {
        key,
        shiftKey,
        target: textarea,
        preventDefault: () => (prevented = true),
      });
      return prevented;
    },
    calls,
    /** The markup in the newest message bubble. */
    lastBubble: () => chatWindow.querySelectorAll(".uniformen-chat-bubble").at(-1)?.markup(),
    /** The JSON body of each request to `/chat`. */
    bodies: () => calls.map((call) => JSON.parse(call.init.body)),
  };
}

afterEach(() => {
  globals["Element"] = saved.Element;
  globals["HTMLElement"] = saved.HTMLElement;
  globals["document"] = saved.document;
  globals["window"] = saved.window;
  globals["fetch"] = saved.fetch;
});

/** Lets the fake request and the code that waits for it finish. */
const answered = () => Bun.sleep(1);

describe("aiAgentHandlers", () => {
  test("does nothing and adds no listeners when the drawer or the button is missing", () => {
    for (const missing of [{ drawer: false }, { button: false }]) {
      const page = install(missing);
      expect(page.win.listened).toBeEmpty();
      page.button.click();
      expect(page.drawer.hidden).toBe(true);
    }
  });

  test("listens for scroll and resize when the drawer is in the page", () => {
    expect(install().win.listened).toEqual(["scroll", "resize"]);
  });

  test("the button opens and closes the drawer, and keeps aria-expanded in sync", () => {
    const page = install();
    page.button.click();
    expect(page.drawer.hidden).toBe(false);
    expect(page.button.getAttribute("aria-expanded")).toBe("true");
    // A click on the icon inside the button counts as a click on the button.
    page.icon.click();
    expect(page.drawer.hidden).toBe(true);
    expect(page.button.getAttribute("aria-expanded")).toBe("false");
  });

  test("opening moves focus to the text field", () => {
    const page = install();
    page.button.click();
    expect(page.doc.activeElement).toBe(page.textarea);
  });

  test("the close button closes the drawer and moves focus back to the button", () => {
    const page = install();
    page.button.click();
    page.close.click();
    expect(page.drawer.hidden).toBe(true);
    expect(page.button.getAttribute("aria-expanded")).toBe("false");
    expect(page.doc.activeElement).toBe(page.button);
  });

  test("Escape closes an open drawer and moves focus back to the button", () => {
    const page = install();
    page.button.click();
    page.escape();
    expect(page.drawer.hidden).toBe(true);
    expect(page.doc.activeElement).toBe(page.button);
  });

  test("Escape does nothing when the drawer is closed", () => {
    const page = install();
    page.escape();
    expect(page.button.focused).toBe(0);
  });

  test("opening shows the page's path as the location", () => {
    const page = install({ pathname: "/price-and-product/fare-structures/" });
    page.button.click();
    expect(page.locationName.textContent).toBe("price-and-product, fare-structures");
  });

  test("on the root path the server-rendered location stays", () => {
    const page = install();
    page.button.click();
    expect(page.locationName.textContent).toBe("hjemmesiden");
  });

  test("sending adds the question, hides the examples, shows typing and empties the field", () => {
    const page = install();
    page.button.click();
    page.type("  Hvor er fakturaene?  ");
    page.send.click();
    expect(page.messages()).toEqual(["Hei!", "Hvor er fakturaene?"]);
    expect(page.examples.hidden).toBe(true);
    expect(page.typing()).toBe(1);
    expect(page.textarea.value).toBe("");
    expect(page.doc.activeElement).toBe(page.textarea);
  });

  test("an empty field sends nothing", () => {
    const page = install();
    page.type("   ");
    page.send.click();
    expect(page.messages()).toEqual(["Hei!"]);
    expect(page.examples.hidden).toBe(false);
  });

  test("the answer replaces the typing message", async () => {
    const page = install();
    page.type("Hvor er fakturaene?");
    page.send.click();
    await answered();
    expect(page.messages()).toEqual(["Hei!", "Hvor er fakturaene?", "Svar"]);
    expect(page.typing()).toBe(0);
  });

  test("sends the question with the token, the path and no cookies", async () => {
    const page = install({ pathname: "/price-and-product/fare-structures" });
    page.type("Hei");
    page.send.click();
    await answered();
    const [call] = page.calls;
    expect(call?.url).toBe("https://uniformen.test/chat");
    expect(call?.init.credentials).toBe("omit");
    expect(call?.init.headers).toEqual({
      Authorization: "Bearer t",
      "Content-Type": "application/json",
    });
    expect(page.bodies()).toEqual([{ text: "Hei", page: "/price-and-product/fare-structures" }]);
  });

  test("the next question uses the session from the answer", async () => {
    const page = install();
    page.type("Første");
    page.send.click();
    await answered();
    page.type("Andre");
    page.send.click();
    await answered();
    expect(page.bodies().map((body) => body.session)).toEqual([undefined, "s-1"]);
  });

  test("a second question waits until the first is answered", async () => {
    const page = install();
    page.type("Første");
    page.send.click();
    page.type("Andre");
    page.send.click();
    expect(page.textarea.value).toBe("Andre");
    expect(page.messages()).toEqual(["Hei!", "Første"]);
    await answered();
    expect(page.calls).toHaveLength(1);
  });

  test.each([
    ["the request fails", { respond: () => Promise.reject(new Error("offline")) }],
    ["the server answers with an error", { respond: () => new Response(null, { status: 502 }) }],
    ["the drawer has no chat URL", { chat: false }],
  ])("shows the error text when %s", async (_name, options) => {
    const page = install(options);
    page.type("Hei");
    page.send.click();
    await answered();
    expect(page.messages()).toEqual(["Hei!", "Hei", "Feil"]);
  });

  test("an expired session is forgotten", async () => {
    let status = 200;
    const page = install({
      respond: () =>
        status === 200
          ? Response.json({ reply: "Svar", session: "s-1" })
          : new Response(null, { status }),
    });
    page.type("Første");
    page.send.click();
    await answered();
    status = 410;
    page.type("Andre");
    page.send.click();
    await answered();
    status = 200;
    page.type("Tredje");
    page.send.click();
    await answered();
    expect(page.bodies().map((body) => body.session)).toEqual([undefined, "s-1", undefined]);
  });

  test("an answer that arrives after a new chat is not shown", async () => {
    const page = install();
    page.type("Gammel");
    page.send.click();
    page.newChat.click();
    await answered();
    expect(page.messages()).toEqual(["Hei!"]);
    page.type("Ny");
    page.send.click();
    await answered();
    expect(page.messages()).toEqual(["Hei!", "Ny", "Svar"]);
    expect(page.bodies().map((body) => body.session)).toEqual([undefined, undefined]);
  });

  test("Enter sends the question and Shift+Enter does not", () => {
    const page = install();
    page.type("Hei");
    expect(page.press("Enter", true)).toBe(false);
    expect(page.messages()).toEqual(["Hei!"]);
    expect(page.press("Enter")).toBe(true);
    expect(page.messages()).toEqual(["Hei!", "Hei"]);
  });

  test("a click on an example sends its text", () => {
    const page = install();
    page.example.click();
    expect(page.messages()).toEqual(["Hei!", "Hvordan endrer jeg passord?"]);
    expect(page.examples.hidden).toBe(true);
  });

  test("a new chat removes the added messages and shows the examples, without a reload", () => {
    const page = install();
    page.type("Hvor er fakturaene?");
    page.send.click();
    page.type("Halvskrevet");
    page.newChat.click();
    expect(page.messages()).toEqual(["Hei!"]);
    expect(page.typing()).toBe(0);
    expect(page.examples.hidden).toBe(false);
    expect(page.textarea.value).toBe("");
    expect(page.doc.activeElement).toBe(page.textarea);
    expect(aiAgentHandlers.toString()).not.toContain("reload");
  });

  test("the question is set as text and nothing is set as HTML", () => {
    const source = aiAgentHandlers.toString();
    expect(source).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML/);
    expect(source).toContain("textContent = question");
  });

  test.each([
    ["a paragraph", "Hei der", "<p>Hei der</p>"],
    ["lines in one paragraph", "Linje en\nLinje to", "<p>Linje en<br></br>Linje to</p>"],
    ["two paragraphs", "En\n\nTo", "<p>En</p><p>To</p>"],
    [
      "a bullet list with bold text",
      "* **SSO (Single Sign-On):** logg inn én gang\n- Roller",
      "<ul><li><strong>SSO (Single Sign-On):</strong> logg inn én gang</li><li>Roller</li></ul>",
    ],
    ["a numbered list", "1. Først\n2. Så", "<ol><li>Først</li><li>Så</li></ol>"],
    [
      "a heading, a paragraph and a list",
      "## Tilgang\nSlik gjør du:\n* Gå til Tilgang",
      "<p><strong>Tilgang</strong></p><p>Slik gjør du:</p><ul><li>Gå til Tilgang</li></ul>",
    ],
    ["a ** without a partner", "2 ** 3", "<p>2 ** 3</p>"],
    ["a link, which stays text", "[Entur](https://entur.no)", "<p>[Entur](https://entur.no)</p>"],
    [
      "HTML, which stays text",
      "<img src=x onerror=alert(1)>",
      "<p><img src=x onerror=alert(1)></p>",
    ],
  ])("shows the markdown in an answer: %s", async (_name, reply, markup) => {
    const page = install({ respond: () => Response.json({ reply, session: "s-1" }) });
    page.type("Hei");
    page.send.click();
    await answered();
    expect(page.lastBubble()).toBe(markup);
  });

  test("HTML in an answer is added as text, not as elements", async () => {
    const page = install({
      respond: () => Response.json({ reply: "<script>alert(1)</script>", session: "s-1" }),
    });
    page.type("Hei");
    page.send.click();
    await answered();
    const answer = page.chatWindow.querySelectorAll(".uniformen-chat-bubble").at(-1);
    expect(answer?.children.map((child) => child.tagName)).toEqual(["p"]);
    expect(answer?.children[0]?.children.map((child) => child.tagName)).toEqual(["#text"]);
  });
});
