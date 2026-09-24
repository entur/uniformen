import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { isEnturOrganisation } from "../auth/enturOrganisation";
import { optionalAuth } from "../auth/optionalAuth";
import { userInfoService } from "../auth/userInfo";
import { renderUniformenStyleTag, uniformenCssHash } from "./uniformenStyles";
import { TopNavigation } from "./TopNavigation";
import { renderComponentToString } from "./renderComponentToString";
import { Footer } from "./Footer";
import { renderUniformenScripts, uniformenScriptsHash } from "./uniformenScripts";
import { renderUniformenHeadScript, uniformenHeadScriptHash } from "./uniformenHeadScript";
import { topNavigationProps, uniformenQuerySchema } from "./uniformenQuery";
import { ssrRequestMetric } from "../metrics";

const uniformenHeaderSchema = z.object({
  // Define any headers we want to validate here
});

// The name to show when the identity provider returns no name or email.
const texts = {
  "nb-NO": { brukerUtenNavn: "Bruker uten navn" },
  "nn-NO": { brukerUtenNavn: "Brukar utan namn" },
  "en-GB": { brukerUtenNavn: "User without a name" },
} as const;

// CSP sources per directive. The consumer merges them into its own CSP header.
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

  // Public endpoint. A valid Auth0 token is optional. It is only used to add the
  // user to the rendered header.
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
        headers: z.object({
          "Cache-Control": z.string().openapi({
            description:
              "private, no-store for a request carrying an Authorization header; " +
              "public, max-age=60 otherwise.",
          }),
          Vary: z.string().openapi({ description: "Authorization" }),
        }),
        description: "HTML for rendering header and footer server-side.",
      },
    },
  });

  server.openapi(rootRoute, async (ctx) => {
    const payload = ctx.get("jwtPayload");
    const token = ctx.get("authToken");
    const tenant = ctx.get("authTenant");
    // Get the user's profile from the tenant's userinfo endpoint (cached). If that
    // fails, render the anonymous header. Never show the raw `sub`.
    const info =
      payload?.sub && token && tenant
        ? await userInfoService.getUserInfo(tenant, token, payload.sub)
        : undefined;

    const query = ctx.req.valid("query");
    const navProps = topNavigationProps(query);
    // Only signed-in users get a user menu. If the profile has no name, show the
    // email instead, or a placeholder if there is no email either. The email is only
    // shown as a second line when there is a name, so it is not shown twice.
    const user = info
      ? {
          name: info.name ?? info.email ?? texts[navProps.locale].brukerUtenNavn,
          email: info.name ? info.email : undefined,
        }
      : undefined;

    ssrRequestMetric.inc({
      consumer_app: query?.app ?? "none",
      locale: query?.locale,
      authenticated: String(!!info),
    });

    // A response for a signed-in user contains the user's name, so no cache may
    // store it. Any request with an `Authorization` header is treated this way, even
    // if the token is invalid, so a personal response is never shared. Other
    // responses are the same for everyone, so caches may keep them for 60 seconds.
    // A layout change then reaches the consumers' pages within a minute. `Vary`
    // stops caches from mixing the two kinds of response.
    ctx.header("Vary", "Authorization");
    ctx.header(
      "Cache-Control",
      ctx.req.header("Authorization") ? "private, no-store" : "public, max-age=60",
    );

    return ctx.json(
      {
        headAssets: `${renderUniformenStyleTag()}${renderUniformenHeadScript()}`,
        // Put `user` and `isEnturUser` after `navProps` so the query cannot override
        // them. They must come from the verified token, never from the URL.
        headerHtml: await renderComponentToString(
          <TopNavigation {...navProps} user={user} isEnturUser={isEnturOrganisation(info)} />,
        ),
        footerHtml: await renderComponentToString(<Footer locale={navProps.locale} />),
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
