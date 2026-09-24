import { describe, expect, test } from "bun:test";
import { AppSwitcher } from "./AppSwitcher";
import { PORTAL_APPLICATIONS, type PortalApplicationId } from "./portalApplications";
import { expectedUrls } from "../test/expectedPortalUrls";
import { renderComponentToString } from "../ssr/renderComponentToString";
import type { Environment } from "../config";
import type { Locale } from "../types";

// The test server always runs as dev (see test/authTestSetup). The switcher takes
// the environment as a prop, so these tests can render the other environments too.
const ENVIRONMENTS: Environment[] = ["local", "dev", "staging", "production"];

/** Returns the hrefs in document order. The switcher only links to the applications. */
const hrefs = (html: string): string[] =>
  [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1] as string);

/** Renders the switcher in Bokmål unless the test passes a locale. */
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
    // Check that the marker is on the CLEOS link, not just on the first item.
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
      // No `</a>` may come between the href and the marker, so the marker is on this link.
      expect((marked as string).lastIndexOf(`href="${url}"`)).toBeGreaterThan(
        (marked as string).lastIndexOf("</a>"),
      );
    }
  });
});
