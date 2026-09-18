import type { UserInfo } from "./userInfo";

/** Namespaced Auth0 claim naming the organisation the user belongs to. */
export const ORGANISATION_ID_CLAIM = "https://entur.io/organisationID";

/**
 * Entur's own id in the organisation register. The same number in every
 * environment, and the same one entur-partner reads the claim against.
 */
export const ENTUR_ORGANISATION_ID = 1;

/**
 * Whether this profile belongs to the Entur organisation.
 *
 * Strict on the claim: the id as the number Auth0 mints it as, nothing else. A
 * string spelling of it, an array, or an absent claim is a profile we cannot place,
 * and reading one as Entur is the only direction with a cost. No userinfo at all —
 * anonymous, or a lookup that failed — is likewise not Entur.
 */
export function isEnturOrganisation(info: UserInfo | undefined): boolean {
  return info?.[ORGANISATION_ID_CLAIM] === ENTUR_ORGANISATION_ID;
}
