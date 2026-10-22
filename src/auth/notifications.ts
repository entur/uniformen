import { config, type AuthTenant } from "../config";
import { CachedLookup } from "./cachedLookup";
import type { Notifications } from "../types";
import { createReadNotificationToken, MESSAGES_PATH } from "./notificationsProxy";

/** One notification text in one language. `language` is an ISO 639-3 code, e.g. "nob". */
export type LocalisedMessage = {
  language: string;
  title: string;
  body: string;
};

/**
 * One notification from the notification center.
 *
 * `service`, `type` and `variant` are plain strings, not unions, because the API
 * can add new values without us changing this file. Values seen so far are
 * `service: "PERMISSION_ADMIN"`, `type: "ROLE_REQUEST"` and
 * `variant: "INFORMATION"`.
 */
export type NotificationResponseItem = {
  id: number;
  /** The id of the thing the notification is about. The API can leave it out. */
  referenceId: string | null;
  /** When the notification was created, as an ISO 8601 timestamp. */
  created: string;
  /** The Auth0 tenant the user belongs to, e.g. "partner". */
  authority: string;
  /** The user's `sub` claim. */
  subject: string;
  service: string;
  type: string;
  variant: string;
  messages: LocalisedMessage[];
};

/** What the notification center returns: the user's notifications, newest first. */
export type NotificationResponse = NotificationResponseItem[];

export type NotificationService = {
  /**
   * Fetches the signed-in user's notifications. Returns `undefined` on any
   * failure and never throws, so callers can render the bar without a try/catch.
   * `items` holds at most the five newest notifications, and `totalCount` counts
   * all of them. A user with no notifications gets an empty `items` and a
   * `totalCount` of 0, which is different from a failed lookup.
   */
  getNotifications(
    tenantName: AuthTenant["name"],
    token: string,
    sub: string,
  ): Promise<Notifications | undefined>;
};

export type NotificationServiceOptions = {
  /** How long a successful fetch is cached. Default 5 seconds. */
  positiveTtlMs?: number;
  /** How long a failed lookup is cached. Default 30 seconds. */
  negativeTtlMs?: number;
  /** Timeout for the request. Default 5 seconds. */
  timeoutMs?: number;
  /** Maximum number of cached users. When the cache is full, the oldest entry is removed. Default 5000. */
  maxEntries?: number;
};

/**
 * Fetches notifications and caches them in memory.
 *
 * The cache key is `tenant|sub`, the same as for userinfo. There is one endpoint
 * for both tenants, and the API reads the user from the access token, so the
 * tenant and `sub` are only used for the key. The times to live are much shorter
 * than for userinfo, because a notification list goes out of date quickly.
 *
 * Deleting a notification does not clear this cache. Each instance of uniformen has
 * its own cache, so the instance that handles the delete cannot clear the others.
 * The bar can show a deleted notification for up to 5 seconds.
 */
export class NotificationServiceImpl implements NotificationService {
  private readonly notificationMessagesUri: string;
  private readonly timeoutMs: number;
  private readonly cache: CachedLookup<NotificationResponse>;

  /** `apiBaseUri` is the notification center without a path, e.g. `https://api.dev.entur.io/notification-center`. */
  constructor(apiBaseUri: string, options: NotificationServiceOptions = {}) {
    this.notificationMessagesUri = apiBaseUri + MESSAGES_PATH;
    this.timeoutMs = options.timeoutMs ?? 1_000;
    this.cache = new CachedLookup({
      positiveTtlMs: options.positiveTtlMs ?? 5_000,
      negativeTtlMs: options.negativeTtlMs ?? 30_000,
      maxEntries: options.maxEntries ?? 5_000,
    });
  }

  async getNotifications(
    tenantName: AuthTenant["name"],
    token: string,
    sub: string,
  ): Promise<Notifications | undefined> {
    if (!token) return undefined;

    const response = await this.cache.get(`${tenantName}|${sub}`, () =>
      this.fetchNotifications(token),
    );

    return transformNotificationResponse(response, sub);
  }

  private async fetchNotifications(token: string): Promise<NotificationResponse | undefined> {
    try {
      const res = await fetch(this.notificationMessagesUri, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) {
        console.warn(`notifications fetch failed: HTTP ${res.status}`);
        return undefined;
      }
      const body = await res.json();
      if (!Array.isArray(body)) {
        console.warn("notifications fetch failed: response was not an array");
        return undefined;
      }
      return body as NotificationResponse;
    } catch (error) {
      // Timeout, network error or invalid JSON. The caller renders without notifications.
      console.warn("notifications fetch failed:", error);
      return undefined;
    }
  }
}

/**
 * The notification service for the configured API. Call `getNotifications` with
 * the values that `validateJwt` sets on the context: `authTenant`, `authToken`
 * and `jwtPayload.sub`.
 */
export const notificationService: NotificationService = new NotificationServiceImpl(
  config.notificationApiBaseUri,
);

/**
 * Transform raw Notification response to Notifactions type.
 * Temporary till Notification Service has been rewritten
 *
 */
async function transformNotificationResponse(
  response: NotificationResponse | undefined,
  sub: string,
): Promise<Notifications | undefined> {
  try {
    if (!response) return undefined;
    const filteredItems = response.filter((r) => Array.isArray(r?.messages) && r.messages[0]);

    const notifications = await Promise.all(
      filteredItems.slice(0, 5).map(async (item) => ({
        referenceId: item.referenceId,
        date: item.created,
        message: item.messages[0]!.body,
        markAsReadToken: await createReadNotificationToken(sub, item.id),
      })),
    );
    return { items: notifications, totalCount: filteredItems.length };
  } catch {
    return undefined;
  }
}
