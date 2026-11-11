import { afterEach, describe, expect, it } from "bun:test";
import {
  LOCALE_COOKIE,
  readLocaleCookie,
  resolveLocale,
  writeLocaleCookie,
  type Locale,
} from "./index";

const NB_EN = ["nb-NO", "en-GB"] as const;

describe("resolveLocale", () => {
  const resolve = (acceptLanguage?: string | readonly string[], chosen?: string) =>
    resolveLocale({ chosen, acceptLanguage, supported: NB_EN, fallback: "nb-NO" });

  it("uses the chosen locale before Accept-Language", () => {
    expect(resolve("nb-NO", "en-GB")).toBe("en-GB");
  });

  it("ignores a chosen locale the app does not support", () => {
    expect(resolve("en-GB", "nn-NO")).toBe("en-GB");
    expect(resolve("en-GB", "sv-SE")).toBe("en-GB");
    expect(resolve("en-GB", "")).toBe("en-GB");
  });

  it("returns the fallback when nothing matches", () => {
    expect(resolve()).toBe("nb-NO");
    expect(resolve("")).toBe("nb-NO");
    expect(resolve("sv-SE, de;q=0.8")).toBe("nb-NO");
    expect(resolveLocale({ acceptLanguage: "sv", supported: NB_EN, fallback: "en-GB" })).toBe(
      "en-GB",
    );
  });

  it("matches on the language part", () => {
    expect(resolve("en-US,en;q=0.9")).toBe("en-GB");
    expect(resolve("en")).toBe("en-GB");
    expect(resolve("nb")).toBe("nb-NO");
    expect(resolve("no")).toBe("nb-NO");
    expect(resolve("nb-SE")).toBe("nb-NO");
    expect(resolve("sv-SE", "en")).toBe("en-GB");
  });

  it("matches nynorsk only when the app supports it", () => {
    expect(resolve("nn-NO, en;q=0.5")).toBe("en-GB");
    expect(
      resolveLocale({
        acceptLanguage: "nn, en;q=0.5",
        supported: ["nb-NO", "nn-NO", "en-GB"],
        fallback: "nb-NO",
      }),
    ).toBe("nn-NO");
  });

  it("ignores case and accepts underscores", () => {
    expect(resolve("EN-gb")).toBe("en-GB");
    expect(resolve(undefined, "en_GB")).toBe("en-GB");
  });

  it("sorts Accept-Language by q value", () => {
    expect(resolve("nb;q=0.5, en-GB;q=0.8")).toBe("en-GB");
    expect(resolve("sv, nb;q=0.1, en;q=0.2")).toBe("en-GB");
  });

  it("keeps the header order for the same q value", () => {
    expect(resolve("en, nb")).toBe("en-GB");
    expect(resolve("nb;q=0.7, en;q=0.7")).toBe("nb-NO");
  });

  it("leaves out q=0, broken q values and the wildcard", () => {
    expect(resolve("en;q=0, nb;q=0.1")).toBe("nb-NO");
    expect(resolve("en;q=abc, nb;q=0.1")).toBe("nb-NO");
    expect(resolve("en;q=2, nb;q=0.1")).toBe("nb-NO");
    expect(resolve("en;q=, nb;q=0.1")).toBe("nb-NO");
    expect(resolve("en;q=0x1, nb;q=0.1")).toBe("nb-NO");
    expect(resolve("en;q=0.0001, nb;q=0.1")).toBe("nb-NO");
    expect(resolve("nb;q=0.5, en;q=1.000")).toBe("en-GB");
    expect(resolveLocale({ acceptLanguage: "*", supported: NB_EN, fallback: "en-GB" })).toBe(
      "en-GB",
    );
  });

  it("accepts spaces and empty entries in the header", () => {
    expect(resolve(" ,  en-GB ; q=0.9 ,,")).toBe("en-GB");
  });

  it("uses a list, such as navigator.languages, in its own order", () => {
    expect(resolve(["sv-SE", "en-US", "nb-NO"])).toBe("en-GB");
    expect(resolve([])).toBe("nb-NO");
  });

  it("does not match names of Object.prototype", () => {
    expect(resolve("constructor, __proto__, toString")).toBe("nb-NO");
  });

  it("returns the narrower type of the supported list", () => {
    const locale: "nb-NO" | "en-GB" = resolve("en");
    expect(locale).toBe("en-GB");
  });

  it("rejects a fallback outside the supported list at compile time", () => {
    // @ts-expect-error nn-NO is not in the supported list.
    const locale = resolveLocale({ supported: NB_EN, fallback: "nn-NO" });
    expect(locale as string).toBe("nn-NO");
  });
});

