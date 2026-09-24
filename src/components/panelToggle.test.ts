import { afterEach, describe, expect, test } from "bun:test";
import panelToggle from "./panelToggle";
import retargetEnvironmentLinks from "./retargetEnvironmentLinks";

/**
 * The handler is sent to the browser as source text, so it only uses browser globals.
 * These fakes provide the parts of `document`, `window.location` and the DOM classes
 * that it uses, and the tests run the real handler against them.
 */
class FakeElement {
  private readonly attributes = new Map<string, string>();
  focused = 0;
  /** Called when the element gets focus. The setup uses it to set `document.activeElement`. */
  onFocus?: (element: FakeElement) => void;

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  focus(): void {
    this.focused += 1;
    this.onFocus?.(this);
  }

  /** Nothing is nested inside the toggle in these tests. */
  contains(node: unknown): boolean {
    return node === this;
  }
}

/** A row in a panel. It can be a link or one of the language options. */
class FakeItem extends FakeElement {
  constructor(
    readonly name: string,
    checked?: boolean,
    readonly inGroup = false,
  ) {
    super();
    if (checked !== undefined) this.setAttribute("aria-checked", checked ? "true" : "false");
  }

  get tabindex(): string | null {
    return this.getAttribute("tabindex");
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

/**
 * The group that holds the language options. A panel without language options has
 * no group, so `querySelector('[role="menu"]')` returns null for it.
 */
class FakeGroup extends FakeElement {
  private readonly listeners: ((event: unknown) => void)[] = [];

  constructor(readonly options: FakeItem[]) {
    super();
  }

  querySelectorAll(selector: string): FakeItem[] {
    expect(selector).toBe('[role="menuitemradio"]');
    return this.options;
  }

  override contains(node: unknown): boolean {
    return node === this || this.options.indexOf(node as FakeItem) !== -1;
  }

  addEventListener(_type: "focusin", listener: (event: unknown) => void): void {
    this.listeners.push(listener);
  }

  fire(event: unknown): void {
    for (const listener of this.listeners) listener(event);
  }
}

class FakePanel extends FakeElement {
  private readonly listeners = new Map<string, ((event: unknown) => void)[]>();

  constructor(
    readonly links: FakeAnchor[],
    readonly items: FakeItem[] = [],
    readonly group: FakeGroup | null = null,
  ) {
    super();
  }

  querySelectorAll(selector: string): FakeAnchor[] | FakeItem[] {
    if (selector === "a[data-uniformen-env-switcher-link]") return this.links;
    expect(selector).toBe("a[href], button:not([disabled])");
    return this.items;
  }

  querySelector(selector: string): FakeGroup | null {
    expect(selector).toBe('[role="menu"]');
    return this.group;
  }

  override contains(node: unknown): boolean {
    return node === this || this.items.indexOf(node as FakeItem) !== -1;
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

class FakeDocument {
  private readonly listeners = new Map<string, ((event: unknown) => void)[]>();
  /** Records the selector and id the handler asked for, so a test can check them. */
  readonly asked: { selector?: string; id?: string } = {};
  /** The element that was focused last. This is the fake `document.activeElement`. */
  activeElement: unknown = null;

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

/** The bare hosts of the target environments, as the server renders them in the links. */
const HOSTS = [
  "https://cleos-client.staging.entur.io",
  "https://cleos-client.dev.entur.io",
  "https://cleos.entur.org",
];

function install({
  location = { pathname: "/", search: "", hash: "" },
  toggle: withToggle = true,
  panel: withPanel = true,
  group: withGroup = "none",
  roved = false,
  beforeOpen,
}: {
  location?: { pathname: string; search: string; hash: string };
  toggle?: boolean;
  panel?: boolean;
  /**
   * What the panel contains. `none` is a plain list, like the app switcher. `section`
   * is a radio group between other rows, like the user menu. `only` is just the radio
   * group, like the language chip in the bar.
   */
  group?: "none" | "section" | "only";
  /** Sets tabindex 0 on the checked option and -1 on the others, as the server renders them. */
  roved?: boolean;
  beforeOpen?: (panel: HTMLElement) => void;
} = {}) {
  const toggle = withToggle ? new FakeToggle() : null;
  toggle?.setAttribute("aria-expanded", "false");
  const links = HOSTS.map((host) => new FakeAnchor(host));

  const options =
    withGroup === "none"
      ? []
      : [
          new FakeItem("nb-NO", false, true),
          new FakeItem("nn-NO", true, true),
          new FakeItem("en-GB", false, true),
        ];
  const items =
    withGroup === "section"
      ? // The same shape as the user menu: a link, the languages, then logout.
        [new FakeItem("account"), ...options, new FakeItem("logout")]
      : withGroup === "only"
        ? options
        : [new FakeItem("first"), new FakeItem("second"), new FakeItem("third")];
  if (roved)
    for (const option of options)
      option.setAttribute("tabindex", option.getAttribute("aria-checked") === "true" ? "0" : "-1");
  const group = withGroup === "none" ? null : new FakeGroup(options);
  const panel = withPanel ? new FakePanel(links, items, group) : null;
  const doc = new FakeDocument(toggle, panel);
  // When an option gets focus, fire `focusin` on the group, as the browser does when
  // the event bubbles. This happens however the focus moved there.
  for (const item of items)
    item.onFocus = (element) => {
      doc.activeElement = element;
      if (element instanceof FakeItem && element.inGroup) group?.fire({ target: element });
    };

  globals["HTMLElement"] = FakeElement;
  globals["HTMLAnchorElement"] = FakeAnchor;
  globals["Node"] = FakeElement;
  globals["document"] = doc;
  globals["window"] = { location };

  panelToggle("[data-uniformen-test-toggle]", "uniformen-test-panel", beforeOpen);

  const press = (key: string) => {
    let prevented = 0;
    panel?.fire("keydown", { key, preventDefault: () => (prevented += 1) });
    return prevented;
  };
  return {
    asked: () => doc.asked,
    hrefs: () => links.map((link) => link.href),
    aria: () => toggle?.getAttribute("aria-expanded"),
    focused: () => toggle?.focused ?? 0,
    /** Returns the name of the focused item. */
    active: () => (doc.activeElement instanceof FakeItem ? doc.activeElement.name : null),
    /** Returns the tabindex of each option in order. */
    tabstops: () => options.map((option) => option.tabindex),
    toggleClick: () => toggle?.click(),
    clickOutside: () => doc.fire("click", { target: new FakeElement() }),
    clickInside: () => doc.fire("click", { target: panel }),
    escape: () => doc.fire("keydown", { key: "Escape" }),
    tab: () => doc.fire("keydown", { key: "Tab" }),
    press,
    /** Fires `focusout` on the panel with `to` as the new focus target, or no target. */
    focusOut: (to: unknown = null) => panel?.fire("focusout", { relatedTarget: to }),
    firstItem: () => items[0],
    /** Focuses an option the way a mouse click does, without a key press. */
    clickOption: (name: string) => options.filter((option) => option.name === name)[0]?.focus(),
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

describe("panelToggle keyboard model", () => {
  test("opening moves focus into the panel, so the keyboard does not land nowhere", () => {
    const dom = install();
    dom.toggleClick();
    expect(dom.active()).toBe("first");
  });

  test("a panel that is nothing but the languages opens on the checked one", () => {
    const dom = install({ group: "only" });
    dom.toggleClick();
    expect(dom.active()).toBe("nn-NO");
  });

  test("a menu that merely contains them opens at the top, not on the language", () => {
    const dom = install({ group: "section" });
    dom.toggleClick();
    expect(dom.active()).toBe("account");
  });

  test("Up and Down step through the panel and wrap around it", () => {
    const dom = install();
    dom.toggleClick();
    dom.press("ArrowDown");
    expect(dom.active()).toBe("second");
    dom.press("ArrowDown");
    dom.press("ArrowDown");
    expect(dom.active()).toBe("first");
    dom.press("ArrowUp");
    expect(dom.active()).toBe("third");
  });

  test("Home and End are the two ends, from wherever focus is", () => {
    const dom = install();
    dom.toggleClick();
    dom.press("End");
    expect(dom.active()).toBe("third");
    dom.press("Home");
    expect(dom.active()).toBe("first");
  });

  test("the arrows cross the whole panel, group or no group", () => {
    const dom = install({ group: "section" });
    dom.toggleClick();
    expect(dom.active()).toBe("account");
    dom.press("ArrowDown");
    expect(dom.active()).toBe("nb-NO");
    dom.press("ArrowUp");
    expect(dom.active()).toBe("account");
    // ArrowUp on the first row wraps around to the last row.
    dom.press("ArrowUp");
    expect(dom.active()).toBe("logout");
  });

  test("only our keys are taken: the page keeps the rest", () => {
    const dom = install();
    dom.toggleClick();
    expect(dom.press("ArrowDown")).toBe(1);
    expect(dom.press("PageDown")).toBe(0);
    expect(dom.press("k")).toBe(0);
  });

  test("Tab out closes it: an open panel behind the focus is one the user can't see", () => {
    const dom = install();
    dom.toggleClick();
    dom.focusOut(new FakeElement());
    expect(dom.aria()).toBe("false");
  });

  test("focus moving within the panel is not leaving it", () => {
    const dom = install();
    dom.toggleClick();
    dom.focusOut(dom.firstItem());
    expect(dom.aria()).toBe("true");
  });

  test("focus going nowhere is not leaving either: the panel outlives a click on itself", () => {
    // `relatedTarget` is null, as it is when the user clicks the panel's heading or
    // padding.
    const dom = install();
    dom.toggleClick();
    dom.focusOut();
    expect(dom.aria()).toBe("true");
  });
});

describe("panelToggle roving tabindex", () => {
  test("the radio group is one tab stop, on the checked option", () => {
    const dom = install({ group: "section" });
    expect(dom.tabstops()).toEqual(["-1", "0", "-1"]);
  });

  test("the tab stop follows the arrows, so tabbing back returns where you left off", () => {
    const dom = install({ group: "section" });
    dom.toggleClick();
    dom.press("ArrowDown");
    expect(dom.active()).toBe("nb-NO");
    expect(dom.tabstops()).toEqual(["0", "-1", "-1"]);
  });

  test("leaving the group leaves its tab stop where it was", () => {
    const dom = install({ group: "section" });
    dom.toggleClick();
    for (const _ of [0, 1, 2]) dom.press("ArrowDown");
    expect(dom.active()).toBe("en-GB");
    dom.press("ArrowDown");
    expect(dom.active()).toBe("logout");
    expect(dom.tabstops()).toEqual(["-1", "-1", "0"]);
  });

  test("the tab stop follows a click too, not only the arrows", () => {
    const dom = install({ group: "section" });
    dom.toggleClick();
    dom.clickOption("en-GB");
    expect(dom.tabstops()).toEqual(["-1", "-1", "0"]);
  });

  test("opening on an option puts the stop there, so the two never disagree", () => {
    const dom = install({ group: "only" });
    dom.toggleClick();
    dom.press("ArrowDown");
    expect(dom.tabstops()).toEqual(["-1", "-1", "0"]);
    dom.escape();
    dom.toggleClick();
    expect(dom.active()).toBe("nn-NO");
    expect(dom.tabstops()).toEqual(["-1", "0", "-1"]);
  });

  test("a group that arrives roved is left holding the values it came with", () => {
    const dom = install({ group: "section", roved: true });
    expect(dom.tabstops()).toEqual(["-1", "0", "-1"]);
  });

  test("a panel without a group is left alone: every row keeps its own tab stop", () => {
    const dom = install();
    dom.toggleClick();
    dom.press("ArrowDown");
    expect(dom.tabstops()).toEqual([]);
  });
});

describe("panelToggle beforeOpen", () => {
  test("runs on the way up, with the panel, and not on the way down", () => {
    const seen: unknown[] = [];
    const dom = install({ beforeOpen: (panel) => seen.push(panel) });
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
    // Simulate a client-side route change between the two opens.
    location.pathname = "/invoices";
    dom.toggleClick();
    expect(dom.hrefs()).toEqual([
      "https://cleos-client.staging.entur.io/invoices",
      "https://cleos-client.dev.entur.io/invoices",
      "https://cleos.entur.org/invoices",
    ]);
  });
});
