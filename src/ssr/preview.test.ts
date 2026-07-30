import { describe, expect, test } from "bun:test";
import { app } from "../index";
import { previewUser } from "./preview";
import type { Environment } from "../config";

/**
 * The preview page is a dev tool, but its demo sidebar is also the worked example
 * of the sidebar contract, so keep it honest: collapsing has to happen through the
 * root attribute, and every inline block it renders has to be hashed in its own CSP
 * or the browser drops it.
 */
async function preview(query = "") {
  const res = await app.request(`/${query}`);
  return { res, html: await res.text() };
}

/**
 * The bodies of the page's inline scripts,
 * which are the blocks a CSP hash has to cover.
 */
async function scriptBlocks(html: string): Promise<string[]> {
  const blocks: string[] = [];
  let current = "";
  await new HTMLRewriter()
    .on("script", {
      text(chunk) {
        current += chunk.text;
        if (chunk.lastInTextNode) {
          blocks.push(current);
          current = "";
        }
      },
    })
    .transform(new Response(html))
    .text();
  return blocks;
}

async function sha256(source: string): Promise<string> {
  return `'sha256-${new Bun.CryptoHasher("sha256").update(source).digest("base64")}'`;
}

describe("preview page debug user", () => {
  test("debugUser renders the signed-in bar, with its menu", async () => {
    const { res, html } = await preview(
      "?debugUser=Navn+Navnesen&debugEmail=navn.navnesen@entur.org",
    );
    expect(res.status).toBe(200);
    expect(html).toContain('id="uniformen-user-menu-panel"');
    // The chip and the panel both name them.
    expect(html.match(/Navn Navnesen/g)).toHaveLength(2);
    expect(html).toContain("navn.navnesen@entur.org");
    expect(html).toContain('href="/auth/logout"');
    // The handler that opens the panel has to be on the page, or the knob shows
    // markup that does not respond to a click.
    expect((await scriptBlocks(html)).join("")).toContain("data-uniformen-user-menu-toggle");
  });

  // The page inlines the stylesheet, so every one of these class names appears in
  // it as a selector regardless. Absence is asserted on the markup form.
  test("debugEmail is optional", async () => {
    const { html } = await preview("?debugUser=Navne+Navnesen");
    expect(html).toContain('id="uniformen-user-menu-panel"');
    expect(html).not.toContain('class="uniformen-user-menu__email"');
  });

  test("no debugUser renders the anonymous bar", async () => {
    const { html } = await preview();
    expect(html).not.toContain('id="uniformen-user-menu-panel"');
    expect(html).not.toContain('class="uniformen-user-menu"');
    expect(html).toContain('href="/auth/login"');
  });

  test("the knob is the preview page's alone, never /ssr's", async () => {
    // Being signed in is something a token establishes. If `/ssr` honoured this,
    // any consumer could render a name of its choosing in the signed-in chrome.
    const res = await app.request("/ssr?debugUser=Spoofet+Bruker&debugEmail=spoof@entur.org");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.headerHtml).not.toContain("Spoofet Bruker");
    expect(body.headerHtml).not.toContain("spoof@entur.org");
    expect(body.headerHtml).not.toContain("uniformen-user-menu");
  });

  test("production renders nobody, whatever the URL says", async () => {
    // The preview page ships to every environment. The suite runs as dev (see
    // test/authTestSetup), so the resolver takes the environment as an argument.
    const query = { debugUser: "Navn Navnesen", debugEmail: "navn.navnesen@entur.org" };
    expect(previewUser(query, "production")).toBeUndefined();
    for (const env of ["local", "dev", "staging"] satisfies Environment[]) {
      expect(previewUser(query, env)).toEqual({
        name: "Navn Navnesen",
        email: "navn.navnesen@entur.org",
      });
    }
  });

  test("an empty or oversized value is rejected rather than rendered", async () => {
    for (const query of [
      "?debugUser=",
      "?debugEmail=",
      `?debugUser=${"a".repeat(121)}`,
      `?debugUser=Navn&debugEmail=${"a".repeat(121)}`,
    ]) {
      const { res } = await preview(query);
      expect(res.status).toBe(400);
    }
  });
});

describe("preview page demo sidebar", () => {
  test("sidebar=true renders a sidebar with content to collapse", async () => {
    const { res, html } = await preview("?sidebar=true");
    expect(res.status).toBe(200);
    expect(html).toContain('class="preview-sidebar"');
    expect(html).toContain("Bestillinger");
    expect(html).toContain("data-preview-sidebar-close");
  });

  test("no param leaves the page without one", async () => {
    const { html } = await preview();
    expect(html).not.toContain('class="preview-sidebar"');
    expect(html).not.toContain("data-preview-sidebar-close");
  });

  test("the collapsed width is CSS off the root attribute, not script", async () => {
    const { html } = await preview("?sidebar=true");
    expect(html).toMatch(/:root\[data-uniformen-sidebar="collapsed"\] \.preview-sidebar/);
  });

  test("collapsing hides it from the a11y tree, not just from the eye", async () => {
    // Width alone leaves the links focusable and announced. The demo is the worked
    // example apps copy, so it has to get this right.
    const { html } = await preview("?sidebar=true");
    const collapsed = html.match(
      /:root\[data-uniformen-sidebar="collapsed"\] \.preview-sidebar \{([^}]*)\}/,
    )?.[1];
    expect(collapsed).toContain("width: 0");
    expect(collapsed).toContain("visibility: hidden");
  });

  test("the demo's own close button writes the attribute, like any app would", async () => {
    const { html } = await preview("?sidebar=true");
    const closeHandler = (await scriptBlocks(html)).find((block) =>
      block.includes("data-preview-sidebar-close"),
    );
    expect(closeHandler).toContain('setAttribute("data-uniformen-sidebar", "collapsed")');
    // Not by reaching for a Uniformen API: there isn't one to reach for.
    expect(closeHandler).not.toContain("uniformen:sidebar");
  });

  test("every inline script the page renders is hashed in its own CSP", async () => {
    const { res, html } = await preview("?sidebar=true");
    const csp = res.headers.get("content-security-policy") ?? "";
    const blocks = await scriptBlocks(html);
    expect(blocks).toHaveLength(3);
    for (const block of blocks) expect(csp).toContain(await sha256(block));
  });
});
