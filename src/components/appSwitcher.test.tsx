import { describe, expect, test } from "bun:test";
import { AppSwitcher } from "./AppSwitcher";
import { PORTAL_APPLICATIONS, type PortalApplicationId } from "./portalApplications";
import { expectedUrls } from "../test/expectedPortalUrls";
import { renderComponentToString } from "../ssr/renderComponentToString";
import type { Environment } from "../config";
import type { Locale } from "../types";

// The server resolves its environment once at startup, so the suite as a whole
// only ever runs as one of them (dev, see test/authTestSetup). The switcher takes
// the environment as a prop so the other lists can be rendered here.
const ENVIRONMENTS: Environment[] = ["local", "dev", "staging", "production"];

/** Hrefs in document order. The switcher's only links are the application list. */
const hrefs = (html: string): string[] =>
  [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1] as string);

/** Bokmål unless the test is about the language. */
const render = (
  props: { environment?: Environment; activeAppId?: PortalApplicationId; locale?: Locale } = {},
) => renderComponentToString(<AppSwitcher locale="nb-NO" {...props} />);

describe("app switcher rendering", () => {
  test("the panel links to the environment it is served from", async () => {
    for (const env of ENVIRONMENTS) {
      const html = await render({ environment: env });
      expect(hrefs(html)).toEqual(expectedUrls(env));
    }
  });

  test("every application is named", async () => {
    const html = await render({ environment: "production" });
    for (const { appName } of PORTAL_APPLICATIONS.production) {
      expect(html).toContain(`>${appName}<`);
    }
  });

  test("the panel is a title and the list, in every language", async () => {
    for (const locale of ["nb-NO", "nn-NO", "en-GB"] as Locale[]) {
      const html = await render({ locale });
      for (const gone of ["Favoritt", "Favourites", "Legg til", "Alle tjenester", "All services"]) {
        expect(html).not.toContain(gone);
      }
    }
  });

  test("the app the header is rendered for is the current page", async () => {
    const html = await render({ environment: "dev", activeAppId: "cleos" });
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    // The marker sits on CLEOS' own link, not on whichever item renders first.
    expect(html).toMatch(
      /href="https:\/\/cleos-client\.dev\.entur\.io"[^>]*aria-current="page"|aria-current="page"[^>]*href="https:\/\/cleos-client\.dev\.entur\.io"/,
    );
    expect(html).toContain("uniformen-app-switcher__item--active");
  });

  test("no app is current when the consumer names none", async () => {
    const html = await render({ environment: "dev" });
    expect(html).not.toContain('aria-current="page"');
    expect(html).not.toContain("uniformen-app-switcher__item--active");
  });

  test("an unlisted application is not in the panel, and marks nothing in it", async () => {
    for (const env of ENVIRONMENTS) {
      const html = await render({ environment: env, activeAppId: "skoleskyss" });
      expect(html).not.toContain("Skoleskyss");
      expect(html).not.toContain("skoleskyss.entur.no");
      expect(html).not.toContain('aria-current="page"');
      expect(hrefs(html)).toEqual(expectedUrls(env));
    }
  });

  test("each application marks its own entry", async () => {
    for (const { id, url } of PORTAL_APPLICATIONS.production) {
      const html = await render({ environment: "production", activeAppId: id });
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
