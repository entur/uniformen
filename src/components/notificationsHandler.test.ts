import { afterEach, describe, expect, test } from "bun:test";
import notificationsHandler from "./notificationsHandler";

/**
 * The handler is sent to the browser as source text, so it only uses browser globals.
 * These fakes provide the parts the handler touches, and the tests run the real
 * handler against them. `setTimeout` is faked too, so a test can decide when the
 * handler gives up waiting instead of waiting a real second.
 */
class FakeElement {
  constructor(
    readonly attributes: Record<string, string> = {},
    private readonly parent: FakeElement | null = null,
  ) {}

  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  closest(selector: string): FakeElement | null {
    const attribute = selector.slice(1, -1);
    if (attribute in this.attributes) return this;
    return this.parent?.closest(selector) ?? null;
  }
}

class FakeAnchor extends FakeElement {
  constructor(
    readonly href: string,
    attributes: Record<string, string>,
    parent: FakeElement | null,
  ) {
    super(attributes, parent);
  }
}

class FakeMouseEvent {
  defaultPrevented = false;
  prevented = 0;
  button = 0;
  metaKey = false;
  ctrlKey = false;
  shiftKey = false;
  altKey = false;

  constructor(readonly target: unknown) {}

  preventDefault(): void {
    this.prevented++;
    this.defaultPrevented = true;
  }
}

class FakeDocument {
  private readonly listeners: ((event: unknown) => void)[] = [];

  addEventListener(type: string, listener: (event: unknown) => void): void {
    if (type === "click") this.listeners.push(listener);
  }

  fire(event: unknown): void {
    for (const listener of this.listeners) listener(event);
  }
}

/** Lets the test decide when a promise is done. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** Runs the microtasks the handler queues after the delete settles. */
const settle = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

const globals = globalThis as unknown as Record<string, unknown>;
const saved = {
  Element: globals["Element"],
  HTMLAnchorElement: globals["HTMLAnchorElement"],
  MouseEvent: globals["MouseEvent"],
  document: globals["document"],
  location: globals["location"],
  fetch: globals["fetch"],
  setTimeout: globals["setTimeout"],
};

const PROXY_URL = "https://uniformen.dev.entur.no/notifications-proxy";
const DESTINATION = "https://entur-partner.dev.entur.org/permission-admin/requests/request/7";

function install() {
  const doc = new FakeDocument();
  const assigned: string[] = [];
  const requests: { url: string; init: RequestInit }[] = [];
  const giveUp: (() => void)[] = [];
  const answer = deferred<Response>();

  globals["Element"] = FakeElement;
  globals["HTMLAnchorElement"] = FakeAnchor;
  globals["MouseEvent"] = FakeMouseEvent;
  globals["document"] = doc;
  globals["location"] = { assign: (href: string) => assigned.push(href) };
  globals["fetch"] = (url: string, init: RequestInit) => {
    requests.push({ url, init });
    return answer.promise;
  };
  globals["setTimeout"] = (callback: () => void) => {
    giveUp.push(callback);
    return 0;
  };

  notificationsHandler();

  const list = new FakeElement({ "data-uniformen-notifications-url": PROXY_URL });
  const item = (attributes: Record<string, string>) =>
    new FakeAnchor(DESTINATION, attributes, list);

  return {
    assigned,
    requests,
    /** Clicks a notification. `event` can change the click, e.g. `{ ctrlKey: true }`. */
    click(
      event: Partial<FakeMouseEvent> = {},
      attributes: Record<string, string> = { "data-uniformen-notification-token": "a-token" },
    ) {
      const click = Object.assign(new FakeMouseEvent(item(attributes)), event);
      doc.fire(click);
      return click;
    },
    clickElsewhere: () => doc.fire(new FakeMouseEvent(new FakeElement({ class: "my-app" }))),
    /** Lets uniformen answer the delete. */
    deleted: () => answer.resolve(new Response(null, { status: 204 })),
    /** Runs the wait the handler set up, as if the answer never came. */
    timeOut: () => giveUp.forEach((callback) => callback()),
  };
}

afterEach(() => {
  for (const [name, value] of Object.entries(saved)) globals[name] = value;
});

describe("notificationsHandler", () => {
  test("a click asks uniformen to delete the notification", async () => {
    const page = install();

    page.click();

    expect(page.requests).toHaveLength(1);
    expect(page.requests[0]?.url).toBe(PROXY_URL);
    expect(page.requests[0]?.init.method).toBe("POST");
    expect(page.requests[0]?.init.headers).toEqual({ Authorization: "Bearer a-token" });
  });

  test("the page does not send cookies, and the request survives the navigation", () => {
    const page = install();

    page.click();

    expect(page.requests[0]?.init.credentials).toBe("omit");
    expect(page.requests[0]?.init.keepalive).toBe(true);
  });

  test("the link waits for the answer, so the next page sees the notification gone", async () => {
    const page = install();

    const click = page.click();
    await settle();
    expect(click.prevented).toBe(1);
    expect(page.assigned).toBeEmpty();

    page.deleted();
    await settle();

    expect(page.assigned).toEqual([DESTINATION]);
  });

  test("the link is followed anyway when uniformen does not answer in time", async () => {
    const page = install();
    page.click();
    await settle();

    page.timeOut();
    await settle();

    expect(page.assigned).toEqual([DESTINATION]);
  });

  test("the page is left once, even after the answer arrives late", async () => {
    const page = install();
    page.click();
    await settle();

    page.timeOut();
    page.deleted();
    await settle();

    expect(page.assigned).toEqual([DESTINATION]);
  });

  test("a ctrl-click opens a new tab as usual, and still deletes", async () => {
    const page = install();

    const click = page.click({ ctrlKey: true });
    await settle();

    expect(click.prevented).toBe(0);
    expect(page.assigned).toBeEmpty();
    expect(page.requests).toHaveLength(1);
  });

  test("a middle click is left alone too", async () => {
    const page = install();

    const click = page.click({ button: 1 });
    await settle();

    expect(click.prevented).toBe(0);
    expect(page.assigned).toBeEmpty();
  });

  test("an item with no token is not deleted and not held back", async () => {
    const page = install();

    const click = page.click({}, {});
    await settle();

    expect(page.requests).toBeEmpty();
    expect(click.prevented).toBe(0);
  });

  test("clicks elsewhere in the app do nothing", async () => {
    const page = install();

    page.clickElsewhere();
    await settle();

    expect(page.requests).toBeEmpty();
    expect(page.assigned).toBeEmpty();
  });
});
