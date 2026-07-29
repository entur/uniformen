import { describe, expect, test } from "bun:test";
import { app } from "../index";

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
