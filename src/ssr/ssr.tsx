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

// The label for a profile the identity provider gave no name for.
const texts = {
  "nb-NO": { brukerUtenNavn: "Bruker uten navn" },
  "nn-NO": { brukerUtenNavn: "Brukar utan namn" },
  "en-GB": { brukerUtenNavn: "User without a name" },
} as const;

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
    // Resolve userinfo via the tenant's userinfo endpoint (cached); on
    // failure render anonymously — never the raw `sub`.
    const info =
      payload?.sub && token && tenant
        ? await userInfoService.getUserInfo(tenant, token, payload.sub)
        : undefined;

    const query = ctx.req.valid("query");
    const navProps = topNavigationProps(query);
    // Only authenticated users get a menu; a nameless profile still shows a
    // placeholder, but anonymous/failed lookups render an empty slot. The email is
    // the menu's second line, and only when there is a name for it to sit under —
    // a profile labelled by its email does not repeat it underneath.
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

    // Who is signed in is in the body, so an authenticated render is nobody's to
    // store: the bar names the user. Anything carrying an `Authorization` header
    // counts as authenticated, whether or not the token verified — a response a
    // caller could read as personal never becomes a shared one. Everything else is
    // the same answer for every caller asking the same question, so it is
    // cacheable, briefly: the layout changes without a consumer release, and this
    // is the ceiling on how long a change takes to reach their pages. `Vary` keeps
    // the two apart in whatever caches in between.
    ctx.header("Vary", "Authorization");
    ctx.header(
      "Cache-Control",
      ctx.req.header("Authorization") ? "private, no-store" : "public, max-age=60",
    );

    return ctx.json(
      {
        headAssets: `${renderUniformenStyleTag()}${renderUniformenHeadScript()}`,
        // Token-derived props last: `navProps` is the query's half, and who is
        // signed in — and what organisation they are in — is the token's to say,
        // never a URL's.
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
