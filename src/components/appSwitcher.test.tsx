import { describe, expect, test } from "bun:test";
import { AppSwitcher } from "./AppSwitcher";
import { PORTAL_APPLICATIONS } from "./portalApplications";
import { expectedUrls } from "../test/expectedPortalUrls";
import { renderComponentToString } from "../ssr/renderComponentToString";
import type { Environment } from "../config";

// The server resolves its environment once at startup, so the suite as a whole
// only ever runs as one of them (dev, see test/authTestSetup). The switcher takes
// the environment as a prop so the other lists can be rendered here.
const ENVIRONMENTS: Environment[] = ["local", "dev", "staging", "production"];

/** Hrefs in document order. The switcher's only links are the application list. */
const hrefs = (html: string): string[] =>
  [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1] as string);

describe("app switcher rendering", () => {
  test("the panel links to the environment it is served from", async () => {
    for (const env of ENVIRONMENTS) {
      const html = await renderComponentToString(<AppSwitcher environment={env} />);
      expect(hrefs(html)).toEqual(expectedUrls(env));
    }
  });

  test("every application is named", async () => {
    const html = await renderComponentToString(<AppSwitcher environment="production" />);
    for (const { appName } of PORTAL_APPLICATIONS.production) {
      expect(html).toContain(`>${appName}<`);
    }
  });

  test("the app the header is rendered for is the current page", async () => {
    const html = await renderComponentToString(
      <AppSwitcher environment="dev" activeAppId="cleos" />,
    );
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    // The marker sits on CLEOS' own link, not on whichever item renders first.
    expect(html).toMatch(
      /href="https:\/\/cleos-client\.dev\.entur\.io"[^>]*aria-current="page"|aria-current="page"[^>]*href="https:\/\/cleos-client\.dev\.entur\.io"/,
    );
    expect(html).toContain("uniformen-app-switcher__item--active");
  });

  test("no app is current when the consumer names none", async () => {
    const html = await renderComponentToString(<AppSwitcher environment="dev" />);
    expect(html).not.toContain('aria-current="page"');
    expect(html).not.toContain("uniformen-app-switcher__item--active");
  });

  test("each application marks its own entry", async () => {
    for (const { id, url } of PORTAL_APPLICATIONS.production) {
      const html = await renderComponentToString(
        <AppSwitcher environment="production" activeAppId={id} />,
      );
      expect(html.match(/aria-current="page"/g)).toHaveLength(1);
      expect(html).toContain(url);
      const [marked] = html.split('aria-current="page"');
      // The marked link is the one whose href immediately precedes the marker.
      expect((marked as string).lastIndexOf(`href="${url}"`)).toBeGreaterThan(
        (marked as string).lastIndexOf("</a>"),
      );
    }
  });
});
