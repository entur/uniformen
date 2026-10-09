import { describe, it, expect, jest, afterEach, setSystemTime } from "bun:test";
import packageJson from "../package.json";
import {
  clearUniformenLayoutCache,
  fetchUniformenLayout,
  type FetchUniformenParams,
} from "./index";
import { PACKAGE_VERSION } from "./version";

/**
 * These tests are checked by `bun run tsc`, not at runtime. If the event map had no
 * types, `detail` would be `any`, the `@ts-expect-error` lines below would have no
 * error to expect, and the type check would fail.
 */
describe("window event types", () => {
  it("types the detail of each event the top bar dispatches", () => {
    const locale: WindowEventMap["uniformen:locale"]["detail"] = { locale: "nn-NO" };
    const sidebar: WindowEventMap["uniformen:sidebar"]["detail"] = { collapsed: true };

    expect([locale.locale, sidebar.collapsed]).toEqual(["nn-NO", true]);
  });

  it("rejects a detail the top bar would never dispatch", () => {
    // @ts-expect-error — not one of the tags the service renders
    const locale: WindowEventMap["uniformen:locale"]["detail"] = { locale: "sv-SE" };
    // @ts-expect-error — the sidebar reports a state, not an action
    const sidebar: WindowEventMap["uniformen:sidebar"]["detail"] = { collapse: true };

    expect([locale, sidebar]).toBeDefined();
  });
});

/** Returns a fetch mock that makes a new response for each call, because a body can only be read once. */
function respondWith(makeResponse: () => Response) {
  return (() => Promise.resolve(makeResponse())) as unknown as typeof fetch;
}

function mockFetch(data: object, ok = true, headers?: HeadersInit) {
  return jest
    .spyOn(globalThis, "fetch")
    .mockImplementation(
      respondWith(() => new Response(JSON.stringify(data), { status: ok ? 200 : 500, headers })),
    );
}

function suppressConsoleError() {
  jest.spyOn(console, "error").mockImplementation(() => {});
}

/**
 * Mocks a service that accepts the connection and never answers. The request only
 * ends when its signal aborts.
 */
function mockSilentFetch() {
  const silent = (_url: unknown, init?: { signal?: AbortSignal }) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    });
  jest.spyOn(globalThis, "fetch").mockImplementation(silent as unknown as typeof fetch);
}

afterEach(() => {
  jest.restoreAllMocks();
  clearUniformenLayoutCache();
  setSystemTime();
});

const CLIENT_HEADER = { "X-Uniformen-Client": `@entur/uniformen@${PACKAGE_VERSION}` };

