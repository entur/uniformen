import { afterEach, describe, expect, it, jest } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ReactNode, type ScriptHTMLAttributes } from "react";
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

    // A wrapper element is not allowed in <head>, and the browser would move it out.
    expect(html).not.toContain("<div");
    expect(html).toContain('<link rel="stylesheet" href="/app.css"');
    expect(html).toContain("<style>body{margin:0}</style>");
  });

  it("renders the inline script in head assets verbatim, so the CSP hash still matches", async () => {
    // The source has characters that HTML escaping would change.
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
        signal: expect.any(AbortSignal),
      },
    );
  });

  it("returns the CSP sources alongside the components, so a page needs one fetch", async () => {
    const csp = { "style-src": ["'self'", "https://cdn.entur.io"], "script-src": ["'sha256-abc'"] };
    mockFetch({ ...baseLayout, csp });

    expect((await fetchUniformenComponents()).csp).toEqual(csp);
  });

  it("renders nothing for every component when the layout fetch fails", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockFetch({}, false);
    const { HeadAssets, Header, Footer, Scripts, csp } = await fetchUniformenComponents();

    for (const Component of [HeadAssets, Header, Footer, Scripts]) {
      expect(renderToStaticMarkup(createElement(Component))).toBe("");
    }
    expect(csp).toEqual({});
  });
});

/**
 * The props of `Script` from `next/script`: all `<script>` attributes plus its own
 * strategy and lifecycle props. They are copied here so the package does not depend
 * on Next.js. Passing `nextScript` as `loader` below checks that this type still
 * fits the prop.
 */
interface NextScriptProps extends ScriptHTMLAttributes<HTMLScriptElement> {
  strategy?: "afterInteractive" | "lazyOnload" | "beforeInteractive" | "worker";
  id?: string;
  onLoad?: (e: any) => void;
  onReady?: () => void | null;
  onError?: (e: any) => void;
  children?: ReactNode;
  stylesheets?: string[];
}

/** Returns what `next/script` writes into the script element it creates for these props. */
function nextScriptElement(props: NextScriptProps) {
  const { children, dangerouslySetInnerHTML, src } = props;
  if (dangerouslySetInnerHTML) return { textContent: dangerouslySetInnerHTML.__html };
  if (children) {
    return {
      textContent:
        typeof children === "string" ? children : Array.isArray(children) ? children.join("") : "",
    };
  }
  return { src };
}

/** Returns a loader that records the props it gets and renders nothing, like `next/script`. */
function recordingLoader() {
  const calls: NextScriptProps[] = [];
  const nextScript = (props: NextScriptProps) => {
    calls.push(props);
    return null;
  };
  return { calls, nextScript };
}

describe("script loader", () => {
  it("hands every script in a slot to the loader, and renders nothing itself", async () => {
    const { calls, nextScript } = recordingLoader();
    mockFetch({
      ...baseLayout,
      scripts: '<script src="/cdn.js"></script><script>init()</script>',
    });
    const { Scripts } = await fetchUniformenComponents();

    expect(renderToStaticMarkup(createElement(Scripts, { loader: nextScript }))).toBe("");
    expect(calls).toHaveLength(2);
  });

  it("hands the inline source over verbatim, so the CSP hash still matches", async () => {
    // React escapes text children. If the loader got `&amp;&amp;` instead of `&&`,
    // the CSP hash would no longer match and the browser would not run the script.
    const source = 'if (a && b < "c") d();';
    const { calls, nextScript } = recordingLoader();
    mockFetch({ ...baseLayout, scripts: `<script>${source}</script>` });
    const { Scripts } = await fetchUniformenComponents();
    renderToStaticMarkup(createElement(Scripts, { loader: nextScript }));

    expect(nextScriptElement(calls[0]!)).toEqual({ textContent: source });
  });

  it("passes script attributes as React props", async () => {
    const { calls, nextScript } = recordingLoader();
    mockFetch({
      ...baseLayout,
      scripts:
        '<script src="/cdn.js" async type="module" nonce="n1" crossorigin="anonymous" data-app="partner"></script>',
    });
    const { Scripts } = await fetchUniformenComponents();
    renderToStaticMarkup(createElement(Scripts, { loader: nextScript }));

    expect(calls[0]).toMatchObject({
      src: "/cdn.js",
      async: true,
      type: "module",
      nonce: "n1",
      crossOrigin: "anonymous",
      "data-app": "partner",
    });
  });

  it("hands an external script no children, so its src is what gets loaded", async () => {
    // `next/script` uses `children` before `src`. An empty `children` would make it
    // load nothing instead of the URL.
    const { calls, nextScript } = recordingLoader();
    mockFetch({ ...baseLayout, scripts: '<script src="/cdn.js"></script>' });
    const { Scripts } = await fetchUniformenComponents();
    renderToStaticMarkup(createElement(Scripts, { loader: nextScript }));

    expect(calls[0]!.children).toBeUndefined();
    expect(nextScriptElement(calls[0]!)).toEqual({ src: "/cdn.js" });
  });

  it("leaves everything that is not a script alone", async () => {
    const { calls, nextScript } = recordingLoader();
    mockFetch({
      ...baseLayout,
      headAssets:
        '<link rel="stylesheet" href="/app.css"><style>body{margin:0}</style><script>boot()</script>',
    });
    const { HeadAssets } = await fetchUniformenComponents();
    const html = renderToStaticMarkup(createElement(HeadAssets, { loader: nextScript }));

    expect(html).toBe('<link rel="stylesheet" href="/app.css"/><style>body{margin:0}</style>');
    expect(calls).toHaveLength(1);
    expect(nextScriptElement(calls[0]!)).toEqual({ textContent: "boot()" });
  });

  it("renders plain script elements when no loader is passed", async () => {
    mockFetch({
      ...baseLayout,
      headAssets: "<script>boot()</script>",
      scripts: "<script>init()</script>",
    });
    const { HeadAssets, Scripts } = await fetchUniformenComponents();

    expect(renderToStaticMarkup(createElement(HeadAssets))).toBe("<script>boot()</script>");
    expect(renderToStaticMarkup(createElement(Scripts))).toBe("<script>init()</script>");
  });

  it("keys the replaced scripts, so a slot of several renders without a React warning", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    const { nextScript } = recordingLoader();
    mockFetch({
      ...baseLayout,
      scripts: '<script src="/a.js"></script><script src="/b.js"></script>',
    });
    const { Scripts } = await fetchUniformenComponents();
    renderToStaticMarkup(createElement(Scripts, { loader: nextScript }));

    expect(consoleError).not.toHaveBeenCalled();
  });

  it("renders nothing, loader or not, when the layout fetch fails", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const { calls, nextScript } = recordingLoader();
    mockFetch({}, false);
    const { HeadAssets, Scripts } = await fetchUniformenComponents();

    expect(renderToStaticMarkup(createElement(HeadAssets, { loader: nextScript }))).toBe("");
    expect(renderToStaticMarkup(createElement(Scripts, { loader: nextScript }))).toBe("");
    expect(calls).toEqual([]);
  });
});
