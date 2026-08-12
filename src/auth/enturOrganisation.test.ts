import { describe, expect, test } from "bun:test";
import {
  ENTUR_ORGANISATION_ID,
  isEnturOrganisation,
  ORGANISATION_ID_CLAIM,
} from "./enturOrganisation";
import type { UserInfo } from "./userInfo";

/** A profile carrying whatever the identity provider put in the claim. */
const withClaim = (value: unknown): UserInfo =>
  ({ sub: "auth0|abc123", [ORGANISATION_ID_CLAIM]: value }) as UserInfo;

describe("isEnturOrganisation", () => {
  test("the configured id, as the number it is", () => {
    expect(isEnturOrganisation(withClaim(ENTUR_ORGANISATION_ID))).toBe(true);
  });

  test("another organisation is not it", () => {
    expect(isEnturOrganisation(withClaim(ENTUR_ORGANISATION_ID + 1))).toBe(false);
    expect(isEnturOrganisation(withClaim(0))).toBe(false);
  });

  test("a claim of another shape is not read as the id", () => {
    // A string spelling, a wrapped value, or a nulled one: each is an upstream whose
    // claim we no longer recognise, and reading one as Entur is the costly direction.
    for (const value of [
      String(ENTUR_ORGANISATION_ID),
      ` ${ENTUR_ORGANISATION_ID} `,
      [ENTUR_ORGANISATION_ID],
      { id: ENTUR_ORGANISATION_ID },
      true,
      null,
      undefined,
    ]) {
      expect(isEnturOrganisation(withClaim(value))).toBe(false);
    }
  });

  test("a profile without the claim, and no profile at all", () => {
    expect(isEnturOrganisation({ sub: "auth0|abc123" })).toBe(false);
    expect(isEnturOrganisation(undefined)).toBe(false);
  });

  test("the claim is namespaced, so an unqualified key is not it", () => {
    expect(
      isEnturOrganisation({ sub: "auth0|abc123", organisationID: ENTUR_ORGANISATION_ID }),
    ).toBe(false);
  });
});
