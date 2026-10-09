import { createHmac } from "node:crypto";
import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";
import { jwtVerify, SignJWT } from "jose";
import { config, environment, type Environment } from "../config";
import { SporaiClient } from "./sporaiClient";

const PUBLIC_URLS: Record<Environment, string> = {
  local: "http://localhost:4123",
  dev: "https://uniformen.dev.entur.no",
  staging: "https://uniformen.staging.entur.no",
  production: "https://uniformen.entur.no",
};

const CHAT_TOKEN_AUDIENCE = "uniformen-chat";
const CHAT_TOKEN_LIFETIME = "60m";
// The number of calls to sporai that one pod runs at the same time. A slow sporai
// must not use up the connections that `/ssr` also needs.
const MAX_IN_FLIGHT = 10;
// Sporai rejects any other `location` with a 400.
const PAGE_PATTERN = /^[a-zA-Z0-9/_-]{0,100}$/;

export type Chat = { client: SporaiClient; key: Uint8Array };

/**
 * Reads the chat settings from the environment. Returns `undefined`, and logs
 * which variables are missing, when chat cannot run. It never throws, so a
 * missing setting turns chat off instead of stopping the pod.
 */
export function loadChat(env: Record<string, string | undefined> = process.env): Chat | undefined {
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
    sporaiUrl: env["SPORAI_URL"]!,
    tokenUri: env["AUTH0_INTERNAL_TOKEN_URI"]!,
    clientId: env["MNG_AUTH0_INT_CLIENT_ID"]!,
    clientSecret,
    // Sporai accepts the internal API audience, which is the first one in the list.
    audience: [internal.audience].flat()[0]!,
  });
  // ponytail: the chat token key is made from the client secret, so no new secret
  // is needed. Use a separate secret if chat tokens must survive a rotation of the
  // client secret.
  const key = createHmac("sha256", clientSecret).update("uniformen-chat-token").digest();
  return { client, key };
}

/** The chat settings for this process, or `undefined` when chat is off. */
export const chat = loadChat();

/**
 * Returns a chat token for a signed-in user and the URL the browser sends questions
 * to, or `undefined` when chat is off. `user` must identify a verified user, for
 * example `tenant|sub`. It is the token's `sub`, so only signed-in users can chat.
 */
export async function issueChatToken(
  current: Chat | undefined,
  user: string,
): Promise<{ token: string; url: string } | undefined> {
  if (!current) return undefined;
  const token = await new SignJWT()
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user)
    .setAudience(CHAT_TOKEN_AUDIENCE)
    .setExpirationTime(CHAT_TOKEN_LIFETIME)
    .sign(current.key);
  return { token, url: `${PUBLIC_URLS[environment]}/chat` };
}

/**
 * Returns `origin` if a browser on that origin may call `/chat`, or `undefined`
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

const errorSchema = z.object({ error: z.string() });
const errorResponse = (description: string) => ({
  content: { "application/json": { schema: errorSchema } },
  description,
});

const chatRoute = createRoute({
  method: "post",
  path: "/chat",
  security: [{ ChatToken: [] }],
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({
            text: z.string().trim().min(1).max(1000),
            /** The session from the previous answer. Leave it out to start a new chat. */
            session: z.uuid().optional(),
            /** The path of the page the user is on. */
            page: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: z.object({ reply: z.string(), session: z.string() }) },
      },
      description: "The answer, and the session to send with the next question.",
    },
    400: errorResponse("The request body is not valid."),
    401: errorResponse("The chat token is missing, invalid or expired."),
    410: errorResponse("The chat session has expired. Start a new chat."),
    502: errorResponse("Sporai could not answer."),
    503: errorResponse("Too many questions are being answered right now."),
    504: errorResponse("Sporai took too long to answer."),
  },
});

/**
 * Adds `POST /chat`, which sends a question to sporai and returns the answer. Does
 * nothing when chat is off.
 */
export function chatRoutes(server: OpenAPIHono, current: Chat | undefined, env: Environment): void {
  if (!current) return;
  const { client, key } = current;

  server.openAPIRegistry.registerComponent("securitySchemes", "ChatToken", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
  });

  let inFlight = 0;

  server.use(
    "/chat",
    // Put CORS first, so every response, also an error, has the CORS headers.
    // Without them, the browser hides the status from the page.
    cors({
      origin: (origin) => allowedOrigin(origin, env),
      allowMethods: ["POST"],
      allowHeaders: ["Authorization", "Content-Type"],
      maxAge: 600,
    }),
    bodyLimit({ maxSize: 8 * 1024 }),
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
        return c.json({ error: "Expired" }, 401);
      }
      if (inFlight >= MAX_IN_FLIGHT) {
        c.header("Retry-After", "5");
        return c.json({ error: "Unavailable" }, 503);
      }
      inFlight++;
      try {
        return await next();
      } finally {
        inFlight--;
      }
    }),
  );

  server.openapi(
    chatRoute,
    async (c) => {
      const { text, session, page } = c.req.valid("json");
      c.header("Cache-Control", "no-store");
      // Stop the call to sporai when the browser goes away.
      const signal = c.req.raw.signal;

      let sessionId = session;
      if (!sessionId) {
        const created = await client.createSession(signal);
        if (created.kind !== "ok") return c.json({ error: "Unavailable" }, created.status);
        sessionId = created.sessionId;
      }

      const result = await client.chat(
        {
          sessionId,
          query: text,
          // Leave out a page that sporai would reject, so the question still gets an answer.
          location: page !== undefined && PAGE_PATTERN.test(page) ? page : undefined,
        },
        signal,
      );
      if (result.kind === "sessionGone") return c.json({ error: "SessionExpired" }, 410);
      if (result.kind === "error") return c.json({ error: "Unavailable" }, result.status);
      return c.json({ reply: result.reply, session: sessionId }, 200);
    },
    // The shared app has no default hook, so the route sets its own answer for a body
    // that fails validation.
    (result, c) => {
      if (!result.success) return c.json({ error: "Invalid" }, 400);
      return undefined;
    },
  );
}
