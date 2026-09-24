import { describe, it, expect, jest, afterEach } from "bun:test";
import { fetchUniformenLayout, type FetchUniformenParams } from "./index";

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

function mockFetch(data: object, ok = true) {
  jest.spyOn(globalThis, "fetch").mockResolvedValue({
    ok,
    json: () => Promise.resolve(data),
  } as Response);
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
});

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
      headers: { Authorization: "Bearer abc.def.ghi" },
      signal: expect.any(AbortSignal),
    });
  });

  it("sends no Authorization header when no token is given", async () => {
    mockFetch({ headerHtml: "", footerHtml: "", headAssets: "", scripts: "" });
    await fetchUniformenLayout();
    expect(globalThis.fetch).toHaveBeenCalledWith(expect.any(String), {
      headers: undefined,
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
        headers: { Authorization: "Bearer abc.def.ghi" },
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
      const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ headerHtml: "", footerHtml: "", headAssets: "", scripts: "" }),
      } as Response);

      expect(await fetchUniformenLayout()).not.toBeNull();
      const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
      expect(init.signal?.aborted).toBe(false);
    });
  });
});
