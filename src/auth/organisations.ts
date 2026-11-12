import { config } from "../config";
import { CachedLookup } from "./cachedLookup";
import { ORGANISATION_ID_CLAIM } from "./enturOrganisation";
import { correlationHeaders, logger } from "../logging/logger";

export type OrganisationService = {
  /**
   * Returns the trading name of the organisation with this id. Returns `undefined`
   * on any failure and never throws, so callers can show the email instead without
   * a try/catch.
   */
  getOrganisationName(organisationId: number, token: string): Promise<string | undefined>;
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
 * Returns the organisation id from the claims of a verified access token. Returns
 * `undefined` when the claim is missing or is not a positive whole number.
 */
export function organisationIdFromClaims(
  claims: Record<string, unknown> | undefined,
): number | undefined {
  const value = claims?.[ORGANISATION_ID_CLAIM];
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

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
 * The cache key is only the organisation id, so all users in one organisation share
 * one entry. This is safe because the register gives any internal or partner user
 * every organisation, and the id comes from a verified token. The user's token is
 * only sent to the register, and it is not part of the key. Names rarely change, so
 * they are cached for a long time.
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

  async getOrganisationName(organisationId: number, token: string): Promise<string | undefined> {
    if (!token) return undefined;
    return this.cache.get(String(organisationId), () =>
      this.fetchOrganisationName(organisationId, token),
    );
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
      if (!res.ok) {
        logger.warn(`organisation fetch failed for id ${organisationId}: HTTP ${res.status}`);
        return undefined;
      }
      const body: unknown = await res.json();
      if (!hasTradingName(body)) {
        logger.warn(`organisation fetch failed for id ${organisationId}: no tradingName`);
        return undefined;
      }
      return body.tradingName;
    } catch (error) {
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
