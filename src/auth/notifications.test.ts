import { afterEach, beforeEach, describe, expect, setSystemTime, test } from "bun:test";
import { notificationMock } from "../test/authTestSetup";
import { signInternalToken } from "../test/authTestKeys";
import { config } from "../config";
import { NotificationServiceImpl } from "./notifications";

const notification = {
  id: 1010,
  referenceId: "110",
  created: "2026-09-16T04:55:37.773752Z",
  authority: "partner",
  subject: "waad|example",
  service: "PERMISSION_ADMIN",
  type: "ROLE_REQUEST",
  variant: "INFORMATION",
  messages: [{ language: "nob", title: "Rollesøknad", body: "Ola Nordmann ønsker en rolle" }],
};

function service(options = {}) {
  return new NotificationServiceImpl(config.notificationApiBaseUri, options);
}

beforeEach(() => notificationMock.reset());
// The TTL tests fake the clock instead of sleeping. Reset the clock after each test.
afterEach(() => setSystemTime());

describe("NotificationServiceImpl", () => {
  test("a user with no notifications gets an empty list, not undefined", async () => {
    notificationMock.respond = () => Response.json([]);
    const token = await signInternalToken();
    expect(await service().getNotifications("internal", token, "empty|user")).toEqual({
      items: [],
      totalCount: 0,
    });
  });

  test("at most five notifications come back, but totalCount counts them all", async () => {
    const many = Array.from({ length: 8 }, (_, index) => ({ ...notification, id: 1000 + index }));
    notificationMock.respond = () => Response.json(many);
    const token = await signInternalToken();
    const result = await service().getNotifications("internal", token, "many|user");
    expect(result?.items).toHaveLength(5);
    expect(result?.totalCount).toBe(8);
  });

  test("a notification without a message text is left out of both the list and the count", async () => {
    notificationMock.respond = () =>
      Response.json([notification, { ...notification, id: 1011, messages: [] }]);
    const token = await signInternalToken();
    const result = await service().getNotifications("internal", token, "no|message");
    expect(result?.items).toHaveLength(1);
    expect(result?.totalCount).toBe(1);
  });

  test("sends the caller's token to the API", async () => {
    const token = await signInternalToken();
    const sent: (string | null)[] = [];
    notificationMock.respond = (req) => {
      sent.push(req.headers.get("Authorization"));
      return Response.json([]);
    };
    await service().getNotifications("internal", token, "token|user");
    expect(sent).toEqual([`Bearer ${token}`]);
  });

  test("no token means no call to the API", async () => {
    expect(await service().getNotifications("internal", "", "no|token")).toBeUndefined();
    expect(notificationMock.calls).toBe(0);
  });

  test("an HTTP error resolves to undefined", async () => {
    notificationMock.respond = () => new Response("nope", { status: 500 });
    const token = await signInternalToken();
    expect(await service().getNotifications("internal", token, "http|error")).toBeUndefined();
  });

  test("a response that is not an array resolves to undefined", async () => {
    notificationMock.respond = () => Response.json({ items: [notification] });
    const token = await signInternalToken();
    expect(await service().getNotifications("internal", token, "not|array")).toBeUndefined();
  });

  test("a timeout resolves to undefined instead of throwing", async () => {
    notificationMock.respond = async () => {
      await Bun.sleep(200);
      return Response.json([]);
    };
    const token = await signInternalToken();
    const result = await service({ timeoutMs: 20 }).getNotifications("internal", token, "slow|one");
    expect(result).toBeUndefined();
  });

  test("the same user is fetched once, and each tenant is cached on its own", async () => {
    const token = await signInternalToken();
    const notifications = service();
    await notifications.getNotifications("internal", token, "cache|user");
    await notifications.getNotifications("internal", token, "cache|user");
    expect(notificationMock.calls).toBe(1);
    await notifications.getNotifications("partner", token, "cache|user");
    expect(notificationMock.calls).toBe(2);
  });

  test("failures are cached for a shorter time than successes", async () => {
    notificationMock.respond = () => new Response("nope", { status: 500 });
    const token = await signInternalToken();
    const notifications = service({ positiveTtlMs: 60_000, negativeTtlMs: 10 });
    await notifications.getNotifications("internal", token, "ttl|user");
    expect(notificationMock.calls).toBe(1);
    setSystemTime(new Date(Date.now() + 11)); // move the clock past the negative TTL
    notificationMock.respond = () => Response.json([notification]);
    const result = await notifications.getNotifications("internal", token, "ttl|user");
    expect(result?.items).toHaveLength(1);
    expect(notificationMock.calls).toBe(2);
    setSystemTime(new Date(Date.now() + 22)); // still inside the positive TTL
    await notifications.getNotifications("internal", token, "ttl|user");
    expect(notificationMock.calls).toBe(2);
  });
});