describe("fetchUniformenLayout", () => {
  it("returns null when response is not ok", async () => {
    suppressConsoleError();
    mockFetch({}, false);
    expect(await fetchUniformenLayout()).toBeNull();
  });

  it("returns null when fetch throws", async () => {
    suppressConsoleError();
    jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network error"));
    expect(await fetchUniformenLayout()).toBeNull();
  });

  it("passes through headAssets verbatim", async () => {
    mockFetch({
      headAssets:
        '<link rel="stylesheet" href="/app.css"><link rel="preload" href="/font.woff2" as="font">',
      headerHtml: "",
      footerHtml: "",
      scripts: "",
    });
    const layout = await fetchUniformenLayout();
    expect(layout?.headAssets).toBe(
      '<link rel="stylesheet" href="/app.css"><link rel="preload" href="/font.woff2" as="font">',
    );
  });

  it("passes through scripts verbatim", async () => {
    mockFetch({
      headAssets: "",
      headerHtml: "",
      footerHtml: "",
      scripts: "<script>init()</script><script>setup()</script>",
    });
    const layout = await fetchUniformenLayout();
    expect(layout?.scripts).toBe("<script>init()</script><script>setup()</script>");
  });

  it("passes through csp contributions verbatim", async () => {
    mockFetch({
      headAssets: "",
      headerHtml: "",
      footerHtml: "",
      scripts: "",
      csp: { "style-src": ["sha256-abc"], "script-src": ["sha256-def"] },
    });
    const layout = await fetchUniformenLayout();
    expect(layout?.csp).toEqual({
      "style-src": ["sha256-abc"],
      "script-src": ["sha256-def"],
    });
  });

  it("passes through headerHtml and footerHtml verbatim", async () => {
    mockFetch({
      headAssets: "",
      headerHtml: "<header>nav</header>",
      footerHtml: "<footer>foot</footer>",
      scripts: "",
    });
    const layout = await fetchUniformenLayout();
    expect(layout?.headerHtml).toBe("<header>nav</header>");
    expect(layout?.footerHtml).toBe("<footer>foot</footer>");
  });

  it("handles empty headAssets and scripts gracefully", async () => {
    mockFetch({ headerHtml: "", footerHtml: "", headAssets: "", scripts: "" });
    const layout = await fetchUniformenLayout();
    expect(layout?.headAssets).toBe("");
    expect(layout?.scripts).toBe("");
  });

  it("forwards a token as a Bearer Authorization header", async () => {
    mockFetch({ headerHtml: "", footerHtml: "", headAssets: "", scripts: "" });
    await fetchUniformenLayout({ token: "abc.def.ghi" });
    expect(globalThis.fetch).toHaveBeenCalledWith(expect.any(String), {
      headers: { ...CLIENT_HEADER, Authorization: "Bearer abc.def.ghi" },
      signal: expect.any(AbortSignal),
    });
  });

  it("sends no Authorization header when no token is given", async () => {
    mockFetch({ headerHtml: "", footerHtml: "", headAssets: "", scripts: "" });
    await fetchUniformenLayout();
    expect(globalThis.fetch).toHaveBeenCalledWith(expect.any(String), {
      headers: CLIENT_HEADER,
      signal: expect.any(AbortSignal),
    });
  });

  it("defaults to production URL", async () => {
    mockFetch({ headerHtml: "", footerHtml: "", headAssets: "", scripts: "" });
    await fetchUniformenLayout();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://uniformen.entur.no/ssr",
      expect.anything(),
    );
  });

  it("uses local URL for local environment", async () => {
    mockFetch({ headerHtml: "", footerHtml: "", headAssets: "", scripts: "" });
    await fetchUniformenLayout({ environment: "local" });
    expect(globalThis.fetch).toHaveBeenCalledWith("http://localhost:4123/ssr", expect.anything());
  });

  it("uses dev URL for dev environment", async () => {
    mockFetch({ headerHtml: "", footerHtml: "", headAssets: "", scripts: "" });
    await fetchUniformenLayout({ environment: "dev" });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://uniformen.dev.entur.no/ssr",
      expect.anything(),
    );
  });

  it("uses staging URL for staging environment", async () => {
    mockFetch({ headerHtml: "", footerHtml: "", headAssets: "", scripts: "" });
    await fetchUniformenLayout({ environment: "staging" });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://uniformen.staging.entur.no/ssr",
      expect.anything(),
    );
  });

  describe("params", () => {
    const emptyLayout = { headerHtml: "", footerHtml: "", headAssets: "", scripts: "" };

    it("appends params as a query string", async () => {
      mockFetch(emptyLayout);
      await fetchUniformenLayout({ params: { app: "partner" } });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://uniformen.entur.no/ssr?app=partner",
        expect.anything(),
      );
    });

    it("sends the locale as the service's own param name", async () => {
      mockFetch(emptyLayout);
      await fetchUniformenLayout({ params: { app: "partner", locale: "en-GB" } });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://uniformen.entur.no/ssr?app=partner&locale=en-GB",
        expect.anything(),
      );
    });

    it("repeats the key for the languages to offer, in the order given", async () => {
      mockFetch(emptyLayout);
      await fetchUniformenLayout({
        params: { locale: "en-GB", availableLocales: ["nb-NO", "en-GB"] },
      });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://uniformen.entur.no/ssr?locale=en-GB&availableLocales=nb-NO&availableLocales=en-GB",
        expect.anything(),
      );
    });

    it("sends no key at all for an empty list of languages", async () => {
      mockFetch(emptyLayout);
      await fetchUniformenLayout({ params: { app: "partner", availableLocales: [] } });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://uniformen.entur.no/ssr?app=partner",
        expect.anything(),
      );
    });

    it("sends booleans as the strings the service's schema accepts", async () => {
      mockFetch(emptyLayout);
      await fetchUniformenLayout({ params: { simple: true, sidebar: false } });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://uniformen.entur.no/ssr?simple=true&sidebar=false",
        expect.anything(),
      );
    });

    it("combines params with a non-default environment", async () => {
      mockFetch(emptyLayout);
      await fetchUniformenLayout({ environment: "dev", params: { app: "cleos" } });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://uniformen.dev.entur.no/ssr?app=cleos",
        expect.anything(),
      );
    });

    it("sends params alongside the Authorization header", async () => {
      mockFetch(emptyLayout);
      await fetchUniformenLayout({ token: "abc.def.ghi", params: { app: "sorvis" } });
      expect(globalThis.fetch).toHaveBeenCalledWith("https://uniformen.entur.no/ssr?app=sorvis", {
        headers: { ...CLIENT_HEADER, Authorization: "Bearer abc.def.ghi" },
        signal: expect.any(AbortSignal),
      });
    });

    it("omits the query string when no params are given", async () => {
      mockFetch(emptyLayout);
      await fetchUniformenLayout({});
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://uniformen.entur.no/ssr",
        expect.anything(),
      );
    });

    it("omits the query string for an empty params object", async () => {
      mockFetch(emptyLayout);
      await fetchUniformenLayout({ params: {} });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://uniformen.entur.no/ssr",
        expect.anything(),
      );
    });

    it("drops params explicitly set to undefined", async () => {
      mockFetch(emptyLayout);
      await fetchUniformenLayout({ params: { app: undefined } });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://uniformen.entur.no/ssr",
        expect.anything(),
      );
    });

    it("url-encodes param values", async () => {
      mockFetch(emptyLayout);
      // The cast is needed because `app` only accepts known values. The query string
      // must still escape any value, so that a future free-text param cannot break the URL.
      await fetchUniformenLayout({
        params: { app: "a b&c=d" as unknown as "partner" },
      });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://uniformen.entur.no/ssr?app=a+b%26c%3Dd",
        expect.anything(),
      );
    });

    // `FetchUniformenParams` has no list param yet, so these tests cast one in.
    // When a list param such as `list?: string[]` is added, these tests need no change.
    const listParams = (value: unknown) => ({ list: value }) as FetchUniformenParams;

    it("repeats the key for a list param", async () => {
      mockFetch(emptyLayout);
      await fetchUniformenLayout({ params: listParams(["item1", "item2", "item3"]) });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://uniformen.entur.no/ssr?list=item1&list=item2&list=item3",
        expect.anything(),
      );
    });

    it("omits an empty list param entirely", async () => {
      mockFetch(emptyLayout);
      await fetchUniformenLayout({ params: listParams([]) });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://uniformen.entur.no/ssr",
        expect.anything(),
      );
    });

    it("drops undefined entries inside a list param", async () => {
      mockFetch(emptyLayout);
      await fetchUniformenLayout({ params: listParams(["item1", undefined, "item2"]) });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://uniformen.entur.no/ssr?list=item1&list=item2",
        expect.anything(),
      );
    });

    it("url-encodes each value of a list param", async () => {
      mockFetch(emptyLayout);
      await fetchUniformenLayout({ params: listParams(["a b", "c&d"]) });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://uniformen.entur.no/ssr?list=a+b&list=c%26d",
        expect.anything(),
      );
    });

    it("combines a list param with a scalar param", async () => {
      mockFetch(emptyLayout);
      await fetchUniformenLayout({
        params: { app: "partner", ...listParams(["item1", "item2"]) },
      });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://uniformen.entur.no/ssr?app=partner&list=item1&list=item2",
        expect.anything(),
      );
    });

    it("works with no arguments at all", async () => {
      mockFetch(emptyLayout);
      await fetchUniformenLayout();
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://uniformen.entur.no/ssr",
        expect.anything(),
      );
    });
  });

  describe("timeout", () => {
    it("gives up and returns null rather than hanging the render", async () => {
      suppressConsoleError();
      mockSilentFetch();

      expect(await fetchUniformenLayout({ timeoutMs: 20 })).toBeNull();
    });

    it("names the timeout in the log, rather than reporting a network error", async () => {
      const error = jest.spyOn(console, "error").mockImplementation(() => {});
      mockSilentFetch();

      await fetchUniformenLayout({ timeoutMs: 20 });
      expect(error).toHaveBeenCalledWith("Uniformen layout request timed out after 20ms");
    });

    it("passes a signal that is not yet aborted for a service that answers", async () => {
      const fetchSpy = mockFetch({ headerHtml: "", footerHtml: "", headAssets: "", scripts: "" });

      expect(await fetchUniformenLayout()).not.toBeNull();
      const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
      expect(init.signal?.aborted).toBe(false);
    });
  });
});

