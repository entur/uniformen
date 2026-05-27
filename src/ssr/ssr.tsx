import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { Footer } from "./Footer";
import { renderComponentToString } from "./renderComponentToString";
import { TopNavigation } from "./TopNavigation";

const uniformenHeaderSchema = z.object({
  // Define any headers we want to validate here
});

const uniformenQuerySchema = z.object({
  nonce: z.string().regex(/^[a-zA-Z0-9_-]+$/),
});

const uniformenBodySchema = z.object({
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
      headerHtml: await renderComponentToString(<TopNavigation nonce={nonce} />),
      footerHtml: await renderComponentToString(<Footer nonce={nonce} />),
    });
  });
}
