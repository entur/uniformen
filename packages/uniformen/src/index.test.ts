import { describe, it, expect, jest, afterEach } from "bun:test";
import { fetchUniformenLayout } from "./index";

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
    await fetchUniformenLayout("abc.def.ghi");
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
});
