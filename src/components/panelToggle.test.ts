import { afterEach, describe, expect, test } from "bun:test";
import panelToggle from "./panelToggle";
import retargetEnvironmentLinks from "./retargetEnvironmentLinks";

/**
 * The handler ships as serialized source to the browser, so it only touches
 * `document`, `window.location` and the handful of DOM interfaces below. Rather
 * than pull in a full DOM implementation, install the slice it uses and run the
 * real handler against it — the same approach `sidebarHandlers.test` takes.
 */
class FakeElement {
  private readonly attributes = new Map<string, string>();
  focused = 0;

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  focus(): void {
    this.focused += 1;
  }

  /** Nothing is nested inside the toggle in these tests. */
  contains(node: unknown): boolean {
    return node === this;
  }
}

class FakeToggle extends FakeElement {
  private readonly listeners: (() => void)[] = [];

  addEventListener(_type: "click", listener: () => void): void {
    this.listeners.push(listener);
  }

  click(): void {
    for (const listener of this.listeners) listener();
  }
}

class FakeAnchor {
  constructor(public href: string) {}
}

class FakePanel extends FakeElement {
  constructor(readonly links: FakeAnchor[]) {
    super();
  }

  querySelectorAll(selector: string): FakeAnchor[] {
    expect(selector).toBe("a[data-uniformen-env-switcher-link]");
    return this.links;
  }
}

class FakeDocument {
  private readonly listeners = new Map<string, ((event: unknown) => void)[]>();
  /** What the handler went looking for, so a caller's selectors can be checked. */
  readonly asked: { selector?: string; id?: string } = {};

  constructor(
    private readonly toggle: FakeToggle | null,
    private readonly panel: FakePanel | null,
  ) {}

  querySelector(selector: string): FakeToggle | null {
    this.asked.selector = selector;
    return this.toggle;
  }

  getElementById(id: string): FakePanel | null {
    this.asked.id = id;
    return this.panel;
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    const existing = this.listeners.get(type) ?? [];
    existing.push(listener);
    this.listeners.set(type, existing);
  }

