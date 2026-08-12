import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { environment as runningEnvironment, type Environment } from "../config";
import type { UserMenuUser } from "../components/UserMenu";
import { Footer } from "./Footer";
import { PreviewSidebar } from "./PreviewSidebar";
import { renderComponentToString } from "./renderComponentToString";
import { sha256Source } from "./sha256";
import { TopNavigation } from "./TopNavigation";
import { renderUniformenScripts, uniformenScriptsHash } from "./uniformenScripts";
import { renderUniformenHeadScript, uniformenHeadScriptHash } from "./uniformenHeadScript";
import { renderUniformenStyleTag, uniformenCssHash } from "./uniformenStyles";
import { topNavigationProps, uniformenQuerySchema } from "./uniformenQuery";

// The preview page's own base styles (fonts + layout reset). Held as a const so
// its exact bytes can be hashed for the CSP `style-src` directive.
const PREVIEW_BASE_CSS = `
                    @font-face {
                      font-family: "Nationale";
                      font-weight: 500;
                      src: url("/static/fonts/Entur-Nationale-Medium.woff2") format("woff2");
                    }

                    @font-face {
                      font-family: "Nationale";
                      font-weight: 600;
                      src: url("/static/fonts/Entur-Nationale-Demibold.woff2") format("woff2");
                    }

                    *, *::before, *::after { box-sizing: border-box; }

                    html, body {
                        height: 100%;
                        margin: 0;
                        padding: 0;
                    }

                    body {
                        font-family: Nationale, sans-serif;
                        display: flex;
                        flex-direction: column;
                    }
                    main { flex: 1 0 auto; display: flex; }

                    /* Stand-in for a consuming app's side navigation, so the collapse
                       control can be checked by hand. Written the way apps should write
                       it: state read off the root attribute, no JavaScript involved.
                       The width animates; the inner column keeps a fixed width so the
                       content slides out of view instead of reflowing on the way. */
                    .preview-sidebar {
                        width: 16rem;
                        flex: 0 0 auto;
                        overflow: hidden;
                        border-right: 1px solid #e5e5e9;
                        transition: width 150ms ease, visibility 150ms ease;
                    }

                    /* Zero width alone only hides it from the eye: the links stay
                       focusable and announced, so a collapsed sidebar becomes a run of
                       invisible tab stops. Hiding visibility takes it out of the tab
                       order and the a11y tree, and transitioning that keeps the content
                       visible until the collapse has finished animating. */
                    :root[data-uniformen-sidebar="collapsed"] .preview-sidebar {
                        width: 0;
                        visibility: hidden;
                    }

                    .preview-sidebar__inner {
                        width: 16rem;
                        height: 100%;
                        padding: 1rem 0.75rem;
                        overflow-y: auto;
                    }

                    .preview-sidebar__head {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: 0 0.5rem 0.75rem;
                    }

                    .preview-sidebar__title {
                        font-weight: 600;
                        font-size: 1rem;
                        color: #181c56;
                    }

                    .preview-sidebar__close {
                        border: 0;
                        background: none;
                        padding: 0 0.25rem;
                        font: inherit;
                        font-size: 1.25rem;
                        line-height: 1;
                        color: #181c56;
                        cursor: pointer;
                        border-radius: 0.25rem;
                    }

                    .preview-sidebar__close:hover { background: #e9eaf3; }

                    .preview-sidebar__nav {
                        display: flex;
                        flex-direction: column;
                        gap: 1.25rem;
                    }

                    .preview-sidebar__heading {
                        display: block;
                        padding: 0 0.5rem 0.375rem;
                        font-size: 0.75rem;
                        font-weight: 600;
                        letter-spacing: 0.03em;
                        text-transform: uppercase;
                        color: #6b708f;
                    }

                    .preview-sidebar__list {
                        list-style: none;
                        margin: 0;
                        padding: 0;
                    }

                    .preview-sidebar__link {
                        display: block;
                        padding: 0.4375rem 0.5rem;
                        border-radius: 0.25rem;
                        font-size: 0.875rem;
                        color: #181c56;
                        text-decoration: none;
                        white-space: nowrap;
                    }

                    .preview-sidebar__link:hover { background: #e9eaf3; }
`.trim();

/**
 * The consuming app's half of the two contracts the page demonstrates, written the
 * way an app writes it.
 *
 * The demo sidebar's close button stands in for whatever an app collapses from: a
 * shortcut, a route change, a button of its own. It writes the state attribute — the
 * same thing the top bar button does — and that is all an app ever has to do.
 *
 * The language event is the app's to finish: persist the choice, then load a new
 * document in it. The preview page's URL is its persistence, so it puts the picked
 * language in `locale` and navigates — where an app would write its cookie and
 * reload. Nothing here re-labels the bar, because nothing can.
 *
 * Both are bound unconditionally: neither has anything to do on a page that renders
 * no sidebar and no switcher.
 */
