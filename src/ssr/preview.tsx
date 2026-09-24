import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { environment as runningEnvironment, type Environment } from "../config";
import type { UserMenuUser } from "../components/UserMenu";
import { Footer } from "./Footer";
import { PreviewControls } from "./PreviewControls";
import { PreviewSidebar } from "./PreviewSidebar";
import { renderComponentToString } from "./renderComponentToString";
import { sha256Source } from "./sha256";
import { TopNavigation } from "./TopNavigation";
import { renderUniformenScripts, uniformenScriptsHash } from "./uniformenScripts";
import { renderUniformenHeadScript, uniformenHeadScriptHash } from "./uniformenHeadScript";
import { renderUniformenStyleTag, uniformenCssHash } from "./uniformenStyles";
import { topNavigationProps, uniformenQuerySchema } from "./uniformenQuery";

// Base styles for the preview page: fonts and layout. It is a constant so its exact
// text can be hashed for the CSP `style-src` directive.
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

                    /* With contrast=true the app's page behind the header is dark, so
                       the preview page is dark too. The contrast colours are hard to
                       judge on a white page. The controls keep their white card. */
                    body.preview--contrast { background: #08091c; }

                    /* Dark colours for the example sidebar in contrast mode, so it can
                       be read on the dark page. */
                    .preview--contrast .preview-sidebar { border-right-color: #393d79; }
                    .preview--contrast .preview-sidebar__title,
                    .preview--contrast .preview-sidebar__close,
                    .preview--contrast .preview-sidebar__link { color: #ffffff; }
                    .preview--contrast .preview-sidebar__heading { color: #aeb7e2; }
                    .preview--contrast .preview-sidebar__close:hover,
                    .preview--contrast .preview-sidebar__link:hover { background: #393d79; }

                    /* Example side navigation, for testing the collapse button by hand.
                       The width animates. The inner column has a fixed width, so the
                       content slides out of view instead of wrapping. */
                    .preview-sidebar {
                        width: 16rem;
                        flex: 0 0 auto;
                        overflow: hidden;
                        border-right: 1px solid #e5e5e9;
                        transition: width 150ms ease, visibility 150ms ease;
                    }

                    /* Zero width alone does not remove the links from the tab order or
                       from screen readers. visibility: hidden does. Because visibility
                       has a transition, the content stays visible until the animation
                       ends. */
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

                    /* The parameter controls, in the content area. */
                    .preview-controls {
                        flex: 1 1 auto;
                        /* Without this, a flex item cannot get narrower than its content.
                           The box would then make the page scroll sideways instead of
                           putting the two groups in one column. */
                        min-width: 0;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 0.75rem;
                        padding: 2rem 1rem;
                        color: #181c56;
                    }

                    .preview-controls__form {
                        width: 100%;
                        max-width: 52rem;
                        display: flex;
                        flex-direction: column;
                        gap: 1.25rem;
                        padding: 1.5rem;
                        border: 1px solid #e5e5e9;
                        border-radius: 0.5rem;
                        background: #fff;
                    }

                    .preview-controls__title {
                        margin: 0;
                        font-size: 1.25rem;
                        font-weight: 600;
                    }

                    .preview-controls__intro {
                        margin: -0.75rem 0 0;
                        font-size: 0.875rem;
                        color: #4c4f70;
                    }

                    /* The left and right groups, on the same sides as the parts of the
                       bar they control. When there is not enough room they wrap into one
                       column, and the group titles show which side is which. */
                    .preview-controls__sides {
                        display: flex;
                        flex-wrap: wrap;
                        justify-content: space-between;
                        gap: 1.25rem 2rem;
                    }

                    .preview-controls__group {
                        display: flex;
                        flex-direction: column;
                        gap: 1.25rem;
                        margin: 0;
                        padding: 0;
                        border: 0;
                        min-width: 0;
                    }

                    .preview-controls__group--left,
                    .preview-controls__group--right { flex: 0 1 21rem; }

                    /* The group for the whole bar is below the other two, with a line
                       above it. */
                    .preview-controls__group--whole {
                        padding-top: 1.25rem;
                        border-top: 1px solid #e5e5e9;
                    }

                    .preview-controls__group-title {
                        padding: 0 0 0.5rem;
                        font-size: 0.75rem;
                        font-weight: 600;
                        letter-spacing: 0.03em;
                        text-transform: uppercase;
                        color: #6b708f;
                    }

                    .preview-controls__group--right .preview-controls__group-title {
                        margin-left: auto;
                    }

                    .preview-controls__field {
                        display: flex;
                        flex-direction: column;
                        gap: 0.375rem;
                    }

                    /* Options in one row, used for the short list of locales. */
                    .preview-controls__row {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 0.25rem 1.5rem;
                    }

                    .preview-controls__label {
                        font-family: ui-monospace, monospace;
                        font-size: 0.8125rem;
                        font-weight: 600;
                        letter-spacing: 0.02em;
                    }

                    .preview-controls__hint {
                        font-size: 0.8125rem;
                        color: #6b708f;
                    }

                    .preview-controls__check {
                        display: flex;
                        align-items: center;
                        gap: 0.5rem;
                        font-size: 0.875rem;
                    }

                    .preview-controls__select,
                    .preview-controls__text {
                        font: inherit;
                        font-size: 0.875rem;
                        padding: 0.375rem 0.5rem;
                        border: 1px solid #b8bad0;
                        border-radius: 0.25rem;
                        background: #fff;
                        color: inherit;
                    }

                    .preview-controls__text { flex: 1 1 auto; min-width: 0; }

                    /* Fixed label width, so the two text fields line up. */
                    .preview-controls__name { flex: 0 0 5.5rem; }

                    .preview-controls__actions {
                        display: flex;
                        align-items: center;
                        gap: 1rem;
                    }

                    .preview-controls__submit {
                        font: inherit;
                        font-size: 0.875rem;
                        font-weight: 600;
                        padding: 0.5rem 1.25rem;
                        border: 0;
                        border-radius: 0.25rem;
                        background: #181c56;
                        color: #fff;
                        cursor: pointer;
                    }

                    .preview-controls__reset {
                        font-size: 0.875rem;
                        color: #181c56;
                    }

                    .preview-controls__url {
                        width: 100%;
                        max-width: 52rem;
                        display: flex;
                        align-items: center;
                        gap: 0.75rem;
                    }

                    .preview-controls__url-text {
                        flex: 1 1 auto;
                        min-width: 0;
                        overflow-x: auto;
                        white-space: nowrap;
                        font-size: 0.8125rem;
                        padding: 0.5rem;
                        border-radius: 0.25rem;
                        background: #e9eaf3;
                    }

                    .preview-controls__copy {
                        font: inherit;
                        flex: 0 0 auto;
                        white-space: nowrap;
                        font-size: 0.8125rem;
                        padding: 0.4375rem 0.75rem;
                        border: 1px solid #b8bad0;
                        border-radius: 0.25rem;
                        background: #fff;
                        color: inherit;
                        cursor: pointer;
                    }
`.trim();

/**
 * Script for the preview page. It does what a consuming app would do.
 *
 * The example sidebar's close button sets the sidebar attribute on the root element,
 * like the top bar button does. On a `uniformen:locale` event the page reloads with
 * the new `locale` in the URL. A real app would save the choice, for example in a
 * cookie, and reload.
 *
 * The form handlers submit the form on every change. On submit they disable empty
 * controls, because a form would send them as `app=` and the schema rejects empty
 * values. A disabled field is not submitted.
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

  const controls = document.querySelector<HTMLFormElement>("[data-preview-controls]");
  controls?.addEventListener("submit", () => {
    const fields = controls.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      "input[type=text], select",
    );
    for (const field of fields) if (!field.value) field.disabled = true;

    // The hidden entry in `availableLocales` is the locale the page was rendered in. If
    // the user picked a new locale, check its box too, because the schema rejects a list
    // without `locale`. If no other box is checked, there is no list, so drop the hidden
    // entry as well.
    const boxes = [
      ...controls.querySelectorAll<HTMLInputElement>("input[type=checkbox][name=availableLocales]"),
    ];
    const locale = controls.querySelector<HTMLInputElement>("input[name=locale]:checked");
    const locked = controls.querySelector<HTMLInputElement>("[data-preview-locale]");
    if (boxes.some((box) => box.checked)) {
      for (const box of boxes) if (box.value === locale?.value) box.checked = true;
    } else if (locked) {
      locked.disabled = true;
    }
  });

  // Submit on every change. Checkboxes and menus fire `change` when picked, and a
  // text field fires it only when it loses focus, not on every key.
  const FOCUS_KEY = "uniformen-preview-focus";
  controls?.addEventListener("change", (event) => {
    const field = event.target as HTMLInputElement | HTMLSelectElement;
    // Submitting loads a new page, which loses focus. Save the control's name and value
    // so it can be focused again, even if the form renders differently.
    sessionStorage.setItem(FOCUS_KEY, `${field.name}\n${field.value}`);
    controls.requestSubmit();
  });

  const [name = "", value = ""] = (sessionStorage.getItem(FOCUS_KEY) ?? "").split("\n");
  sessionStorage.removeItem(FOCUS_KEY);
  if (controls && name) {
    // Radio buttons and checkboxes share a name, so use the value to find the right one.
    // If that finds nothing, for example for a text field, find the control by name only.
    const field =
      (value &&
        controls.querySelector<HTMLElement>(
          `[name=${CSS.escape(name)}][value=${CSS.escape(value)}]`,
        )) ||
      controls.querySelector<HTMLElement>(`[name=${CSS.escape(name)}]`);
    field?.focus();
  }

  const copy = document.querySelector("[data-preview-copy]");
  copy?.addEventListener("click", async () => {
    // Copy the URL printed on the page, not the one in the address bar. The printed URL
    // is built from the validated query and has no extra parameters.
    const printed = document.querySelector("[data-preview-url]");
    const label = copy.textContent;
    try {
      await navigator.clipboard.writeText(
        new URL(printed?.textContent ?? "", window.location.href).href,
      );
      copy.textContent = "Kopiert";
    } catch {
      // The clipboard is blocked. Select the URL instead, so the user can copy it.
      if (printed) window.getSelection()?.selectAllChildren(printed);
      copy.textContent = "Merket";
    }
    window.setTimeout(() => (copy.textContent = label), 1500);
  });
}
  .toString()
  .trim()})();`;

const previewBaseCssHash = await sha256Source(PREVIEW_BASE_CSS);
const previewScriptHash = await sha256Source(PREVIEW_SCRIPT);

// CSP that only allows the inline scripts and styles this page renders, by hash.
const previewCsp = [
  `script-src ${uniformenHeadScriptHash} ${uniformenScriptsHash} ${previewScriptHash}`,
  `style-src ${previewBaseCssHash} ${uniformenCssHash}`,
].join("; ");

/**
 * Query parameters for the preview page. These are the `/ssr` parameters plus some
 * for testing by hand, which start with `debug`.
 *
 * Do not add the `debug` parameters to the shared schema. On `/ssr` they would let
 * any page show any name as the signed-in user. The user must come from the token.
 */
const previewQuerySchema = uniformenQuerySchema.extend({
  // Any text up to 120 characters. The email is not validated, so you can test long
  // names and odd values.
  debugUser: z.string().min(1).max(120).optional(),
  debugEmail: z.string().min(1).max(120).optional(),
  // Whether to render the bar for an Entur user. In `/ssr` this comes from the token.
  // The preview page has no token, so it is a parameter here.
  debugEnturUser: z.enum(["true", "false"]).optional(),
});

export type PreviewQuery = z.infer<typeof previewQuerySchema>;

/**
 * Returns the user to render the preview bar for. Returns `undefined`, which renders
 * the anonymous bar, when `debugUser` is missing or the environment is production.
 *
 * Production ignores the parameters, because a production link that shows a
 * signed-in user with no real session would be misleading. `environment` is a
 * parameter so tests can check the production case.
 */
export function previewUser(
  { debugUser, debugEmail }: Pick<PreviewQuery, "debugUser" | "debugEmail">,
  environment: Environment = runningEnvironment,
): UserMenuUser | undefined {
  if (environment === "production" || !debugUser) return undefined;
  return { name: debugUser, email: debugEmail };
}

/**
 * Checks whether the preview bar is rendered for an Entur user, which shows the
 * environment chip and switcher. Always false in production, for the same reason
 * as in `previewUser`.
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
    // Never cache this developer tool. Its output depends on the instance's
    // environment as well as on the URL.
    ctx.header("Cache-Control", "no-store");
    const query = ctx.req.valid("query");
    const navProps = topNavigationProps(query);
    const user = previewUser(query);
    // With `?sidebar=true`, also render the example sidebar, so the collapse button
    // has something to collapse.
    const sidebar = navProps.sidebar ? await renderComponentToString(<PreviewSidebar />) : "";
    // The locale codes are valid BCP 47 language tags.
    return ctx.html(`
        <html lang="${navProps.locale}">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <style>${PREVIEW_BASE_CSS}</style>
                ${renderUniformenStyleTag()}
                ${renderUniformenHeadScript()}
            </head>
            <body${navProps.contrast ? ' class="preview--contrast"' : ""}>
                ${await renderComponentToString(
                  <TopNavigation
                    {...navProps}
                    user={user}
                    isEnturUser={previewIsEnturUser(query)}
                  />,
                )}
                <main>
                    ${sidebar}
                    ${await renderComponentToString(<PreviewControls query={query} />)}
                </main>
                ${await renderComponentToString(<Footer locale={navProps.locale} />)}
                ${renderUniformenScripts()}
                <script>${PREVIEW_SCRIPT}</script>
            </body>
        </html>
    `);
  });
}
