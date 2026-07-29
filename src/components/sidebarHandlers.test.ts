import { afterEach, describe, expect, test } from "bun:test";
import sidebarHandlers from "./sidebarHandlers";

/**
 * The handler ships as serialized source to the browser, so it only touches
 * `document`, `window`, `localStorage`, `MutationObserver` and the DOM interfaces
 * below. Rather than pull in a full DOM implementation, install the slice it uses
 * and run the real handler against it.
 */
class FakeElement {
  private readonly attributes = new Map<string, string>();
  readonly observers: (() => void)[] = [];

  constructor(readonly selector?: string) {}

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
    for (const observer of this.observers) observer();
  }

  /** What delegation resolves a click on the button, or on the icon inside it, to. */
  closest(selector: string): FakeElement | null {
    return selector === this.selector ? this : null;
  }
}

/** An element inside the button — where a click on the chevron actually lands. */
class FakeChild extends FakeElement {
  constructor(private readonly parent: FakeElement) {
    super();
  }

  override closest(selector: string): FakeElement | null {
    return this.parent.closest(selector);
  }
}

/**
 * Fires once per write, where the real observer coalesces the writes in a task into
 * a single microtask callback. Safe to simplify because the callback re-reads the
 * attribute and compares it to the last published state instead of reading the
 * mutation records — one callback or three, it reaches the same answer.
 */
class FakeMutationObserver {
  constructor(private readonly callback: () => void) {}

  observe(target: FakeElement, options: { attributeFilter: string[] }): void {
    // The handler must not observe the whole subtree: on a large app page that is
    // a callback per DOM mutation.
    expect(options.attributeFilter).toEqual(["data-uniformen-sidebar"]);
    target.observers.push(this.callback);
  }
}

/**
 * Clicks are delegated from `document` and the button is looked up per change, since
 * the handler runs from the head with no button parsed yet. `parse` is that button
 * arriving.
 */
class FakeDocument {
  private readonly listeners = new Map<string, ((event: unknown) => void)[]>();
  private button: FakeElement | null = null;

  constructor(
    readonly documentElement: FakeElement,
    public readyState: string,
  ) {}

  querySelector(): FakeElement | null {
    return this.button;
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    const existing = this.listeners.get(type) ?? [];
    existing.push(listener);
    this.listeners.set(type, existing);
  }

  fire(type: string, event: unknown = {}): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  parse(button: FakeElement): void {
    this.button = button;
  }
}

class FakeWindow {
  readonly announced: CustomEvent<{ collapsed: boolean }>[] = [];

  dispatchEvent(event: Event): boolean {
    this.announced.push(event as CustomEvent<{ collapsed: boolean }>);
    return true;
  }
}

const globals = globalThis as unknown as Record<string, unknown>;
const saved = {
  Element: globals["Element"],
  MutationObserver: globals["MutationObserver"],
  document: globals["document"],
  localStorage: globals["localStorage"],
  window: globals["window"],
};

const TOGGLE = "[data-uniformen-sidebar-toggle]";

