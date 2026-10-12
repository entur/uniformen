import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { chatProxyConfig, issueChatToken } from "../chat/chatProxy";
import { isEnturOrganisation } from "../auth/enturOrganisation";
import { optionalAuth } from "../auth/optionalAuth";
import { type UserInfo, userInfoService } from "../auth/userInfo";
import { renderUniformenStyleTag, uniformenCssHash } from "./uniformenStyles";
import { TopNavigation } from "./TopNavigation";
import { renderComponentToString } from "./renderComponentToString";
import { Footer } from "./Footer";
import { renderUniformenScripts, uniformenScriptsHash } from "./uniformenScripts";
import { renderUniformenHeadScript, uniformenHeadScriptHash } from "./uniformenHeadScript";
import { topNavigationProps, uniformenQuerySchema } from "./uniformenQuery";
import { clientVersionLabel, ssrRequestMetric } from "../metrics";
import { PostHog } from "posthog-node";

// Without POSTHOG_API_KEY, the AI agent feature flag is off for everyone.
const posthogApiKey = process.env["POSTHOG_API_KEY"];
if (!posthogApiKey) console.warn("AI agent flag is off. POSTHOG_API_KEY is not set.");
const posthog = posthogApiKey
  ? new PostHog(posthogApiKey, {
      host: "https://eu.i.posthog.com",
      featureFlagsRequestMaxRetries: 0,
      featureFlagsRequestTimeoutMs: 200,
    })
  : undefined;

const FLAG_CACHE_MS = 60_000;
const FLAG_CACHE_MAX_ENTRIES = 5000;

export const aiAgentFlag = {
  /** Only changed by tests. */
  client: posthog as Pick<PostHog, "getFeatureFlagResult"> | undefined,
  /** The longest time a response waits for PostHog. Only changed by tests. */
  timeoutMs: 200,
  /** The flag per user `sub`. A failed request is stored as off. */
  cache: new Map<string, { on: boolean; expiresAt: number }>(),
  /** Flag requests that are running now, per user `sub`. */
  inFlight: new Map<string, Promise<boolean>>(),

  /**
   * Checks whether the `ai-agent` feature flag in PostHog is on for the user.
   * Returns false for an anonymous user and when PostHog is slow or fails. A user
   * has at most one request to PostHog at a time, and a failed request is not
   * repeated until the cached result expires.
   */
  async isOn(info: UserInfo | undefined): Promise<boolean> {
    if (!this.client || !info) return false;
    const sub = info.sub;
    const cached = this.cache.get(sub);
    if (cached && cached.expiresAt > Date.now()) return cached.on;
    const running = this.inFlight.get(sub);
    if (running) return running;

    // The SDK has its own timeout. The race is a second limit in case the SDK does
    // not stop in time.
    const request = Promise.race([
      this.client
        .getFeatureFlagResult("ai-agent", sub, {
          // The flag picks users by email. Only send a verified email, because anyone
          // can sign up with an address that belongs to someone else.
          personProperties: info.email_verified === true && info.email ? { email: info.email } : {},
          sendFeatureFlagEvents: false,
        })
        .catch(() => undefined),
      Bun.sleep(this.timeoutMs).then(() => undefined),
    ])
      .then((result) => {
        // The SDK returns undefined when the request fails or the flag does not exist.
        if (result === undefined) console.warn("AI agent flag check failed or timed out.");
        const on = result?.enabled ?? false;
        // `Map` keeps keys in insertion order, so the first key is the oldest entry.
        if (this.cache.size >= FLAG_CACHE_MAX_ENTRIES && !this.cache.has(sub)) {
          const oldest = this.cache.keys().next().value;
          if (oldest !== undefined) this.cache.delete(oldest);
        }
        this.cache.set(sub, { on, expiresAt: Date.now() + FLAG_CACHE_MS });
        return on;
      })
      .finally(() => this.inFlight.delete(sub));
    this.inFlight.set(sub, request);
    return request;
  },
};

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

    // PostHog is only called when the app asks for the agent.
    const aiAgent = navProps.aiAgent && (await aiAgentFlag.isOn(info));

    // Only a user with a profile gets a chat token. This keeps machine tokens out,
    // but it also means a signed-in user has no chat while userinfo fails. Without
    // a token, the drawer shows the error text for every question.
    const chatAccessToken =
      info && tenant && payload?.sub && aiAgent
        ? await issueChatToken(chatProxyConfig, `${tenant}|${payload.sub}`)
        : undefined;

    ssrRequestMetric.inc({
      consumer_app: query?.app ?? "none",
      locale: query?.locale,
      authenticated: String(!!info),
      client_version: clientVersionLabel(ctx.req.header("X-Uniformen-Client")),
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
        // Put `user`, `isEnturUser` and `aiAgent` after `navProps` so the query cannot
        // override them. They depend on the verified token, never only on the URL.
        headerHtml: await renderComponentToString(
          <TopNavigation
            {...navProps}
            user={user}
            isEnturUser={isEnturOrganisation(info)}
            aiAgent={aiAgent}
            chatAccessToken={chatAccessToken}
          />,
        ),
        footerHtml: await renderComponentToString(<Footer contrast={navProps.contrast} />),
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
