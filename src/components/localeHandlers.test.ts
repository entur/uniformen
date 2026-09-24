import { afterEach, describe, expect, test } from "bun:test";
import localeHandlers from "./localeHandlers";

/**
 * The handler is sent to the browser as source text, so it only uses browser globals.
 * These fakes provide the parts of `document`, `window` and `Element` that it uses,
 * and the tests run the real handler against them.
 */
class FakeElement {
  constructor(private readonly attributes: Record<string, string> = {}) {}

  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  closest(selector: string): FakeElement | null {
    return selector === "[data-uniformen-locale]" && "data-uniformen-locale" in this.attributes
      ? this
      : null;
  }
}

/** Fakes an element inside an option, such as the marker. */
class FakeChild extends FakeElement {
  constructor(private readonly parent: FakeElement | null) {
    super();
  }

  override closest(selector: string): FakeElement | null {
    return this.parent?.closest(selector) ?? null;
  }
}

class FakeDocument {
  private readonly listeners: ((event: unknown) => void)[] = [];

  addEventListener(type: string, listener: (event: unknown) => void): void {
    if (type === "click") this.listeners.push(listener);
  }

  fire(target: unknown): void {
    for (const listener of this.listeners) listener({ target });
  }
}

class FakeWindow {
  readonly announced: CustomEvent<{ locale: string }>[] = [];

  dispatchEvent(event: Event): boolean {
    this.announced.push(event as CustomEvent<{ locale: string }>);
    return true;
  }
}

const globals = globalThis as unknown as Record<string, unknown>;
const saved = {
  Element: globals["Element"],
  document: globals["document"],
  window: globals["window"],
};

function install() {
  const doc = new FakeDocument();
  const win = new FakeWindow();
  globals["Element"] = FakeElement;
  globals["document"] = doc;
  globals["window"] = win;

  localeHandlers();

  const option = (locale: string, checked: boolean) =>
    new FakeElement({
      "data-uniformen-locale": locale,
      "aria-checked": checked ? "true" : "false",
    });
  return {
    announced: win.announced,
    /** Returns the announced languages in the order they were picked. */
    locales: () => win.announced.map((event) => event.detail.locale),
    pick: (locale: string) => doc.fire(option(locale, false)),
    pickCurrent: (locale: string) => doc.fire(option(locale, true)),
    /** Clicks the radio marker inside the option, because that is where most clicks land. */
    pickMarker: (locale: string) => doc.fire(new FakeChild(option(locale, false))),
    clickElsewhere: () => doc.fire(new FakeElement({ class: "my-app" })),
  };
}

afterEach(() => {
  globals["Element"] = saved.Element;
  globals["document"] = saved.document;
  globals["window"] = saved.window;
});

describe("localeHandlers", () => {
  test("a pick announces the language, and nothing else", () => {
    const page = install();
    page.pick("en-GB");
    expect(page.locales()).toEqual(["en-GB"]);
    const [event] = page.announced;
    expect(event?.type).toBe("uniformen:locale");
  });

  test("a click on the marker inside an option counts as picking it", () => {
    const page = install();
    page.pickMarker("nn-NO");
    expect(page.locales()).toEqual(["nn-NO"]);
  });

  test("picking the language already rendered says nothing: no reload for nothing", () => {
    const page = install();
    page.pickCurrent("nb-NO");
    expect(page.announced).toBeEmpty();
  });

  test("clicks elsewhere in the app are not language picks", () => {
    const page = install();
    page.clickElsewhere();
    expect(page.announced).toBeEmpty();
  });

  test("nothing is persisted or navigated: the app owns both", () => {
    const source = localeHandlers.toString();
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("cookie");
    expect(source).not.toContain("location");
    expect(source).not.toContain("reload");
    expect(source).not.toContain("setAttribute");
  });
});