  fire(type: string, event: unknown = {}): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

const globals = globalThis as unknown as Record<string, unknown>;
const saved = {
  HTMLElement: globals["HTMLElement"],
  HTMLAnchorElement: globals["HTMLAnchorElement"],
  Node: globals["Node"],
  document: globals["document"],
  window: globals["window"],
};

/** What the server renders: the target environments' bare hosts. */
const HOSTS = [
  "https://cleos-client.staging.entur.io",
  "https://cleos-client.dev.entur.io",
  "https://cleos.entur.org",
];

function install({
  location = { pathname: "/", search: "", hash: "" },
  toggle: withToggle = true,
  panel: withPanel = true,
  beforeOpen,
}: {
  location?: { pathname: string; search: string; hash: string };
  toggle?: boolean;
  panel?: boolean;
  beforeOpen?: (panel: HTMLElement) => void;
} = {}) {
  const toggle = withToggle ? new FakeToggle() : null;
  toggle?.setAttribute("aria-expanded", "false");
  const links = HOSTS.map((host) => new FakeAnchor(host));
  const panel = withPanel ? new FakePanel(links) : null;
  const doc = new FakeDocument(toggle, panel);

  globals["HTMLElement"] = FakeElement;
  globals["HTMLAnchorElement"] = FakeAnchor;
  globals["Node"] = FakeElement;
  globals["document"] = doc;
  globals["window"] = { location };

  panelToggle("[data-uniformen-test-toggle]", "uniformen-test-panel", beforeOpen);
  return {
    asked: () => doc.asked,
    hrefs: () => links.map((link) => link.href),
    aria: () => toggle?.getAttribute("aria-expanded"),
    focused: () => toggle?.focused ?? 0,
    toggleClick: () => toggle?.click(),
    clickOutside: () => doc.fire("click", { target: new FakeElement() }),
    clickInside: () => doc.fire("click", { target: panel }),
    escape: () => doc.fire("keydown", { key: "Escape" }),
    tab: () => doc.fire("keydown", { key: "Tab" }),
  };
}

afterEach(() => {
  globals["HTMLElement"] = saved.HTMLElement;
  globals["HTMLAnchorElement"] = saved.HTMLAnchorElement;
  globals["Node"] = saved.Node;
  globals["document"] = saved.document;
  globals["window"] = saved.window;
});

describe("panelToggle opening and closing", () => {
  test("the toggle and the panel are the ones the call names", () => {
    const dom = install();
    expect(dom.asked()).toEqual({
      selector: "[data-uniformen-test-toggle]",
      id: "uniformen-test-panel",
    });
  });

  test("clicking the chip opens it, clicking again closes it", () => {
    const dom = install();
    dom.toggleClick();
    expect(dom.aria()).toBe("true");
    dom.toggleClick();
    expect(dom.aria()).toBe("false");
  });

  test("a click outside closes it", () => {
    const dom = install();
    dom.toggleClick();
    dom.clickOutside();
    expect(dom.aria()).toBe("false");
  });

  test("a click on the panel keeps it open, so a link stays clickable", () => {
    const dom = install();
    dom.toggleClick();
    dom.clickInside();
    expect(dom.aria()).toBe("true");
  });

  test("Escape closes it and hands focus back to the chip", () => {
    const dom = install();
    dom.toggleClick();
    dom.escape();
    expect(dom.aria()).toBe("false");
    expect(dom.focused()).toBe(1);
  });

  test("Escape while closed does not steal focus", () => {
    const dom = install();
    dom.escape();
    expect(dom.focused()).toBe(0);
  });

  test("other keys are left alone", () => {
    const dom = install();
    dom.toggleClick();
    dom.tab();
    expect(dom.aria()).toBe("true");
  });

  test("markup that is not there is not a crash: the same bundle serves every header", () => {
    expect(() => install({ toggle: false })).not.toThrow();
    expect(() => install({ panel: false })).not.toThrow();
  });
});

describe("panelToggle beforeOpen", () => {
  test("runs on the way up, with the panel, and not on the way down", () => {
    const seen: unknown[] = [];
    const dom = install({ beforeOpen: (panel) => seen.push(panel) });
    // Nothing before the first click: a link must never be rewritten while the
    // panel it is in is still hidden.
    expect(seen).toHaveLength(0);
    dom.toggleClick();
    expect(seen).toEqual([expect.any(FakePanel)]);
    dom.toggleClick();
    expect(seen).toHaveLength(1);
  });

  test("a panel without one opens all the same", () => {
    const dom = install();
    dom.toggleClick();
    expect(dom.aria()).toBe("true");
  });
});

describe("retargetEnvironmentLinks", () => {
  const installEnv = (location: { pathname: string; search: string; hash: string }) =>
    install({ location, beforeOpen: retargetEnvironmentLinks });

  test("the current page's path and hash follow the user across", () => {
    const dom = installEnv({ pathname: "/orders/42", search: "", hash: "#row-3" });
    dom.toggleClick();
    expect(dom.hrefs()).toEqual([
      "https://cleos-client.staging.entur.io/orders/42#row-3",
      "https://cleos-client.dev.entur.io/orders/42#row-3",
      "https://cleos.entur.org/orders/42#row-3",
    ]);
  });

  test("the query string is left behind: its ids and filters mean nothing there", () => {
    const dom = installEnv({ pathname: "/orders", search: "?id=8f21&tab=lines", hash: "" });
    dom.toggleClick();
    expect(dom.hrefs()).toEqual([
      "https://cleos-client.staging.entur.io/orders",
      "https://cleos-client.dev.entur.io/orders",
      "https://cleos.entur.org/orders",
    ]);
  });

  test("nothing is rewritten before the panel opens, so the fallback href survives", () => {
    const dom = installEnv({ pathname: "/orders", search: "", hash: "" });
    expect(dom.hrefs()).toEqual(HOSTS);
  });

  test("the path is not compounded when the panel is opened again", () => {
    const location = { pathname: "/orders", search: "", hash: "" };
    const dom = installEnv(location);
    dom.toggleClick();
    dom.toggleClick();
    // A client-side route change between the two opens: the second open must
    // replace the first target, not append to it.
    location.pathname = "/invoices";
    dom.toggleClick();
    expect(dom.hrefs()).toEqual([
      "https://cleos-client.staging.entur.io/invoices",
      "https://cleos-client.dev.entur.io/invoices",
      "https://cleos.entur.org/invoices",
    ]);
  });
});