describe("readLocaleCookie", () => {
  it("reads the value from a Cookie header or document.cookie", () => {
    expect(readLocaleCookie(`${LOCALE_COOKIE}=en-GB`)).toBe("en-GB");
    expect(readLocaleCookie(`a=1; ${LOCALE_COOKIE}=nn-NO; b=2`)).toBe("nn-NO");
    expect(readLocaleCookie(`a=1;${LOCALE_COOKIE}=nn-NO`)).toBe("nn-NO");
  });

  it("returns undefined when the cookie is not set", () => {
    expect(readLocaleCookie(undefined)).toBeUndefined();
    expect(readLocaleCookie(null)).toBeUndefined();
    expect(readLocaleCookie("")).toBeUndefined();
    expect(readLocaleCookie("other_entur_locale=en-GB; flag")).toBeUndefined();
  });

  it("removes double quotes around the value", () => {
    expect(readLocaleCookie(`${LOCALE_COOKIE}="en-GB"`)).toBe("en-GB");
  });

  it("returns the first value when the browser sends two cookies with the name", () => {
    expect(readLocaleCookie(`${LOCALE_COOKIE}=en-GB; ${LOCALE_COOKIE}=nb-NO`)).toBe("en-GB");
  });

  it("returns the raw value, which resolveLocale then checks", () => {
    expect(readLocaleCookie(`${LOCALE_COOKIE}=<script>`)).toBe("<script>");
  });
});

describe("writeLocaleCookie", () => {
  const globals = globalThis as { document?: unknown; location?: unknown };
  const original = { document: globals.document, location: globals.location };

  /** Gives the test a `document.cookie` that records each write, and a `location`. */
  function fakeBrowser(protocol: string): string[] {
    const writes: string[] = [];
    globals.document = {
      set cookie(value: string) {
        writes.push(value);
      },
    };
    globals.location = { protocol };
    return writes;
  }

  afterEach(() => {
    globals.document = original.document;
    globals.location = original.location;
  });

  it("writes a host-only cookie for one year", () => {
    const writes = fakeBrowser("http:");
    writeLocaleCookie("en-GB");
    expect(writes).toEqual([`${LOCALE_COOKIE}=en-GB; path=/; max-age=31536000; samesite=lax`]);
  });

  it("adds secure on HTTPS and the domain when it is passed", () => {
    const writes = fakeBrowser("https:");
    writeLocaleCookie("nn-NO", { domain: "entur.org" });
    expect(writes).toEqual([
      `${LOCALE_COOKIE}=nn-NO; path=/; max-age=31536000; samesite=lax; domain=entur.org; secure`,
    ]);
  });

  it("throws on a locale Uniformen does not support, and writes nothing", () => {
    const writes = fakeBrowser("https:");
    expect(() => writeLocaleCookie("nb-NO; domain=evil.example" as Locale)).toThrow(TypeError);
    expect(() => writeLocaleCookie("nb" as Locale)).toThrow(TypeError);
    expect(writes).toEqual([]);
  });

  it("throws outside the browser", () => {
    delete globals.document;
    expect(() => writeLocaleCookie("nb-NO")).toThrow(TypeError);
  });

  it("throws on a domain that is not a host name, and writes nothing", () => {
    const writes = fakeBrowser("https:");
    expect(() => writeLocaleCookie("nb-NO", { domain: "entur.org; path=/x" })).toThrow(TypeError);
    expect(() => writeLocaleCookie("nb-NO", { domain: "" })).toThrow(TypeError);
    expect(writes).toEqual([]);
  });
});
