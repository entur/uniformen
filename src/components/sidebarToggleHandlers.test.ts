import { afterEach, describe, expect, test } from "bun:test";
import sidebarToggleHandlers from "./sidebarToggleHandlers";

/**
 * The handler ships as serialized source to the browser, so it only touches
 * `document`, `window` and the DOM interfaces below. Rather than pull in a full
 * DOM implementation, install the slice it uses — an element that records its
 * attributes, and a window that records dispatched events — and run the real
 * handler against it.
 */
class FakeElement extends EventTarget {
  private readonly attributes = new Map<string, string>();

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
}

const globals = globalThis as unknown as Record<string, unknown>;
const saved = {
  HTMLElement: globals["HTMLElement"],
  document: globals["document"],
  window: globals["window"],
};

function install({ expanded }: { expanded: boolean }) {
  const toggle = new FakeElement();
  toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
  const dispatched: CustomEvent<{ collapsed: boolean }>[] = [];

  globals["HTMLElement"] = FakeElement;
  globals["document"] = { querySelector: () => toggle };
  globals["window"] = {
    dispatchEvent: (event: CustomEvent<{ collapsed: boolean }>) => dispatched.push(event),
  };

  sidebarToggleHandlers();
  const click = () => toggle.dispatchEvent(new Event("click"));
  return { toggle, dispatched, click };
}

afterEach(() => {
  globals["HTMLElement"] = saved.HTMLElement;
  globals["document"] = saved.document;
  globals["window"] = saved.window;
});

describe("sidebarToggleHandlers", () => {
  test("clicking an expanded toggle collapses it and announces the new state", () => {
    const { toggle, dispatched, click } = install({ expanded: true });

    click();

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]?.type).toBe("uniformen:toggle-sidebar");
    expect(dispatched[0]?.detail).toEqual({ collapsed: true });
  });

  test("clicking again expands it, and the detail follows the button", () => {
    const { toggle, dispatched, click } = install({ expanded: true });

    click();
    click();

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(dispatched.map((event) => event.detail.collapsed)).toEqual([true, false]);
  });

  test("a toggle rendered collapsed expands on the first click", () => {
    const { toggle, dispatched, click } = install({ expanded: false });

    click();

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(dispatched[0]?.detail).toEqual({ collapsed: false });
  });

  test("no toggle in the markup is a no-op, so the same bundle serves every page", () => {
    globals["HTMLElement"] = FakeElement;
    globals["document"] = { querySelector: () => null };
    globals["window"] = {
      dispatchEvent: () => {
        throw new Error("nothing should be dispatched");
      },
    };

    expect(() => sidebarToggleHandlers()).not.toThrow();
  });
});
