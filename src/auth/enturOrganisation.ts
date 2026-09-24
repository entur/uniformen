import type { UserInfo } from "./userInfo";

/** The custom Auth0 claim that holds the id of the user's organisation. */
export const ORGANISATION_ID_CLAIM = "https://entur.io/organisationID";

/** Entur's id in the organisation register. It is the same in every environment. */
export const ENTUR_ORGANISATION_ID = 1;

/**
 * Checks whether the user belongs to the Entur organisation.
 *
 * The claim must be exactly the number 1. A string, an array or a missing claim
 * returns false, because treating an unknown user as Entur is the unsafe mistake.
 * Missing userinfo (anonymous user or failed lookup) also returns false.
 */
export function isEnturOrganisation(info: UserInfo | undefined): boolean {
  return info?.[ORGANISATION_ID_CLAIM] === ENTUR_ORGANISATION_ID;
}
