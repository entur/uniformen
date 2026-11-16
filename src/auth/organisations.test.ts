import { afterEach, beforeEach, describe, expect, setSystemTime, test } from "bun:test";
import { organisationMock } from "../test/authTestSetup";
import { signPartnerToken } from "../test/authTestKeys";
import { config } from "../config";
import { ORGANISATION_ID_CLAIM } from "./enturOrganisation";
import { OrganisationServiceImpl, organisationIdFromClaims } from "./organisations";

function service(options = {}) {
  return new OrganisationServiceImpl(config.organisationsApiBaseUri, options);
}

const organisation = (tradingName: unknown) => () =>
  Response.json({ organisationId: 7, tradingName, legalName: "Juridisk navn AS" });

beforeEach(() => organisationMock.reset());
// The TTL tests fake the clock instead of sleeping. Reset the clock after each test.
afterEach(() => setSystemTime());

describe("organisationIdFromClaims", () => {
  test("returns a positive whole number", () => {
    expect(organisationIdFromClaims({ [ORGANISATION_ID_CLAIM]: 42 })).toBe(42);
  });

  test("returns undefined for anything else", () => {
    for (const value of [undefined, null, 0, -3, 1.5, "42", [42], Number.MAX_VALUE]) {
      expect(organisationIdFromClaims({ [ORGANISATION_ID_CLAIM]: value })).toBeUndefined();
    }
    expect(organisationIdFromClaims(undefined)).toBeUndefined();
  });
});

describe("OrganisationServiceImpl", () => {
  test("returns the trading name, not the legal name", async () => {
    organisationMock.respond = organisation("Handelsnavn");
    const token = await signPartnerToken();
    expect(await service().getOrganisationName("partner", 7, token)).toBe("Handelsnavn");
  });

  test("asks for the id in the path and sends the caller's token", async () => {
    const sent: { path: string; auth: string | null }[] = [];
    organisationMock.respond = (req) => {
      sent.push({ path: new URL(req.url).pathname, auth: req.headers.get("Authorization") });
      return organisation("Handelsnavn")();
    };
    const token = await signPartnerToken();
    await service().getOrganisationName("partner", 7, token);
    expect(sent).toEqual([{ path: "/organisations/v3/organisations/7", auth: `Bearer ${token}` }]);
  });

  test("the trading name is trimmed", async () => {
    organisationMock.respond = organisation("  Handelsnavn ");
    const token = await signPartnerToken();
    expect(await service().getOrganisationName("partner", 7, token)).toBe("Handelsnavn");
  });

  test("a rejected token is not cached, so the next user still gets the name", async () => {
    const token = await signPartnerToken();
    const organisations = service();
    for (const status of [401, 403]) {
      organisationMock.respond = () => new Response("nope", { status });
      expect(await organisations.getOrganisationName("partner", 7, token)).toBeUndefined();
    }
    organisationMock.respond = organisation("Handelsnavn");
    expect(await organisations.getOrganisationName("partner", 7, token)).toBe("Handelsnavn");
    expect(organisationMock.calls).toBe(3);
  });

  test("each tenant has its own cache entry", async () => {
    const token = await signPartnerToken();
    const organisations = service();
    organisationMock.respond = () => new Response("nope", { status: 500 });
    expect(await organisations.getOrganisationName("internal", 7, token)).toBeUndefined();
    organisationMock.respond = organisation("Handelsnavn");
    expect(await organisations.getOrganisationName("partner", 7, token)).toBe("Handelsnavn");
    expect(organisationMock.calls).toBe(2);
  });

  test("an HTTP error resolves to undefined", async () => {
    organisationMock.respond = () => new Response("nope", { status: 404 });
    const token = await signPartnerToken();
    expect(await service().getOrganisationName("partner", 7, token)).toBeUndefined();
  });

  test("a missing, blank or non-string trading name resolves to undefined", async () => {
    const token = await signPartnerToken();
    for (const tradingName of [undefined, "", "   ", 42]) {
      organisationMock.respond = organisation(tradingName);
      expect(await service().getOrganisationName("partner", 7, token)).toBeUndefined();
    }
  });

  test("a response that is not JSON resolves to undefined", async () => {
    organisationMock.respond = () => new Response("<html>", { status: 200 });
    const token = await signPartnerToken();
    expect(await service().getOrganisationName("partner", 7, token)).toBeUndefined();
  });

  test("a timeout resolves to undefined instead of throwing", async () => {
    organisationMock.respond = async () => {
      await Bun.sleep(200);
      return organisation("Treg")();
    };
    const token = await signPartnerToken();
    expect(
      await service({ timeoutMs: 20 }).getOrganisationName("partner", 7, token),
    ).toBeUndefined();
  });

  test("users in the same organisation share one lookup", async () => {
    const organisations = service();
    const [first, second] = await Promise.all([signPartnerToken(), signPartnerToken()]);
    await Promise.all([
      organisations.getOrganisationName("partner", 7, first),
      organisations.getOrganisationName("partner", 7, second),
    ]);
    await organisations.getOrganisationName("partner", 7, first);
    expect(organisationMock.calls).toBe(1);
    await organisations.getOrganisationName("partner", 8, first);
    expect(organisationMock.calls).toBe(2);
  });

  test("failures are cached for a shorter time than successes", async () => {
    organisationMock.respond = () => new Response("nope", { status: 500 });
    const token = await signPartnerToken();
    const organisations = service({ positiveTtlMs: 60_000, negativeTtlMs: 10 });
    await organisations.getOrganisationName("partner", 7, token);
    expect(organisationMock.calls).toBe(1);
    setSystemTime(new Date(Date.now() + 11)); // move the clock past the negative TTL
    organisationMock.respond = organisation("Handelsnavn");
    expect(await organisations.getOrganisationName("partner", 7, token)).toBe("Handelsnavn");
    expect(organisationMock.calls).toBe(2);
    setSystemTime(new Date(Date.now() + 22)); // still inside the positive TTL
    await organisations.getOrganisationName("partner", 7, token);
    expect(organisationMock.calls).toBe(2);
  });
});
