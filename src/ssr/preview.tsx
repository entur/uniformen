import { createRoute, type OpenAPIHono } from "@hono/zod-openapi";
import { Footer } from "./Footer";
import { renderComponentToString } from "./renderComponentToString";
import { TopNavigation } from "./TopNavigation";

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
                <meta charset="UTF-8 />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <style>
                    @font-face {
                      font-family: "Nationale";
                      font-weight: 500;
                      src: url("https://entur.github.io/entur-partner-packages/sidebar/latest/fonts/Entur-Nationale-Medium.woff2") format("woff2");
                    }

                    @font-face {
                      font-family: "Nationale";
                      font-weight: 600;
                      src: url("https://entur.github.io/entur-partner-packages/sidebar/latest/fonts/Entur-Nationale-Demibold.woff2") format("woff2");
                    }

                    html, body { height: 100%; }

                    body {
                        font-family: Nationale, serif;
                        display: flex;
                        flex-direction: column;
                        height: 100%;
                        margin: 0;
                    }
                    main { flex: 1 0 auto; }
                </style>
            </head>
            <body>
                ${await renderComponentToString(<TopNavigation nonce="preview-nonce" />)}
                <main></main>
                ${await renderComponentToString(<Footer nonce="preview-nonce" />)}
            </body>
        </html>
    `);
  });
}
