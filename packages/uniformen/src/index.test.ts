import { describe, it, expect, jest, afterEach } from "bun:test";
import { fetchUniformenLayout, type FetchUniformenParams } from "./index";

function mockFetch(data: object, ok = true) {
  jest.spyOn(globalThis, "fetch").mockResolvedValue({
    ok,
    json: () => Promise.resolve(data),
  } as Response);
}

function suppressConsoleError() {
  jest.spyOn(console, "error").mockImplementation(() => {});
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
    });
  });

  it("sends no Authorization header when no token is given", async () => {
    mockFetch({ headerHtml: "", footerHtml: "", headAssets: "", scripts: "" });
    await fetchUniformenLayout();
    expect(globalThis.fetch).toHaveBeenCalledWith(expect.any(String), {
      headers: undefined,
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
      // Cast: `app` is a closed enum, but the query builder must escape whatever
      // value it is handed so a future free-form param can't break the URL.
      await fetchUniformenLayout({
        params: { app: "a b&c=d" as unknown as "partner" },
      });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://uniformen.entur.no/ssr?app=a+b%26c%3Dd",
        expect.anything(),
      );
    });

    // `FetchUniformenParams` has no list-valued member yet, so these cast a
    // future one in. They pin the serialisation contract so adding e.g.
    // `list?: string[]` to the type needs no change here.
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
});
