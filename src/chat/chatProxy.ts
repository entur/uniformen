import { createHmac } from "node:crypto";
import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";
import type { Context } from "hono";
import { jwtVerify, SignJWT } from "jose";
import { config, environment, type Environment } from "../config";
import { SporaiClient } from "./sporaiClient";

const CHAT_PROXY_URLS: Record<Environment, string> = {
  local: "http://localhost:4123/chat-proxy",
  dev: "https://uniformen.dev.entur.no/chat-proxy",
  staging: "https://uniformen.staging.entur.no/chat-proxy",
  production: "https://uniformen.entur.no/chat-proxy",
};

const CHAT_TOKEN_AUDIENCE = "uniformen-chat";
const CHAT_TOKEN_LIFETIME = "60m";
// The number of calls to sporai that one pod runs at the same time. A slow sporai
// must not use up the connections that `/ssr` also needs.
const MAX_ACTIVE_SPORAI_CALLS = 10;
// The same pattern as sporai's. Sporai rejects any other `location` with a 400.
const LOCATION_PATTERN = /^[a-zA-Z0-9/_-]{0,100}$/;

export type ChatProxyConfig = { client: SporaiClient; key: Uint8Array };

/** The chat proxy URL that the browser sends questions to, and the token it sends with them. */
export type ChatAccessToken = { url: string; token: string };

/**
 * Reads the chat settings from the environment. Returns `undefined`, and logs
 * which variables are missing, when chat cannot run. It never throws, so a
 * missing setting turns chat off instead of stopping the pod.
 */
export function loadChatProxyConfig(
  env: Record<string, string | undefined> = process.env,
): ChatProxyConfig | undefined {
  const names = [
    "SPORAI_URL",
    "AUTH0_INTERNAL_TOKEN_URI",
    "MNG_AUTH0_INT_CLIENT_ID",
    "MNG_AUTH0_INT_CLIENT_SECRET",
  ] as const;
  const missing = names.filter((name) => !env[name]);
  if (missing.length > 0) {
    console.warn(`Chat is off. Missing env vars: ${missing.join(", ")}`);
    return undefined;
  }
  const clientSecret = env["MNG_AUTH0_INT_CLIENT_SECRET"]!;
  const internal = config.tenants.find((tenant) => tenant.name === "internal")!;
  const client = new SporaiClient({
    baseUrl: env["SPORAI_URL"]!,
    tokenUri: env["AUTH0_INTERNAL_TOKEN_URI"]!,
    clientId: env["MNG_AUTH0_INT_CLIENT_ID"]!,
    clientSecret,
    // Sporai accepts any token from the internal tenant and does not check the
    // audience. We ask for the first internal audience.
    audience: [internal.audience].flat()[0]!,
  });
  // The chat token key is made from the client secret, so no new secret is needed.
  // When the client secret changes, all chat tokens stop working.
  const key = createHmac("sha256", clientSecret).update("uniformen-chat-token").digest();
  return { client, key };
}

/** The chat settings for this process, or `undefined` when chat is off. */
export const chatProxyConfig = loadChatProxyConfig();

/**
 * Returns a chat token for a signed-in user and the URL the browser sends questions
 * to, or `undefined` when chat is off. `user` must identify a verified user, for
 * example `tenant|sub`. It is the token's `sub`, so only signed-in users can chat.
 */
export async function issueChatToken(
  proxyConfig: ChatProxyConfig | undefined,
  user: string,
): Promise<ChatAccessToken | undefined> {
  if (!proxyConfig) return undefined;
  const token = await new SignJWT()
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user)
    .setAudience(CHAT_TOKEN_AUDIENCE)
    .setExpirationTime(CHAT_TOKEN_LIFETIME)
    .sign(proxyConfig.key);
  return { token, url: CHAT_PROXY_URLS[environment] };
}

/**
 * Returns `origin` if a browser on that origin may call `/chat-proxy`, or `undefined`
 * if not. Allows https on Entur's domains, and localhost only in local
 * development.
 */
export function allowedOrigin(origin: string, env: Environment): string | undefined {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return undefined;
  }
  if (env === "local" && url.protocol === "http:" && url.hostname === "localhost") {
    return origin;
  }
  // The leading dot stops a host like `evilentur.org` from matching.
  const entur = [".entur.org", ".entur.io", ".entur.no"].some((suffix) =>
    url.hostname.endsWith(suffix),
  );
  return url.protocol === "https:" && entur ? origin : undefined;
}

