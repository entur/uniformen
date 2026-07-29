import { afterEach, describe, expect, it, jest } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { fetchUniformenComponents } from "./reactAdapter";

function mockFetch(data: object, ok = true) {
  jest.spyOn(globalThis, "fetch").mockResolvedValue({
    ok,
    json: () => Promise.resolve(data),
  } as Response);
}

const baseLayout = {
  headAssets: "",
  headerHtml: "",
  footerHtml: "",
  scripts: "",
  csp: {},
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe("fetchUniformenComponents", () => {
  it("renders head assets as real elements with no wrapper element", async () => {
    mockFetch({
      ...baseLayout,
      headAssets: '<link rel="stylesheet" href="/app.css"><style>body{margin:0}</style>',
    });
    const { HeadAssets } = await fetchUniformenComponents();
    const html = renderToStaticMarkup(createElement(HeadAssets));

    // No illegal wrapper that would be ejected from <head>.
    expect(html).not.toContain("<div");
    expect(html).toContain('<link rel="stylesheet" href="/app.css"');
    expect(html).toContain("<style>body{margin:0}</style>");
  });

  it("renders the inline script in head assets verbatim, so the CSP hash still matches", async () => {
    // `headAssets` carries the sidebar's pre-paint script. A hash is over exact
    // bytes, so anything the adapter rewrites — escaping, reordering, a wrapper —
    // gets the block dropped by the browser instead of run.
    const source = 'if (a && b < "c") d();';
    mockFetch({
      ...baseLayout,
      headAssets: `<style>body{margin:0}</style><script>${source}</script>`,
    });
    const { HeadAssets } = await fetchUniformenComponents();
    const html = renderToStaticMarkup(createElement(HeadAssets));

    expect(html).not.toContain("<div");
    expect(html).toContain(`<script>${source}</script>`);
  });

  it("renders scripts as real <script> elements", async () => {
    mockFetch({
      ...baseLayout,
      scripts: '<script src="/cdn.js"></script><script>init()</script>',
    });
    const { Scripts } = await fetchUniformenComponents();
    const html = renderToStaticMarkup(createElement(Scripts));

    expect(html).not.toContain("<div");
    expect(html).toContain('<script src="/cdn.js">');
    expect(html).toContain("<script>init()</script>");
  });

  it("renders header and footer without an extra wrapper element", async () => {
    mockFetch({
      ...baseLayout,
      headerHtml: "<header>nav</header>",
      footerHtml: "<footer>foot</footer>",
    });
    const { Header, Footer } = await fetchUniformenComponents();

    expect(renderToStaticMarkup(createElement(Header))).toBe("<header>nav</header>");
    expect(renderToStaticMarkup(createElement(Footer))).toBe("<footer>foot</footer>");
  });

  it("renders nothing for empty slots", async () => {
    mockFetch(baseLayout);
    const { HeadAssets, Scripts } = await fetchUniformenComponents();

    expect(renderToStaticMarkup(createElement(HeadAssets))).toBe("");
    expect(renderToStaticMarkup(createElement(Scripts))).toBe("");
  });

  it("forwards token, environment and params to the layout fetch", async () => {
    mockFetch(baseLayout);
    await fetchUniformenComponents({
      token: "abc.def.ghi",
      environment: "dev",
      params: { app: "partner" },
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://uniformen.dev.entur.no/ssr?app=partner",
      {
        headers: { Authorization: "Bearer abc.def.ghi" },
      },
    );
  });

  it("renders nothing for every component when the layout fetch fails", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockFetch({}, false);
    const { HeadAssets, Header, Footer, Scripts } = await fetchUniformenComponents();

    for (const Component of [HeadAssets, Header, Footer, Scripts]) {
      expect(renderToStaticMarkup(createElement(Component))).toBe("");
    }
  });
});
