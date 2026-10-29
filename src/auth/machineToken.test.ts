import { afterEach, beforeEach, expect, setSystemTime, test } from "bun:test";
import { machineTokenMock } from "../test/authTestSetup";
import { MachineTokenProvider } from "./machineToken";

const tokenUri = process.env["AUTH0_INTERNAL_TOKEN_URI"] as string;

/** A provider of its own, so one test's cached token cannot reach another. */
const provider = (expiryMarginMs = 60_000) =>
  new MachineTokenProvider({
    tokenUri,
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    audience: "https://api.test.entur.io",
    expiryMarginMs,
  });

beforeEach(() => machineTokenMock.reset());
afterEach(() => setSystemTime());

test("asks Auth0 for a token and returns it", async () => {
  expect(await provider().getToken()).toBe("machine-token");
  expect(machineTokenMock.calls).toBe(1);
});

test("sends the client credentials and the audience", async () => {
  let body: unknown;
  machineTokenMock.respond = async (req) => {
    body = await req.json();
    return Response.json({ access_token: "machine-token", expires_in: 3600 });
  };

  await provider().getToken();

  expect(body).toEqual({
    grant_type: "client_credentials",
    client_id: "test-client-id",
    client_secret: "test-client-secret",
    audience: "https://api.test.entur.io",
  });
});

test("keeps the token, so a second call does not ask again", async () => {
  const machine = provider();
  await machine.getToken();
  await machine.getToken();

  expect(machineTokenMock.calls).toBe(1);
});

test("callers that ask at the same time share one request", async () => {
  const machine = provider();

  const tokens = await Promise.all([machine.getToken(), machine.getToken(), machine.getToken()]);

  expect(tokens).toEqual(["machine-token", "machine-token", "machine-token"]);
  expect(machineTokenMock.calls).toBe(1);
});

test("asks again once the token is close to running out", async () => {
  setSystemTime(new Date("2026-01-01T00:00:00Z"));
  machineTokenMock.respond = () =>
    Response.json({ access_token: "machine-token", expires_in: 120 });
  const machine = provider(60_000);

  await machine.getToken();
  // 59 seconds in, the token has a minute of life left, which is the margin.
  setSystemTime(new Date("2026-01-01T00:00:59Z"));
  await machine.getToken();
  expect(machineTokenMock.calls).toBe(1);

  setSystemTime(new Date("2026-01-01T00:01:01Z"));
  await machine.getToken();
  expect(machineTokenMock.calls).toBe(2);
});

test("clear() makes the next call ask for a new token", async () => {
  const machine = provider();
  await machine.getToken();

  machine.clear();
  await machine.getToken();

  expect(machineTokenMock.calls).toBe(2);
});

test("returns undefined when Auth0 answers with an error", async () => {
  machineTokenMock.respond = () => new Response("no", { status: 401 });

  expect(await provider().getToken()).toBeUndefined();
});

test("returns undefined when Auth0 answers with something else than a token", async () => {
  machineTokenMock.respond = () => Response.json({ hello: "world" });

  expect(await provider().getToken()).toBeUndefined();
});

test("returns undefined when Auth0 cannot be reached", async () => {
  const machine = new MachineTokenProvider({
    tokenUri: "http://localhost:1/oauth/token",
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    audience: "https://api.test.entur.io",
    timeoutMs: 100,
  });

  expect(await machine.getToken()).toBeUndefined();
});

test("a failed request is not cached, so the next call tries again", async () => {
  machineTokenMock.respond = () => new Response("no", { status: 500 });
  const machine = provider();
  expect(await machine.getToken()).toBeUndefined();

  machineTokenMock.reset();
  expect(await machine.getToken()).toBe("machine-token");
});