describe("client version", () => {
  it("matches the version in package.json", () => {
    expect(PACKAGE_VERSION).toBe(packageJson.version);
  });
});

describe("retry", () => {
  const layout = { headerHtml: "<header>ok</header>", footerHtml: "", headAssets: "", scripts: "" };

  it("tries once more after a network error", async () => {
    suppressConsoleError();
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce(new Response(JSON.stringify(layout)));

    expect((await fetchUniformenLayout())?.headerHtml).toBe("<header>ok</header>");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("tries once more after a 5xx status", async () => {
    suppressConsoleError();
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(layout)));

    expect((await fetchUniformenLayout())?.headerHtml).toBe("<header>ok</header>");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("gives up after the second failure", async () => {
    suppressConsoleError();
    const fetchSpy = mockFetch({}, false);

    expect(await fetchUniformenLayout()).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 4xx status", async () => {
    suppressConsoleError();
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockImplementation(respondWith(() => new Response("", { status: 400 })));

    expect(await fetchUniformenLayout()).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("does not retry after the timeout", async () => {
    suppressConsoleError();
    mockSilentFetch();

    expect(await fetchUniformenLayout({ timeoutMs: 20 })).toBeNull();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});

describe("cache", () => {
  const layout = {
    headerHtml: "<header>first</header>",
    footerHtml: "",
    headAssets: "",
    scripts: "",
  };
  const cacheable = { "Cache-Control": "public, max-age=60" };

  it("uses an anonymous layout for the max-age the service gives", async () => {
    setSystemTime(new Date("2026-01-01T12:00:00Z"));
    const fetchSpy = mockFetch(layout, true, cacheable);
    await fetchUniformenLayout({ params: { app: "partner" } });

    setSystemTime(new Date("2026-01-01T12:00:59Z"));
    expect((await fetchUniformenLayout({ params: { app: "partner" } }))?.headerHtml).toBe(
      "<header>first</header>",
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    setSystemTime(new Date("2026-01-01T12:01:01Z"));
    await fetchUniformenLayout({ params: { app: "partner" } });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("keeps a separate entry for each set of params", async () => {
    const fetchSpy = mockFetch(layout, true, cacheable);
    await fetchUniformenLayout({ params: { app: "partner" } });
    await fetchUniformenLayout({ params: { app: "cleos" } });
    await fetchUniformenLayout({ environment: "dev", params: { app: "partner" } });

    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("does not use a layout without max-age while the service answers", async () => {
    const fetchSpy = mockFetch(layout);
    await fetchUniformenLayout();
    await fetchUniformenLayout();

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("returns the last anonymous layout when the fetch fails", async () => {
    mockFetch(layout);
    await fetchUniformenLayout({ params: { app: "partner" } });

    jest.restoreAllMocks();
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    suppressConsoleError();
    jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network error"));

    expect((await fetchUniformenLayout({ params: { app: "partner" } }))?.headerHtml).toBe(
      "<header>first</header>",
    );
    expect(warn).toHaveBeenCalled();
  });

  it("stops using a failed anonymous layout after a day", async () => {
    setSystemTime(new Date("2026-01-01T12:00:00Z"));
    mockFetch(layout);
    await fetchUniformenLayout();

    jest.restoreAllMocks();
    suppressConsoleError();
    jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network error"));
    setSystemTime(new Date("2026-01-02T12:00:01Z"));

    expect(await fetchUniformenLayout()).toBeNull();
  });

  it("always fetches a signed-in layout while the service answers", async () => {
    const fetchSpy = mockFetch(layout, true, cacheable);
    await fetchUniformenLayout({ token: "user-a" });
    await fetchUniformenLayout({ token: "user-a" });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("returns the last signed-in layout for the same token when the fetch fails", async () => {
    mockFetch({ ...layout, headerHtml: "<header>Ada</header>" });
    await fetchUniformenLayout({ token: "user-a" });

    jest.restoreAllMocks();
    jest.spyOn(console, "warn").mockImplementation(() => {});
    suppressConsoleError();
    jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network error"));

    expect((await fetchUniformenLayout({ token: "user-a" }))?.headerHtml).toBe(
      "<header>Ada</header>",
    );
    expect(await fetchUniformenLayout({ token: "user-b" })).toBeNull();
    expect(await fetchUniformenLayout()).toBeNull();
  });

  it("stops using a failed signed-in layout after an hour", async () => {
    setSystemTime(new Date("2026-01-01T12:00:00Z"));
    mockFetch(layout);
    await fetchUniformenLayout({ token: "user-a" });

    jest.restoreAllMocks();
    suppressConsoleError();
    jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network error"));
    setSystemTime(new Date("2026-01-01T13:00:01Z"));

    expect(await fetchUniformenLayout({ token: "user-a" })).toBeNull();
  });

  it("evicts the least recently used layout when it holds 500", async () => {
    mockFetch(layout);
    for (let i = 0; i < 501; i++) await fetchUniformenLayout({ token: `user-${i}` });

    jest.restoreAllMocks();
    jest.spyOn(console, "warn").mockImplementation(() => {});
    suppressConsoleError();
    jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network error"));

    expect(await fetchUniformenLayout({ token: "user-0" })).toBeNull();
    expect(await fetchUniformenLayout({ token: "user-500" })).not.toBeNull();
  });

  it("fetches again after the cache is cleared", async () => {
    const fetchSpy = mockFetch(layout, true, cacheable);
    await fetchUniformenLayout();
    clearUniformenLayoutCache();
    await fetchUniformenLayout();

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