function install({
  stored,
  storageThrows = false,
  rendered,
  button = "parsed",
  readyState = "loading",
}: {
  /** The user's stored preference, as `localStorage` holds it. */
  stored?: string;
  storageThrows?: boolean;
  /** `data-uniformen-sidebar` the app server-rendered on `<html>`. */
  rendered?: string;
  /** Whether the button is in the document when the head script runs, later, or never. */
  button?: "parsed" | "unparsed" | "absent";
  readyState?: string;
} = {}) {
  const root = new FakeElement();
  if (rendered !== undefined) root.setAttribute("data-uniformen-sidebar", rendered);
  const storage = new Map<string, string>();
  if (stored !== undefined) storage.set("uniformen:sidebar", stored);
  const toggle = button === "absent" ? null : new FakeElement(TOGGLE);
  const doc = new FakeDocument(root, readyState);
  if (toggle && button === "parsed") doc.parse(toggle);
  const win = new FakeWindow();

  globals["Element"] = FakeElement;
  globals["MutationObserver"] = FakeMutationObserver;
  globals["document"] = doc;
  globals["localStorage"] = {
    getItem: (key: string) => {
      if (storageThrows) throw new Error("storage disabled");
      return storage.get(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      if (storageThrows) throw new Error("storage disabled");
      storage.set(key, value);
    },
  };
  globals["window"] = win;

  sidebarHandlers();
  return {
    storage,
    announced: win.announced,
    state: () => root.getAttribute("data-uniformen-sidebar"),
    aria: () => toggle?.getAttribute("aria-expanded"),
    click: () => doc.fire("click", { target: toggle }),
    /** A click on the chevron inside the button, which is where clicks land. */
    clickIcon: () => doc.fire("click", { target: toggle && new FakeChild(toggle) }),
    clickElsewhere: () => doc.fire("click", { target: new FakeElement("main") }),
    /** The button being parsed, and the document reaching `DOMContentLoaded`. */
    ready: () => {
      if (toggle) doc.parse(toggle);
      doc.fire("DOMContentLoaded");
    },
    // What an app does with its own close button, shortcut or route change.
    push: (value: string) => root.setAttribute("data-uniformen-sidebar", value),
  };
}

afterEach(() => {
  globals["Element"] = saved.Element;
  globals["MutationObserver"] = saved.MutationObserver;
  globals["document"] = saved.document;
  globals["localStorage"] = saved.localStorage;
  globals["window"] = saved.window;
});

describe("sidebarHandlers restoring the state", () => {
  test("a stored collapsed state is restored, so the collapsed width is what paints", () => {
    expect(install({ stored: "collapsed" }).state()).toBe("collapsed");
  });

  test("nothing stored means expanded", () => {
    expect(install().state()).toBe("expanded");
  });

  test("a stored value nothing agrees on is not trusted", () => {
    expect(install({ stored: "halfway" }).state()).toBe("expanded");
  });

  test("storage that throws still leaves the page in a known state", () => {
    expect(install({ storageThrows: true }).state()).toBe("expanded");
  });
});

describe("sidebarHandlers with the attribute already server-rendered", () => {
  test("the app's own default survives, so collapsed-by-default is possible", () => {
    expect(install({ rendered: "collapsed" }).state()).toBe("collapsed");
  });

  test("unreadable storage falls through to the app's value rather than expanded", () => {
    expect(install({ rendered: "collapsed", storageThrows: true }).state()).toBe("collapsed");
  });

  test("the stored preference still wins: it is the user's, the markup's is a default", () => {
    expect(install({ rendered: "collapsed", stored: "expanded" }).state()).toBe("expanded");
  });

  test("a rendered value nothing agrees on is replaced, not kept", () => {
    expect(install({ rendered: "halfway" }).state()).toBe("expanded");
  });

  test("restoring is not announced: it is the state the page starts in", () => {
    expect(install({ stored: "collapsed" }).announced).toEqual([]);
  });

  test("the app's default is not written to storage, since it is not the user's choice", () => {
    // Storing it would make a per-request server default stick as a preference, and
    // there would be no telling it apart from a state the user picked.
    const { storage, announced } = install({ rendered: "collapsed" });

    expect([...storage.keys()]).toEqual([]);
    expect(announced).toEqual([]);
  });

  test("a state the user picks is stored, and outranks the app's default from then on", () => {
    const { storage, click } = install({ rendered: "collapsed" });

    click();

    expect(storage.get("uniformen:sidebar")).toBe("expanded");
  });
});

describe("sidebarHandlers button", () => {
  test("clicking collapses the sidebar by writing the root attribute", () => {
    const { state, click } = install();

    click();

    expect(state()).toBe("collapsed");
  });

  test("clicking again expands it", () => {
    const { state, click } = install();

    click();
    click();

    expect(state()).toBe("expanded");
  });

  test("a click on the icon inside the button counts, since that is where it lands", () => {
    const { state, clickIcon } = install();

    clickIcon();

    expect(state()).toBe("collapsed");
  });

  test("a click anywhere else is left alone", () => {
    const { state, announced, clickElsewhere } = install();

    clickElsewhere();

    expect(state()).toBe("expanded");
    expect(announced).toEqual([]);
  });

  test("a click announces the new state once", () => {
    const { announced, click } = install();

    click();

    expect(announced).toHaveLength(1);
    expect(announced[0]?.type).toBe("uniformen:sidebar");
    expect(announced[0]?.detail).toEqual({ collapsed: true });
  });

  test("aria-expanded follows the state, so the two can't disagree", () => {
    const { aria, click } = install();

    click();
    expect(aria()).toBe("false");
    click();
    expect(aria()).toBe("true");
  });

  test("a restored collapsed state corrects the aria-expanded the server rendered", () => {
    // The markup ships `aria-expanded="true"`: the server can't know the state. The
    // head script runs before the button is parsed, so the fix waits for the load.
    const { aria, ready } = install({ stored: "collapsed", button: "unparsed" });

    ready();

    expect(aria()).toBe("false");
  });

  test("a document already parsed is corrected on the spot, not on an event that has been and gone", () => {
    const { aria } = install({ stored: "collapsed", readyState: "complete" });

    expect(aria()).toBe("false");
  });
});

describe("sidebarHandlers state written by the app", () => {
  test("the app's own control collapses the sidebar, and is announced like a click", () => {
    const { aria, announced, push } = install();

    push("collapsed");

    expect(aria()).toBe("false");
    expect(announced.map((event) => event.detail.collapsed)).toEqual([true]);
  });

  test("a write before the button is parsed is still announced and persisted", () => {
    // The reason the handler runs from the head: an app that writes the attribute
    // early — an inline script, a blocking bundle — would otherwise have that write
    // read as the starting state, so it would reach neither storage nor the event.
    const { state, storage, announced, push } = install({ button: "unparsed" });

    push("collapsed");

    expect(state()).toBe("collapsed");
    expect(storage.get("uniformen:sidebar")).toBe("collapsed");
    expect(announced.map((event) => event.detail.collapsed)).toEqual([true]);
  });

  test("clicking after the app wrote the state continues from it", () => {
    const { state, announced, click, push } = install();

    push("collapsed");
    click();

    expect(state()).toBe("expanded");
    expect(announced.map((event) => event.detail.collapsed)).toEqual([true, false]);
  });

  test("re-writing the state it already holds announces nothing", () => {
    const { announced, push } = install();

    push("expanded");

    expect(announced).toEqual([]);
  });

  test("a value nothing agrees on is reverted to the last good state", () => {
    const { state, announced, push } = install({ stored: "collapsed" });

    push("halfway");

    expect(state()).toBe("collapsed");
    expect(announced).toEqual([]);
  });
});

describe("sidebarHandlers persistence", () => {
  test("a change is stored, so the next page load paints it", () => {
    const { storage, click } = install();

    click();

    expect(storage.get("uniformen:sidebar")).toBe("collapsed");
  });

  test("storage that throws does not take the announcement down with it", () => {
    const { announced, click } = install({ storageThrows: true });

    expect(() => click()).not.toThrow();
    expect(announced).toHaveLength(1);
  });
});

describe("sidebarHandlers without the button", () => {
  test("an app with its own control still gets persistence and the event", () => {
    const { storage, announced, push } = install({ button: "absent" });

    push("collapsed");

    expect(storage.get("uniformen:sidebar")).toBe("collapsed");
    expect(announced.map((event) => event.detail.collapsed)).toEqual([true]);
  });

  test("no button in the markup is not an error, so the same bundle serves every page", () => {
    const { ready } = install({ button: "absent" });

    expect(() => ready()).not.toThrow();
  });
});