const PREVIEW_SCRIPT = `(${function previewHandlers() {
  const close = document.querySelector("[data-preview-sidebar-close]");
  close?.addEventListener("click", () => {
    document.documentElement.setAttribute("data-uniformen-sidebar", "collapsed");
  });

  window.addEventListener("uniformen:locale", (event) => {
    const url = new URL(window.location.href);
    url.searchParams.set("locale", (event as CustomEvent<{ locale: string }>).detail.locale);
    window.location.assign(url.toString());
  });
}
  .toString()
  .trim()})();`;

const previewBaseCssHash = await sha256Source(PREVIEW_BASE_CSS);
const previewScriptHash = await sha256Source(PREVIEW_SCRIPT);

// CSP restricting inline scripts/styles to the exact hashed blocks we render.
const previewCsp = [
  `script-src ${uniformenHeadScriptHash} ${uniformenScriptsHash} ${previewScriptHash}`,
  `style-src ${previewBaseCssHash} ${uniformenCssHash}`,
].join("; ");

/**
 * The preview page's own parameters: everything `/ssr` takes, plus the ones that
 * only make sense for looking at the page by hand. Those carry a `debug` prefix,
 * so which of them is part of the contract and which is a knob on the dev tool is
 * readable straight off the URL.
 *
 * Deliberately an extension here rather than a widening of the shared schema:
 * signing in is something a consumer's token establishes, and a `user` parameter
 * on `/ssr` would let any page put a name of its choosing in the signed-in
 * chrome. The preview page has no token to go on, and nothing reads its output
 * but a developer, so there it is only a knob.
 */
const previewQuerySchema = uniformenQuerySchema.extend({
  // Free text, and bounded rather than validated: feeding the bar a 100-character
  // name or an address that is not one is the point of having the knob.
  debugUser: z.string().min(1).max(120).optional(),
  debugEmail: z.string().min(1).max(120).optional(),
  // Whether to render the bar as an Entur user's. The organisation is a claim on a
  // token, and the page has none, so on the dev tool it is a knob like the rest.
  debugEnturUser: z.enum(["true", "false"]).optional(),
});

type PreviewQuery = z.infer<typeof previewQuerySchema>;

/**
 * The user the preview page renders the bar for. No `debugUser` is `undefined`,
 * which is the anonymous bar with its login link.
 *
 * Production renders nobody whatever the URL says. The preview page ships to every
 * environment, and a prod URL that puts a name in the signed-in chrome is a
 * confusing thing to be able to hand someone — there is no session or token behind
 * it, which is exactly what makes it misleading.
 *
 * The environment is a parameter because the server resolves its own once at
 * startup: passing it is the only way to cover the production branch from a test.
 */
export function previewUser(
  { debugUser, debugEmail }: Pick<PreviewQuery, "debugUser" | "debugEmail">,
  environment: Environment = runningEnvironment,
): UserMenuUser | undefined {
  if (environment === "production" || !debugUser) return undefined;
  return { name: debugUser, email: debugEmail };
}

/**
 * Whether the preview page renders the environment chip and switcher, i.e. whether
 * the bar is an Entur user's.
 *
 * Held to the same production rule as `previewUser`, and for the same reason: the
 * knob would otherwise hand out a prod URL showing chrome the viewer's own
 * organisation does not entitle them to.
 */
export function previewIsEnturUser(
  { debugEnturUser }: Pick<PreviewQuery, "debugEnturUser">,
  environment: Environment = runningEnvironment,
): boolean {
  return environment !== "production" && debugEnturUser === "true";
}

export function previewRoutes(server: OpenAPIHono): void {
  const previewRoute = createRoute({
    method: "get",
    path: "/",
    request: {
      query: previewQuerySchema,
    },
    responses: {
      200: {
        description: "Preview HTML for header and footer.",
      },
    },
  });

  server.openapi(previewRoute, async (ctx) => {
    ctx.header("Content-Security-Policy", previewCsp);
    // A dev tool, and one whose output depends on the instance's own environment as
    // much as on the URL: never worth a stale copy.
    ctx.header("Cache-Control", "no-store");
    const query = ctx.req.valid("query");
    const navProps = topNavigationProps(query);
    const user = previewUser(query);
    // `?sidebar=true` also gets the demo sidebar: the control is pointless to look
    // at without something for it to collapse.
    const sidebar = navProps.sidebar ? await renderComponentToString(<PreviewSidebar />) : "";
    // Locale codes double as BCP 47 tags.
    return ctx.html(`
        <html lang="${navProps.locale}">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <style>${PREVIEW_BASE_CSS}</style>
                ${renderUniformenStyleTag()}
                ${renderUniformenHeadScript()}
            </head>
            <body>
                ${await renderComponentToString(
                  <TopNavigation
                    {...navProps}
                    user={user}
                    isEnturUser={previewIsEnturUser(query)}
                  />,
                )}
                <main>${sidebar}</main>
                ${await renderComponentToString(<Footer locale={navProps.locale} />)}
                ${renderUniformenScripts()}
                <script>${PREVIEW_SCRIPT}</script>
            </body>
        </html>
    `);
  });
}
