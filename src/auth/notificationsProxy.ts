import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";
import {
  allowedOrigin,
  createBrowserToken,
  getBearerTokenFromRequest,
  verifyBrowserToken,
} from "./browserTokens";
import { HTTPException } from "hono/http-exception";
import { config } from "../config";
import { createHmac } from "crypto";
import { Hono } from "hono";
import { type OpenAPIHono } from "@hono/zod-openapi";
import { machineToken, type MachineTokenProvider } from "./machineToken";

const NOTIFICATION_PROXY_AUDIENCE = "uniformen-notification-proxy";
const NOTIFICATION_PROXY_TOKEN_LIFETIME = "1h";
export const MESSAGES_PATH = "/v1/messages";
const DELETE_TIMEOUT_MS = 5_000;

// A key of our own, derived from the client secret, so a token for this route cannot
// be used anywhere else that signs tokens with the secret itself. It is exported
// only for the tests. It is `undefined` when the machine user is not configured.
export const NOTIFICATION_PROXY_KEY = config.machineUser
  ? createHmac("sha256", config.machineUser.clientSecret)
      .update("uniformen-notification-proxy")
      .digest()
  : undefined;

/**
 * Makes a token that lets the browser delete one notification. The route does not
 * check who sends the token, so anyone who has it can delete that notification until
 * the token expires. It is only put in the markup that is rendered for the user who
 * received the notification. Returns `undefined` when the machine user is not
 * configured, because then nothing can delete the notification.
 */
export async function createReadNotificationToken(
  sub: string,
  messageId: string | number,
): Promise<string | undefined> {
  if (!NOTIFICATION_PROXY_KEY) return undefined;
  return createBrowserToken({
    key: NOTIFICATION_PROXY_KEY,
    audience: NOTIFICATION_PROXY_AUDIENCE,
    lifetime: NOTIFICATION_PROXY_TOKEN_LIFETIME,
    sub,
    payload: { messageId: String(messageId) },
  });
}

type ProxyPayload = { messageId: string };

export function notificationsProxyRoute(server: OpenAPIHono): void {
  const key = NOTIFICATION_PROXY_KEY;
  const tokens = machineToken;
  if (!key || !tokens) return;

  const proxy = new Hono<{ Variables: ProxyPayload }>();

  proxy.use(
    "/notifications-proxy",
    cors({
      origin: (origin) => allowedOrigin(origin),
      allowMethods: ["POST"],
      allowHeaders: ["Authorization", "Content-Type"],
      maxAge: 600,
    }),
    createMiddleware(async (ctx, next) => {
      const token = getBearerTokenFromRequest(ctx.req);
      if (!token) {
        throw new HTTPException(401, { message: "Missing token" });
      }

      let messageId: string;
      try {
        ({ messageId } = await verifyBrowserToken<ProxyPayload>(token, {
          key,
          audience: NOTIFICATION_PROXY_AUDIENCE,
          requiredPayloadProperties: ["messageId"],
        }));
      } catch {
        // Do not log the token. It is a credential.
        throw new HTTPException(401, { message: "Invalid token" });
      }

      // We made this token, but the id goes into a URL, so check it is only digits.
      if (!/^\d+$/.test(messageId)) {
        throw new HTTPException(401, { message: "Invalid token" });
      }

      ctx.set("messageId", messageId);
      return await next();
    }),
  );

  proxy.post("/notifications-proxy", async (ctx) => {
    const deleted = await deleteNotification(tokens, ctx.get("messageId"));
    if (!deleted) {
      // Do not pass the notification center's response on to the browser.
      throw new HTTPException(502, { message: "Could not delete the notification" });
    }
    return ctx.body(null, 204);
  });

  server.route("/", proxy);
}

/**
 * Deletes one notification in the notification center. Returns whether it worked.
 *
 * This uses uniformen's machine user, because the browser has no access token by the
 * time someone clicks. The caller has already checked that the request has a valid
 * token for this notification.
 */
async function deleteNotification(
  provider: MachineTokenProvider,
  messageId: string,
): Promise<boolean> {
  const token = await provider.getToken();
  if (!token) return false;

  try {
    const response = await fetch(`${config.notificationApiBaseUri}${MESSAGES_PATH}/${messageId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(DELETE_TIMEOUT_MS),
    });

    // A 401 means the token is no longer accepted, so throw it away and get a new
    // one next time. A 403 means the machine user is missing a permission, and a new
    // token would be refused in the same way.
    if (response.status === 401) provider.clear();

    if (!response.ok) {
      console.warn(`notification delete failed: HTTP ${response.status}`);
      return false;
    }
    return true;
  } catch (error) {
    console.warn("notification delete failed:", error);
    return false;
  }
}
