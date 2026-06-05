import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { optionalAuth } from "../auth/optionalAuth";
import { userInfoService } from "../auth/userInfo";
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
    const token = ctx.get("authToken");
    const tenant = ctx.get("authTenant");
    // Resolve userinfo via the tenant's userinfo endpoint (cached); on
    // failure render anonymously — never the raw `sub`.
    const info =
      payload?.sub && token && tenant
        ? await userInfoService.getUserInfo(tenant, token, payload.sub)
        : undefined;
    // Only authenticated users get a label; a nameless profile still shows
    // a placeholder, but anonymous/failed lookups render an empty slot.
    const user = info ? (info.name ?? info.email ?? "Bruker uten navn") : undefined;

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
