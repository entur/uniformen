import { afterEach, describe, expect, test } from "bun:test";
import notificationsPanelPlacement from "./notificationsPanelPlacement";

/**
 * The handler is sent to the browser as source text, so it only uses browser globals.
 * These fakes provide the parts of `document`, `window` and the elements that it
 * uses. Each element has a fixed left and right edge.
 */
type Box = { left: number; right: number; width: number };
const box = (left: number, right: number): Box => ({ left, right, width: right - left });

class FakeElement {
  private readonly attributes = new Map<string, string>();
  readonly listeners: (() => void)[] = [];

  constructor(public rect: Box) {}

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getBoundingClientRect(): Box {
    return this.rect;
  }

  addEventListener(_type: string, listener: () => void): void {
    this.listeners.push(listener);
  }
}

/** The panel at the stylesheet's position, with a 16px transparent left padding. */
class FakePanel extends FakeElement {
  readonly styles = new Map<string, string>();
  readonly style = {
    setProperty: (name: string, value: string) => this.styles.set(name, value),
    removeProperty: (name: string) => this.styles.delete(name),
  };

  constructor(
    readonly surface: FakeElement,
    readonly offsetParent: FakeElement,
  ) {
    super(box(surface.rect.left - 16, surface.rect.right));
  }

  querySelector(): FakeElement {
    return this.surface;
  }
}

const globals = globalThis as Record<string, unknown>;
const saved = {
  document: globals["document"],
  window: globals["window"],
  HTMLElement: globals["HTMLElement"],
};

afterEach(() => {
  Object.assign(globals, saved);
});

/**
 * Runs the handler with a 1000px bar, a bell button whose left edge is at
 * `bellLeft`, and a panel that is `panelWidth` wide. At the stylesheet's position
 * the panel's right edge is 16px from the end of the bar. `click` and `resize`
 * return the panel's `left` style, or undefined when the stylesheet's position is
 * used.
 */
function setup(bellLeft: number, panelWidth: number) {
  const bar = new FakeElement(box(0, 1000));
  const toggle = new FakeElement(box(bellLeft, bellLeft + 100));
  const panel = new FakePanel(new FakeElement(box(984 - panelWidth, 984)), bar);
  const windowListeners: (() => void)[] = [];
  Object.assign(globals, {
    HTMLElement: FakeElement,
    document: {
      querySelector: () => toggle,
      getElementById: () => panel,
    },
    window: {
      addEventListener: (_type: string, listener: () => void) => windowListeners.push(listener),
    },
  });
  notificationsPanelPlacement();

  return {
    click: () => {
      toggle.setAttribute("aria-expanded", "true");
      for (const listener of toggle.listeners) listener();
      return panel.styles.get("left");
    },
    resize: () => {
      for (const listener of windowListeners) listener();
      return panel.styles.get("left");
    },
    toggle,
  };
}

describe("notificationsPanelPlacement", () => {
  test("puts the panel's left edge under the bell when the panel fits to its right", () => {
    // The panel's left padding is 16px, so the panel starts 16px left of the bell.
    expect(setup(500, 400).click()).toBe("484px");
  });

  test("uses the stylesheet's position when the panel does not fit to the right of the bell", () => {
    expect(setup(700, 400).click()).toBeUndefined();
  });

  test("places the panel again when the window changes size while it is open", () => {
    const { click, resize, toggle } = setup(500, 400);
    click();
    toggle.rect = box(700, 800);
    expect(resize()).toBeUndefined();
  });

  test("does nothing on resize while the panel is closed", () => {
    expect(setup(500, 400).resize()).toBeUndefined();
  });
});
