import { createHmac, timingSafeEqual } from "node:crypto";
import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";
import type { Context } from "hono";
import { jwtVerify, SignJWT } from "jose";
import { config, environment, type Environment } from "../config";
import { SporaiClient } from "./sporaiClient";

declare module "hono" {
  interface ContextVariableMap {
    /** The `sub` of the verified chat token. Only set on `/chat-proxy`. */
    chatUser: string;
  }
}

const CHAT_PROXY_URLS: Record<Environment, string> = {
  local: "http://localhost:4123/chat-proxy",
  dev: "https://uniformen.dev.entur.no/chat-proxy",
  staging: "https://uniformen.staging.entur.no/chat-proxy",
  production: "https://uniformen.entur.no/chat-proxy",
};

const CHAT_TOKEN_AUDIENCE = "uniformen-chat";
const CHAT_TOKEN_LIFETIME = "8h";

// The number of calls to sporai that one user can have open at the same time in one pod.
const MAX_ACTIVE_SPORAI_CALLS_PER_USER = 2;

// The number of questions that one user can send to sporai in 60 seconds in one pod.
const MAX_SPORAI_CALLS_PER_MINUTE_PER_USER = 10;
const RATE_WINDOW_MS = 60_000;

// The same pattern as sporai's. Sporai rejects any other `location` with a 400.
const LOCATION_PATTERN = /^[a-zA-Z0-9/_-]{0,100}$/;

export type ChatProxyConfig = { client: SporaiClient; key: Uint8Array; sessionKey: Uint8Array };

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
    // We ask for the first internal audience.
    audience: [internal.audience].flat()[0]!,
  });
  // The chat token key is made from the client secret, so no new secret is needed.
  // When the client secret changes, all chat tokens stop working.
  const key = createHmac("sha256", clientSecret).update("uniformen-chat-token").digest();
  // A separate key for session ids, so a signed session id can never pass as a chat
  // token.
  const sessionKey = createHmac("sha256", clientSecret).update("uniformen-chat-session").digest();
  return { client, key, sessionKey };
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
 * if not. Allows https on subdomains of entur.org, entur.io and entur.no. In local and
 * dev, it also allows http and https on localhost and 127.0.0.1, so an app on a
 * developer's machine can use the chat in dev. This is safe because every request
 * must have a valid chat token, and CORS does not allow cookies.
 */
