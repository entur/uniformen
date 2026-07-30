import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { optionalAuth } from "../auth/optionalAuth";
import { userInfoService } from "../auth/userInfo";
import { renderUniformenStyleTag, uniformenCssHash } from "./uniformenStyles";
import { TopNavigation } from "./TopNavigation";
import { renderComponentToString } from "./renderComponentToString";
import { Footer } from "./Footer";
import { renderUniformenScripts, uniformenScriptsHash } from "./uniformenScripts";
import { renderUniformenHeadScript, uniformenHeadScriptHash } from "./uniformenHeadScript";
import { topNavigationProps, uniformenQuerySchema } from "./uniformenQuery";

const uniformenHeaderSchema = z.object({
  // Define any headers we want to validate here
});

// Per-directive CSP sources the consumer unions into its own page CSP header.
const cspContributionSchema = z.record(z.string(), z.array(z.string()));

const uniformenBodySchema = z.object({
  headAssets: z.string(),
  headerHtml: z.string(),
  footerHtml: z.string(),
  scripts: z.string(),
  csp: cspContributionSchema,
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
    const payload = ctx.get("jwtPayload");
    const token = ctx.get("authToken");
    const tenant = ctx.get("authTenant");
    // Resolve userinfo via the tenant's userinfo endpoint (cached); on
    // failure render anonymously — never the raw `sub`.
    const info =
      payload?.sub && token && tenant
        ? await userInfoService.getUserInfo(tenant, token, payload.sub)
        : undefined;
    // Only authenticated users get a menu; a nameless profile still shows a
    // placeholder, but anonymous/failed lookups render an empty slot. The email is
    // the menu's second line, and only when there is a name for it to sit under —
    // a profile labelled by its email does not repeat it underneath.
    const user = info
      ? {
          name: info.name ?? info.email ?? "Bruker uten navn",
          email: info.name ? info.email : undefined,
        }
      : undefined;
    const navProps = topNavigationProps(ctx.req.valid("query"));

    return ctx.json(
      {
        headAssets: `${renderUniformenStyleTag()}${renderUniformenHeadScript()}`,
        // `user` last: `navProps` is the query's half of the props, and who is
        // signed in is the token's to say, never a URL's.
        headerHtml: await renderComponentToString(<TopNavigation {...navProps} user={user} />),
        footerHtml: await renderComponentToString(<Footer />),
        scripts: renderUniformenScripts(),
        csp: {
          "style-src": [uniformenCssHash],
          "script-src": [uniformenHeadScriptHash, uniformenScriptsHash],
        },
      },
      200,
    );
  });
}
