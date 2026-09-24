import { describe, expect, test } from "bun:test";
import { app } from "../index";
import { previewIsEnturUser, previewUser } from "./preview";
import { PreviewControls } from "./PreviewControls";
import { renderComponentToString } from "./renderComponentToString";
import type { Environment } from "../config";

/** Requests the preview page. `chrome` is the part of the HTML before `<main>`. */
async function preview(query = "") {
  const res = await app.request(`/${query}`);
  const html = await res.text();
  // The controls in `<main>` repeat the query values. Tests that count matches use
  // `chrome`, so the controls are not counted.
  return { res, html, chrome: html.slice(0, html.indexOf("<main")) };
}

/** Returns the contents of each inline script. These are the blocks the CSP hashes must cover. */
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
    const { res, html, chrome } = await preview(
      "?debugUser=Navn+Navnesen&debugEmail=navn.navnesen@entur.org&logoutUrl=/auth/logout",
    );
    expect(res.status).toBe(200);
    expect(html).toContain('id="uniformen-user-menu-panel"');
    // The name appears on the chip and in the panel.
    expect(chrome.match(/Navn Navnesen/g)).toHaveLength(2);
    expect(html).toContain("navn.navnesen@entur.org");
    expect(html).toContain('href="/auth/logout"');
    expect((await scriptBlocks(html)).join("")).toContain("data-uniformen-user-menu-toggle");
  });

  // The page inlines the stylesheet, so these class names always appear in it as
  // selectors. The tests check for the `class="..."` attribute instead.
  test("debugEmail is optional", async () => {
    const { html } = await preview("?debugUser=Navne+Navnesen");
    expect(html).toContain('id="uniformen-user-menu-panel"');
    expect(html).not.toContain('class="uniformen-user-menu__email"');
  });

  test("no debugUser renders the anonymous bar", async () => {
    const { html } = await preview("?loginUrl=/auth/login");
    expect(html).not.toContain('id="uniformen-user-menu-panel"');
    expect(html).not.toContain('class="uniformen-user-menu"');
    expect(html).toContain('href="/auth/login"');
  });

  test("the knob is the preview page's alone, never /ssr's", async () => {
    // If `/ssr` used this param, any consumer could show any name in the signed-in bar.
    const res = await app.request("/ssr?debugUser=Spoofet+Bruker&debugEmail=spoof@entur.org");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.headerHtml).not.toContain("Spoofet Bruker");
    expect(body.headerHtml).not.toContain("spoof@entur.org");
    expect(body.headerHtml).not.toContain("uniformen-user-menu");
  });

  test("production renders nobody, whatever the URL says", async () => {
    // The test server runs as dev (see test/authTestSetup), so this test calls
    // previewUser with each environment directly.
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

describe("preview page debug Entur user", () => {
  test("debugEnturUser renders the environment chip, and the switcher with an app", async () => {
    const { res, html } = await preview("?debugEnturUser=true&app=nplan&debugUser=Navn");
    expect(res.status).toBe(200);
    expect(html).toContain('class="uniformen-env-badge__label">DEV');
    expect(html).toContain("data-uniformen-env-switcher-toggle");
    expect(html).toContain('id="uniformen-environment-switcher-panel"');
  });

  test("no param, or false, leaves the bar without one", async () => {
    for (const query of ["?app=nplan&debugUser=Navn", "?debugEnturUser=false&app=nplan"]) {
      const { html } = await preview(query);
      // The page inlines the stylesheet, so these class names always appear in it as
      // selectors. Check the attributes instead.
      expect(html).not.toContain('class="uniformen-env-badge');
      expect(html).not.toContain('data-uniformen-env-switcher-toggle="');
    }
  });

  test("the chip does not ride along with the debug user", async () => {
    const { html } = await preview("?debugUser=Navn+Navnesen&app=nplan");
    expect(html).toContain("Navn Navnesen");
    expect(html).not.toContain('class="uniformen-env-badge');
  });

  test("the knob is the preview page's alone, never /ssr's", async () => {
    const res = await app.request("/ssr?debugEnturUser=true&app=nplan");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.headerHtml).not.toContain("uniformen-env-badge");
  });

  test("production renders no chip, whatever the URL says", async () => {
    expect(previewIsEnturUser({ debugEnturUser: "true" }, "production")).toBe(false);
    for (const env of ["local", "dev", "staging"] satisfies Environment[]) {
      expect(previewIsEnturUser({ debugEnturUser: "true" }, env)).toBe(true);
      expect(previewIsEnturUser({ debugEnturUser: undefined }, env)).toBe(false);
    }
  });

  test("anything other than true or false is rejected", async () => {
    for (const query of ["?debugEnturUser=yes", "?debugEnturUser=1", "?debugEnturUser="]) {
      expect((await preview(query)).res.status).toBe(400);
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
    // Check the rendered attribute, not the bare name. The page's own script always
    // contains the name.
    expect(html).not.toContain('data-preview-sidebar-close="');
  });

  test("the collapsed width is CSS off the root attribute, not script", async () => {
    const { html } = await preview("?sidebar=true");
    expect(html).toMatch(/:root\[data-uniformen-sidebar="collapsed"\] \.preview-sidebar/);
  });

  test("collapsing hides it from the a11y tree, not just from the eye", async () => {
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
    expect(closeHandler).not.toContain("uniformen:sidebar");
  });

  test("every inline script the page renders is hashed in its own CSP", async () => {
    const { res, html } = await preview("?sidebar=true");
    const csp = res.headers.get("content-security-policy") ?? "";
    const blocks = await scriptBlocks(html);
    expect(blocks).toHaveLength(3);
    for (const block of blocks) expect(csp).toContain(await sha256(block));
  });

  test("the page is never stored", async () => {
    const { res } = await preview("?debugUser=Navn+Navnesen");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("preview page simple", () => {
  test("the page previews the barebones bar, signed in and out", async () => {
    const anonymous = await preview("?simple=true&app=partner&loginUrl=/auth/login");
    expect(anonymous.res.status).toBe(200);
    expect(anonymous.html).toContain('href="/auth/login"');
    expect(anonymous.html).not.toContain('aria-label="Velg applikasjon"');

    const signedIn = await preview("?simple=true&debugUser=Navn+Navnesen&logoutUrl=/auth/logout");
    expect(signedIn.html).toContain("Navn Navnesen");
    expect(signedIn.html).toContain('href="/auth/logout"');
    expect(signedIn.html).not.toContain("Mine tilganger");
  });

  test("simple wins over sidebar, so the demo sidebar goes with the control", async () => {
    const { html } = await preview("?simple=true&sidebar=true");
    // Check the rendered attribute, not the bare name. The head script always
    // contains the name.
    expect(html).not.toContain('data-uniformen-sidebar-toggle="');
    expect(html).not.toContain('class="preview-sidebar"');
    expect(html).not.toContain('data-preview-sidebar-close="');
  });

  test("the footer is the full one", async () => {
    const { html } = await preview("?simple=true");
    expect(html).toContain("Tjenester");
    expect(html).toContain("Informasjon");
  });
});

describe("preview page contrast", () => {
  test("the page behind the header goes dark with the bar", async () => {
    const { html } = await preview("?contrast=true");
    expect(html).toContain('class="uniformen-top-nav uniformen-top-nav--contrast"');
    expect(html).toContain('<body class="preview--contrast">');
  });

  // Check the class attribute on the header, not the class name anywhere on the page.
  // The page inlines the stylesheet, which always contains the contrast rules.
  test("without it the page and the bar are both light", async () => {
    const { html } = await preview();
    expect(html).toContain('class="uniformen-top-nav"');
    expect(html).toContain("<body>");
  });

  test("the copyable link carries it", async () => {
    const { html } = await preview("?contrast=true");
    expect(html).toContain("contrast=true");
  });
});

describe("preview page controls", () => {
  test("the parameters are on the page, as a form that sets them", async () => {
    const { html } = await preview();
    expect(html).toContain('<form class="preview-controls__form" method="get" action="/"');
    for (const param of [
      "app",
      "sidebar",
      "simple",
      "contrast",
      "locale",
      "availableLocales",
      "debugUser",
    ]) {
      expect(html).toContain(`name="${param}"`);
    }
    expect(html).toContain('value="ops-center"');
    expect(html).toContain('value="nn-NO"');
  });

  test("the controls come back set from the query the server validated", async () => {
    const { html } = await preview(
      "?app=nplan&sidebar=true&locale=en-GB&availableLocales=nb-NO&availableLocales=en-GB&debugUser=Navn",
    );
    expect(html).toContain('<option value="nplan" selected="">');
    expect(html).toContain('name="sidebar" value="true" checked=""');
    expect(html).toContain('name="locale" value="en-GB" checked=""');
    expect(html).toContain('name="availableLocales" value="nb-NO" checked=""');
    expect(html).toContain('name="availableLocales" value="nn-NO"/>');
    expect(html).toContain('name="debugUser" value="Navn"');
  });

  test("an empty control is dropped rather than submitted as a rejected value", async () => {
    const { html } = await preview();
    const handler = (await scriptBlocks(html)).find((block) =>
      block.includes("data-preview-controls"),
    );
    expect(handler).toContain("field.disabled");
    for (const query of ["?app=", "?debugUser="]) {
      expect((await preview(query)).res.status).toBe(400);
    }
  });

  test("the language being rendered is locked into availableLocales", async () => {
    const { html } = await preview("?locale=nn-NO&availableLocales=nn-NO&availableLocales=en-GB");
    expect(html).toContain('<input type="checkbox" checked="" disabled=""/>');
    expect(html).toContain('<input type="hidden" name="availableLocales" value="nn-NO"');
    expect(html).not.toContain('name="availableLocales" value="nn-NO" checked=""');
    expect(html).toContain('name="availableLocales" value="en-GB" checked=""');
    expect(html).toContain('name="availableLocales" value="nb-NO"/>');
  });

  test("picking a language adds it to the list rather than sending a 400", async () => {
    expect((await preview("?locale=nn-NO&availableLocales=nb-NO")).res.status).toBe(400);
    const handler = (await scriptBlocks((await preview()).html)).find((block) =>
      block.includes("data-preview-controls"),
    );
    expect(handler).toContain("input[name=locale]:checked");
    expect(handler).toContain("box.checked =");
  });

  test("the locked language alone is no list, and is dropped on the way out", async () => {
    const { html } = await preview();
    expect(html).toContain('<input type="checkbox" checked="" disabled=""/>');
    expect(html).not.toContain('aria-checked="true" lang="nb-NO"');
    expect(html).toContain(">/?locale=nb-NO<");
    const handler = (await scriptBlocks(html)).find((block) =>
      block.includes("data-preview-controls"),
    );
    expect(handler).toContain("data-preview-locale");
    expect(handler).toContain("locked.disabled");
  });

  test("a knob sits where in the bar it has its effect", async () => {
    const { html } = await preview();
    const groups = html.split(/class="preview-controls__group preview-controls__group--/);
    const where = (param: string) =>
      groups.find((group) => group.includes(`name="${param}"`))?.match(/^[a-z]+/)?.[0];
    expect(where("sidebar")).toBe("left");
    expect(where("app")).toBe("left");
    expect(where("debugEnturUser")).toBe("left");
    expect(where("debugUser")).toBe("right");
    expect(where("debugEmail")).toBe("right");
    expect(where("availableLocales")).toBe("right");
    expect(where("loginUrl")).toBe("right");
    expect(where("logoutUrl")).toBe("right");
    expect(where("simple")).toBe("whole");
    expect(where("contrast")).toBe("whole");
    expect(where("locale")).toBe("whole");
  });

  test("a change applies itself, and the reload it costs keeps the focus", async () => {
    const handler = (await scriptBlocks((await preview()).html)).find((block) =>
      block.includes("data-preview-controls"),
    );
    expect(handler).toContain('addEventListener("change"');
    expect(handler).toContain("requestSubmit()");
    expect(handler).toContain("sessionStorage.setItem");
    expect(handler).toContain("sessionStorage.removeItem");
    expect(handler).toContain(".focus()");
  });

  test("the page prints the query it validated, not the URL it was asked for", async () => {
    const { html } = await preview("?sidebar=false&app=nplan&nonsense=1&locale=nb-NO");
    expect(html).toContain(">/?app=nplan&amp;locale=nb-NO<");
    expect(html).not.toContain("nonsense");
  });

  test("loginUrl reaches the bar, and the URL it was set from", async () => {
    const { html } = await preview("?loginUrl=/oauth/start");
    expect(html).toContain('href="/oauth/start"');
    expect(html).toContain(">/?loginUrl=%2Foauth%2Fstart&amp;locale=nb-NO<");
  });

  test("logoutUrl reaches the menu, and the URL it was set from", async () => {
    const { html } = await preview("?debugUser=Navn+Navnesen&logoutUrl=/oauth/end");
    expect(html).toContain('href="/oauth/end"');
    expect(html).toContain(
      ">/?logoutUrl=%2Foauth%2Fend&amp;locale=nb-NO&amp;debugUser=Navn+Navnesen<",
    );
  });

  test("the copy button copies the printed URL, address bar or not", async () => {
    const handler = (await scriptBlocks((await preview()).html)).find((block) =>
      block.includes("data-preview-copy"),
    );
    expect(handler).toContain("data-preview-url");
    expect(handler).toContain("clipboard.writeText");
  });

  test("production is given no knob it ignores", async () => {
    const query = { locale: "nb-NO", debugUser: "Navn", debugEnturUser: "true" } as const;
    const prod = await renderComponentToString(
      <PreviewControls query={query} environment="production" />,
    );
    expect(prod).not.toContain("debugUser");
    expect(prod).not.toContain("debugEnturUser");
    expect(prod).toContain(">/?locale=nb-NO<");

    const dev = await renderComponentToString(<PreviewControls query={query} environment="dev" />);
    expect(dev).toContain('name="debugUser" value="Navn"');
    expect(dev).toContain(">/?locale=nb-NO&amp;debugUser=Navn&amp;debugEnturUser=true<");
  });
});

describe("preview page locale", () => {
  test("the page is marked with the language the chrome is rendered in", async () => {
    expect((await preview()).html).toContain('<html lang="nb-NO">');
    expect((await preview("?locale=en-GB")).html).toContain('<html lang="en-GB">');
    expect((await preview("?locale=nn-NO")).html).toContain('<html lang="nn-NO">');
  });

  test("availableLocales renders the switcher, checked at the language the page is in", async () => {
    const { html } = await preview(
      "?locale=en-GB&availableLocales=nb-NO&availableLocales=en-GB&debugUser=Navn",
    );
    expect(html).toContain("uniformen-locale-menu");
    expect(html).toContain('aria-checked="true" lang="en-GB"');
    expect(html).toContain('aria-checked="false" lang="nb-NO"');
  });

  test("an anonymous preview gets the standalone chip, so a login page can be looked at", async () => {
    const { html } = await preview("?simple=true&availableLocales=nb-NO&availableLocales=en-GB");
    expect(html).toContain("data-uniformen-locale-switcher-toggle");
    expect(html).toContain('aria-label="Språk / Language: Norsk bokmål"');
  });

  test("the page finishes a pick the way an app does: persist, then load a new document", async () => {
    const { html } = await preview("?availableLocales=nb-NO&availableLocales=en-GB&debugUser=Navn");
    const handler = (await scriptBlocks(html)).find((block) =>
      block.includes('addEventListener("uniformen:locale"'),
    );
    expect(handler).toContain('searchParams.set("locale"');
    expect(handler).toContain("location.assign");
  });

  test("every inline script is still hashed on a page with no sidebar", async () => {
    const { res, html } = await preview(
      "?availableLocales=nb-NO&availableLocales=en-GB&debugUser=Navn",
    );
    const csp = res.headers.get("content-security-policy") ?? "";
    const blocks = await scriptBlocks(html);
    expect(blocks).toHaveLength(3);
    for (const block of blocks) expect(csp).toContain(await sha256(block));
  });

  test("the locale reaches the chrome the page renders, header and footer both", async () => {
    const { html } = await preview("?locale=en-GB&debugUser=Navn+Navnesen&logoutUrl=/auth/logout");
    expect(html).toContain(">Log out<");
    expect(html).toContain(">Information<");
  });
});