export function allowedOrigin(origin: string, env: Environment): string | undefined {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return undefined;
  }
  if (
    (env === "local" || env === "dev") &&
    (url.protocol === "http:" || url.protocol === "https:") &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1")
  ) {
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

/**
 * Returns the session id that the browser gets: the sporai session id and a
 * signature, separated by a dot. Only `user` can use it.
 */
export function signSessionId(sessionKey: Uint8Array, user: string, sessionId: string): string {
  const signature = createHmac("sha256", sessionKey)
    .update(JSON.stringify([user, sessionId]))
    .digest("base64url");
  return `${sessionId}.${signature}`;
}

/**
 * Returns the sporai session id in `signed` if the signature is valid for `user`, or
 * `undefined` if not. This stops one user from using another user's session.
 */
function verifySessionId(sessionKey: Uint8Array, user: string, signed: string): string | undefined {
  const dot = signed.lastIndexOf(".");
  if (dot < 0) return undefined;
  const sessionId = signed.slice(0, dot);
  const given = Buffer.from(signed);
  const expected = Buffer.from(signSessionId(sessionKey, user, sessionId));
  // `timingSafeEqual` throws for buffers of different length, so check that first.
  return given.length === expected.length && timingSafeEqual(given, expected)
    ? sessionId
    : undefined;
}

/** Returns an RFC 9457 problem response with only `title` and `status`. */
function problem(c: Context, status: 400 | 404 | 413 | 429 | 503, title: string) {
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
            sessionId: z.string().max(200).optional().openapi({
              description:
                "The session from the previous reply. Leave it out to start a new chat. It only works for the user who started the chat.",
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
          schema: z.object({ reply: z.string(), sessionId: z.string() }),
        },
      },
      description: "The reply, and the session to send with the next question.",
    },
    400: problemResponse("The request body is not valid."),
    401: {
      content: { "text/plain": { schema: z.string() } },
      description: "The chat token is missing, invalid or expired.",
    },
    404: problemResponse(
      "The session belongs to another user, or sporai does not know it, for example because it expired.",
    ),
    413: problemResponse("The request body is larger than 8 KiB."),
    429: problemResponse(
      "The user has sent too many questions to sporai in the last minute (title `Too Many Requests`), or has too many questions open at the same time (title `Too Many Open Chats`). The `Retry-After` header says how many seconds to wait.",
    ),
    503: problemResponse("Sporai could not answer."),
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
  const { client, key, sessionKey } = proxyConfig;

  server.openAPIRegistry.registerComponent("securitySchemes", "ChatToken", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
  });

  // The number of open sporai calls for each user. The key is the `sub` of the chat token.
  const activeCallsPerUser = new Map<string, number>();

  // The times of each user's latest calls to sporai, from the last 60 seconds.
  // A user's entry is only cleaned up when that user sends a new question.
  const recentCallsPerUser = new Map<string, number[]>();

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
        const { payload } = await jwtVerify(token, key, {
          algorithms: ["HS256"],
          audience: CHAT_TOKEN_AUDIENCE,
          requiredClaims: ["sub"],
        });
        c.set("chatUser", payload.sub!);
      } catch {
        return c.text("Unauthorized", 401, { "WWW-Authenticate": 'Bearer error="invalid_token"' });
      }
      const user = c.get("chatUser");
      const active = activeCallsPerUser.get(user) ?? 0;
      if (active >= MAX_ACTIVE_SPORAI_CALLS_PER_USER) {
        c.header("Retry-After", "5");
        // The browser tells this apart from the rate limit by the title.
        return problem(c, 429, "Too Many Open Chats");
      }
      activeCallsPerUser.set(user, active + 1);
      try {
        return await next();
      } finally {
        // Remove the user at 0, so the map does not grow for the life of the pod.
        const callsLeft = activeCallsPerUser.get(user)! - 1;
        if (callsLeft === 0) activeCallsPerUser.delete(user);
        else activeCallsPerUser.set(user, callsLeft);
      }
    }),
  );

  server.openapi(
    chatProxyRoute,
    async (c) => {
      const { query, location, sessionId: signedSessionId } = c.req.valid("json");
      const user = c.get("chatUser");
      c.header("Cache-Control", "no-store");
      // Stop the call to sporai when the browser goes away.
      const signal = c.req.raw.signal;

      let sessionId: string | undefined;
      if (signedSessionId !== undefined) {
        // Stop here, before sporai is called, when the session belongs to another
        // user or the value has been changed.
        sessionId = verifySessionId(sessionKey, user, signedSessionId);
        if (!sessionId) return problem(c, 404, "Not Found");
      }

      // Only a question that will reach sporai counts, so the checks above do not use
      // up the user's calls.
      const now = Date.now();
      const recent = (recentCallsPerUser.get(user) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
      if (recent.length >= MAX_SPORAI_CALLS_PER_MINUTE_PER_USER) {
        recentCallsPerUser.set(user, recent);
        c.header("Retry-After", String(Math.ceil((recent[0]! + RATE_WINDOW_MS - now) / 1000)));
        return problem(c, 429, "Too Many Requests");
      }
      recentCallsPerUser.set(user, [...recent, now]);

      if (sessionId === undefined) {
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
      return c.json(
        { reply: result.reply, sessionId: signSessionId(sessionKey, user, sessionId) },
        200,
      );
    },
    // The shared app has no default hook, so the route sets its own answer for a body
    // that fails validation.
    (result, c) => {
      if (!result.success) return problem(c, 400, "Bad Request");
      return undefined;
    },
  );
}
