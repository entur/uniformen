import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { Footer } from "./Footer";
import { renderComponentToString } from "./renderComponentToString";
import { TopNavigation } from "./TopNavigation";
import { UNIFORMEN_CSS } from "./uniformenStyles";
import { html } from "hono/html";

const uniformenHeaderSchema = z.object({
  // Define any headers we want to validate here
});

const uniformenQuerySchema = z.object({
  nonce: z.string().regex(/^[a-zA-Z0-9_-]+$/),
});

const uniformenBodySchema = z.object({
  headAssets: z.string(),
  headerHtml: z.string(),
  footerHtml: z.string(),
});

export function uniformenSsrRoutes(server: OpenAPIHono): void {
  const rootRoute = createRoute({
    method: "get",
    path: "/ssr",
    request: {
      query: uniformenQuerySchema,
      header: uniformenHeaderSchema,
    },
    responses: {
      200: {
        content: { "application/json": { schema: uniformenBodySchema } },
        description: "HTML for rendering header and footer server-side.",
      },
    },
  });

  server.openapi(rootRoute, async (ctx) => {
    const { nonce } = ctx.req.valid("query");

    return ctx.json({
      headAssets: await html`<style nonce="${nonce}">
        ${UNIFORMEN_CSS}
      </style>`,
      headerHtml: await renderComponentToString(<TopNavigation />),
      footerHtml: await renderComponentToString(<Footer />),
    });
  });
}
