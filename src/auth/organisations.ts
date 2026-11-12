import { config, type AuthTenant } from "../config";
import { CachedLookup } from "./cachedLookup";
import { ORGANISATION_ID_CLAIM } from "./enturOrganisation";
import { correlationHeaders, logger } from "../logging/logger";

export type OrganisationService = {
  /**
   * Returns the trading name of the organisation with this id. Returns `undefined`
   * on any failure and never throws, so callers can show the email instead without
   * a try/catch.
   */
  getOrganisationName(
    tenantName: AuthTenant["name"],
    organisationId: number,
    token: string,
  ): Promise<string | undefined>;
};

export type OrganisationServiceOptions = {
  /** How long a fetched name is cached. Default 1 hour. */
  positiveTtlMs?: number;
  /** How long a failed lookup is cached. Default 60 seconds. */
  negativeTtlMs?: number;
  /** Timeout for the request. Default 1 second. */
  timeoutMs?: number;
  /** Maximum number of cached organisations. When the cache is full, the oldest entry is removed. Default 5000. */
  maxEntries?: number;
};

/**
 * Returns the organisation id from the user's userinfo. Returns `undefined` when
 * the claim is missing or is not a positive whole number.
 */
export function organisationIdFromClaims(
  claims: Record<string, unknown> | undefined,
): number | undefined {
  const value = claims?.[ORGANISATION_ID_CLAIM];
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

/**
 * Thrown when the register rejects the user's token. `getOrganisationName` catches
 * it. A thrown error is not cached, so one rejected token does not hide the name
 * for other users in the same organisation.
 */
class TokenRejectedError extends Error {}

/** Checks whether a response body has a `tradingName` that is not blank. */
const hasTradingName = (body: unknown): body is { tradingName: string } =>
  typeof body === "object" &&
  body !== null &&
  "tradingName" in body &&
  typeof body.tradingName === "string" &&
  body.tradingName.trim() !== "";

/**
 * Fetches organisation names from the organisation register and caches them in
 * memory.
 *
 * The cache key is `tenant|organisationId`, so users in the same organisation and
 * tenant share one entry. The id comes from the verified user's userinfo. The
 * user's token is only sent to the register, and it is not part of the key. Names
 * rarely change, so they are cached for a long time.
 */
export class OrganisationServiceImpl implements OrganisationService {
  private readonly apiBaseUri: string;
  private readonly timeoutMs: number;
  private readonly cache: CachedLookup<string>;

  /** `apiBaseUri` is the register without a path, e.g. `https://api.dev.entur.io/organisations/v3`. */
  constructor(apiBaseUri: string, options: OrganisationServiceOptions = {}) {
    this.apiBaseUri = apiBaseUri;
    this.timeoutMs = options.timeoutMs ?? 1_000;
    this.cache = new CachedLookup({
      positiveTtlMs: options.positiveTtlMs ?? 60 * 60_000,
      negativeTtlMs: options.negativeTtlMs ?? 60_000,
      maxEntries: options.maxEntries ?? 5_000,
    });
  }

  async getOrganisationName(
    tenantName: AuthTenant["name"],
    organisationId: number,
    token: string,
  ): Promise<string | undefined> {
    try {
      return await this.cache.get(`${tenantName}|${organisationId}`, () =>
        this.fetchOrganisationName(organisationId, token),
      );
    } catch {
      // The register rejected the token. fetchOrganisationName has logged it.
      return undefined;
    }
  }

  private async fetchOrganisationName(
    organisationId: number,
    token: string,
  ): Promise<string | undefined> {
    try {
      const res = await fetch(`${this.apiBaseUri}/organisations/${organisationId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          ...correlationHeaders(),
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (res.status === 401 || res.status === 403) {
        logger.warn(`organisation fetch rejected for id ${organisationId}: HTTP ${res.status}`);
        throw new TokenRejectedError();
      }
      if (!res.ok) {
        logger.warn(`organisation fetch failed for id ${organisationId}: HTTP ${res.status}`);
        return undefined;
      }
      const body: unknown = await res.json();
      if (!hasTradingName(body)) {
        logger.warn(`organisation fetch failed for id ${organisationId}: no tradingName`);
        return undefined;
      }
      return body.tradingName.trim();
    } catch (error) {
      if (error instanceof TokenRejectedError) throw error;
      // Timeout, network error or invalid JSON. The caller shows the email instead.
      logger.warn({ err: error }, `organisation fetch failed for id ${organisationId}`);
      return undefined;
    }
  }
}

/**
 * The organisation service for the configured register. Call `getOrganisationName`
 * with the id from `organisationIdFromClaims` and the value of `authToken`.
 */
export const organisationService: OrganisationService = new OrganisationServiceImpl(
  config.organisationsApiBaseUri,
);
