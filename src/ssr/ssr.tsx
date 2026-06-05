import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { optionalAuth } from "../auth/optionalAuth";
import { Footer } from "./Footer";
import { renderComponentToString } from "./renderComponentToString";
import { TopNavigation } from "./TopNavigation";
import { UNIFORMEN_SCRIPTS } from "./uniformenScripts";
import { UNIFORMEN_CSS } from "./uniformenStyles";
import { html, raw } from "hono/html";

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
  scripts: z.string(),
});

export function uniformenSsrRoutes(server: OpenAPIHono): void {
  server.openAPIRegistry.registerComponent("securitySchemes", "Bearer", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
  });

  // Public endpoint. A valid Auth0 token is optional and only used to enrich
  // the rendered output
  server.use("/ssr", optionalAuth);

  const rootRoute = createRoute({
    method: "get",
    path: "/ssr",
    // Bearer is optional: sending a valid token adds the user to the nav.
    security: [{ Bearer: [] }],
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

    const payload = ctx.get("jwtPayload");
    const user = payload?.name ?? payload?.sub;

    return ctx.json(
      {
        headAssets: await html`<style nonce="${nonce}">
          ${raw(UNIFORMEN_CSS)}
        </style>`,
        headerHtml: await renderComponentToString(<TopNavigation user={user} />),
        footerHtml: await renderComponentToString(<Footer />),
        scripts: `<script nonce="${nonce}">${raw(UNIFORMEN_SCRIPTS)}</script>`,
      },
      200,
    );
  });
}
