import { createRoute, type OpenAPIHono } from "@hono/zod-openapi";
import { Footer } from "./Footer";
import { renderComponentToString } from "./renderComponentToString";
import { sha256Source } from "./sha256";
import { TopNavigation } from "./TopNavigation";
import { renderUniformenScripts, uniformenScriptsHash } from "./uniformenScripts";
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
                    main { flex: 1 0 auto; }
`.trim();

const previewBaseCssHash = await sha256Source(PREVIEW_BASE_CSS);

// CSP restricting inline scripts/styles to the exact hashed blocks we render.
const previewCsp = [
  `script-src ${uniformenScriptsHash}`,
  `style-src ${previewBaseCssHash} ${uniformenCssHash}`,
].join("; ");

export function previewRoutes(server: OpenAPIHono): void {
  const previewRoute = createRoute({
    method: "get",
    path: "/",
    request: {
      query: uniformenQuerySchema,
    },
    responses: {
      200: {
        description: "Preview HTML for header and footer.",
      },
    },
  });

  server.openapi(previewRoute, async (ctx) => {
    ctx.header("Content-Security-Policy", previewCsp);
    const navProps = topNavigationProps(ctx.req.valid("query"));
    return ctx.html(`
        <html lang="nb">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <style>${PREVIEW_BASE_CSS}</style>
                ${renderUniformenStyleTag()}
            </head>
            <body>
                ${await renderComponentToString(<TopNavigation {...navProps} />)}
                <main></main>
                ${await renderComponentToString(<Footer />)}
                ${renderUniformenScripts()}
            </body>
        </html>
    `);
  });
}
