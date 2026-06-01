import { createRoute, type OpenAPIHono } from "@hono/zod-openapi";
import { raw } from "hono/html";
import { Footer } from "./Footer";
import { renderComponentToString } from "./renderComponentToString";
import { TopNavigation } from "./TopNavigation";
import { UNIFORMEN_SCRIPTS } from "./uniformenScripts";
import { UNIFORMEN_CSS } from "./uniformenStyles";

export function previewRoutes(server: OpenAPIHono): void {
  const previewRoute = createRoute({
    method: "get",
    path: "/",
    responses: {
      200: {
        description: "Preview HTML for header and footer.",
      },
    },
  });

  server.openapi(previewRoute, async (ctx) => {
    return ctx.html(`
        <html lang="nb">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <style>
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
                </style>
                <style>${UNIFORMEN_CSS}</style>
            </head>
            <body>
                ${await renderComponentToString(<TopNavigation />)}
                <main></main>
                ${await renderComponentToString(<Footer />)}
                <script>${raw(UNIFORMEN_SCRIPTS)}</script>
            </body>
        </html>
    `);
  });
}