const problemResponse = (description: string) => ({
  content: {
    "application/problem+json": {
      schema: z.object({ title: z.string(), status: z.number() }),
    },
  },
  description,
});

/** Returns an RFC 9457 problem response with only `title` and `status`. */
function problem(c: Context, status: 400 | 404 | 413 | 503, title: string) {
  return c.json({ title, status }, status, { "Content-Type": "application/problem+json" });
}

const chatProxyRoute = createRoute({
  method: "post",
  path: "/chat-proxy",
  security: [{ ChatToken: [] }],
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({
            query: z.string().trim().min(1).max(1000).openapi({
              description: "The user's question.",
            }),
            sessionId: z.uuid().optional().openapi({
              description: "The session from the previous reply. Leave it out to start a new chat.",
            }),
            location: z.string().optional().openapi({
              description: "The path of the page the user is on.",
            }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ 
            reply: z.string(),
            sessionId: z.string() 
          }),
        },
      },
      description: "The reply, and the session to send with the next question.",
    },
    400: problemResponse("The request body is not valid."),
    401: {
      content: { "text/plain": { schema: z.string() } },
      description: "The chat token is missing, invalid or expired.",
    },
    404: problemResponse("Sporai did not recognise the chat session, even after the proxy started a new one."),
    413: problemResponse("The request body is larger than 8 KiB."),
    503: problemResponse("Sporai could not answer, or too many questions are open right now."),
  },
});

/**
 * Adds `POST /chat-proxy`, which sends a question to sporai and returns the reply.
 * Does nothing when chat is off.
 */
export function chatProxyRoutes(
  server: OpenAPIHono,
  proxyConfig: ChatProxyConfig | undefined,
  env: Environment,
): void {
  if (!proxyConfig) return;
  const { client, key } = proxyConfig;

  server.openAPIRegistry.registerComponent("securitySchemes", "ChatToken", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
  });

  let activeSporaiCalls = 0;

  server.use(
    "/chat-proxy",
    // Put CORS first, so every response, also an error, has the CORS headers.
    // Without them, the browser hides the status from the page.
    cors({
      origin: (origin) => allowedOrigin(origin, env),
      allowMethods: ["POST"],
      allowHeaders: ["Authorization", "Content-Type"],
      maxAge: 600,
    }),
    bodyLimit({
      maxSize: 8 * 1024,
      onError: (c) => problem(c, 413, "Payload Too Large"),
    }),
    createMiddleware(async (c, next) => {
      const token = /^Bearer (\S+)$/i.exec(c.req.header("Authorization") ?? "")?.[1];
      try {
        if (!token) throw new Error("no token");
        await jwtVerify(token, key, {
          algorithms: ["HS256"],
          audience: CHAT_TOKEN_AUDIENCE,
          requiredClaims: ["sub"],
        });
      } catch {
        return c.text("Unauthorized", 401, { "WWW-Authenticate": 'Bearer error="invalid_token"' });
      }
      if (activeSporaiCalls >= MAX_ACTIVE_SPORAI_CALLS) {
        c.header("Retry-After", "5");
        return problem(c, 503, "Service Unavailable");
      }
      activeSporaiCalls++;
      try {
        return await next();
      } finally {
        activeSporaiCalls--;
      }
    }),
  );

  server.openapi(
    chatProxyRoute,
    async (c) => {
      const { query, location, sessionId: requestSessionId } = c.req.valid("json");
      c.header("Cache-Control", "no-store");
      // Stop the call to sporai when the browser goes away.
      const signal = c.req.raw.signal;

      let sessionId = requestSessionId;
      if (!sessionId) {
        const created = await client.createSession(signal);
        if (created.kind !== "ok") return problem(c, 503, "Service Unavailable");
        sessionId = created.sessionId;
      }

      const result = await client.chat(
        {
          sessionId,
          query,
          // Leave out a location that sporai would reject, so the question still gets a reply.
          location:
            location !== undefined && LOCATION_PATTERN.test(location) ? location : undefined,
        },
        signal,
      );
      if (result.kind === "sessionGone") return problem(c, 404, "Not Found");
      if (result.kind === "error") return problem(c, 503, "Service Unavailable");
      return c.json({ reply: result.reply, sessionId }, 200);
    },
    // The shared app has no default hook, so the route sets its own answer for a body
    // that fails validation.
    (result, c) => {
      if (!result.success) return problem(c, 400, "Bad Request");
      return undefined;
    },
  );
}
