import { afterEach, beforeEach, describe, expect, setSystemTime, test } from "bun:test";
import { machineTokenMock, notificationDeleteMock } from "../test/authTestSetup";
import { app } from "../index";
import { createBrowserToken } from "./browserTokens";
import { createReadNotificationToken, NOTIFICATION_PROXY_KEY } from "./notificationsProxy";
import { machineToken } from "./machineToken";

const ENTUR_ORIGIN = "https://app.dev.entur.no";

const post = (headers: Record<string, string> = {}) =>
  app.request("/notifications-proxy", { method: "POST", headers });

const withToken = async (sub: string, messageId: string | number) =>
  post({ Authorization: `Bearer ${await createReadNotificationToken(sub, messageId)}` });

beforeEach(() => {
  machineTokenMock.reset();
  notificationDeleteMock.reset();
  // The provider is shared by the whole process, so drop its token between tests.
  machineToken?.clear();
});
afterEach(() => setSystemTime());

describe("the token", () => {
  test("is required", async () => {
    expect((await post()).status).toBe(401);
  });

  test("must be a Bearer token, not an empty one", async () => {
    expect((await post({ Authorization: "Bearer " })).status).toBe(401);
  });

  test("from another key is rejected", async () => {
    const forged = await createBrowserToken({
      key: new Uint8Array(32),
      audience: "uniformen-notification-proxy",
      lifetime: "1h",
      sub: "auth0|test",
      payload: { messageId: "42" },
    });

    expect((await post({ Authorization: `Bearer ${forged}` })).status).toBe(401);
  });

  test("for another audience is rejected", async () => {
    const other = await createBrowserToken({
      key: NOTIFICATION_PROXY_KEY!,
      audience: "uniformen-something-else",
      lifetime: "1h",
      sub: "auth0|test",
      payload: { messageId: "42" },
    });

    expect((await post({ Authorization: `Bearer ${other}` })).status).toBe(401);
  });

  test("expires after 1 hour", async () => {
    setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const token = await createReadNotificationToken("auth0|test", 42);

    setSystemTime(new Date("2026-01-01T01:05:00Z"));
    const res = await post({ Authorization: `Bearer ${token}` });

    expect(res.status).toBe(401);
  });

  test("without a message id is rejected", async () => {
    const noId = await createBrowserToken({
      key: NOTIFICATION_PROXY_KEY!,
      audience: "uniformen-notification-proxy",
      lifetime: "1h",
      sub: "auth0|test",
    });

    expect((await post({ Authorization: `Bearer ${noId}` })).status).toBe(401);
  });
});

describe("the message id", () => {
  test("is rejected when it is not a number, and nothing is deleted", async () => {
    const res = await withToken("auth0|test", "../../v1/users/1");

    expect(res.status).toBe(401);
    expect(notificationDeleteMock.ids).toEqual([]);
  });

  test("should reject test message id's (negative numbers)", async () => {
    expect((await withToken("auth0|test", -1001)).status).toBe(401);
    expect(notificationDeleteMock.ids).toEqual([]);
  });
});

describe("deleting", () => {
  test("answers 204 and deletes the message the token names", async () => {
    const res = await withToken("auth0|test", 42);

    expect(res.status).toBe(204);
    expect(notificationDeleteMock.ids).toEqual(["42"]);
  });

  test("calls the notification center as the machine user", async () => {
    const authorization: (string | null)[] = [];
    notificationDeleteMock.respond = (req) => {
      authorization.push(req.headers.get("Authorization"));
      return new Response(null, { status: 204 });
    };

    await withToken("auth0|test", 42);

    expect(authorization).toEqual(["Bearer machine-token"]);
  });

  test("does not answer 204 when the notification center fails", async () => {
    notificationDeleteMock.respond = () => new Response("boom", { status: 500 });

    const res = await withToken("auth0|test", 42);

    expect(res.status).not.toBe(204);
    expect(await res.text()).not.toContain("boom");
  });

  test("does not answer 204 when there is no machine token", async () => {
    machineTokenMock.respond = () => new Response("no", { status: 401 });

    const res = await withToken("auth0|test", 42);

    expect(res.status).not.toBe(204);
    expect(notificationDeleteMock.ids).toEqual([]);
  });
});

describe("the machine token after a refused delete", () => {
  test("is thrown away on 401, so the next delete asks Auth0 again", async () => {
    notificationDeleteMock.respond = () => new Response(null, { status: 401 });
    await withToken("auth0|test", 42);
    expect(machineTokenMock.calls).toBe(1);

    await withToken("auth0|test", 43);

    expect(machineTokenMock.calls).toBe(2);
  });

  test("is kept on 403, because a new token would be refused in the same way", async () => {
    notificationDeleteMock.respond = () => new Response(null, { status: 403 });
    await withToken("auth0|test", 42);
    expect(machineTokenMock.calls).toBe(1);

    await withToken("auth0|test", 43);

    expect(machineTokenMock.calls).toBe(1);
  });
});

describe("CORS", () => {
  test("allows a preflight from an Entur origin", async () => {
    const res = await app.request("/notifications-proxy", {
      method: "OPTIONS",
      headers: {
        Origin: ENTUR_ORIGIN,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Authorization",
      },
    });

    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ENTUR_ORIGIN);
  });

  test("does not allow an origin that only ends in the same letters", async () => {
    const res = await app.request("/notifications-proxy", {
      method: "OPTIONS",
      headers: {
        Origin: "https://evilentur.no",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Authorization",
      },
    });

    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
