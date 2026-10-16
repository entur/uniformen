import { config, type AuthTenant } from "../config";
import { CachedLookup } from "./cachedLookup";

/**
 * The Auth0 userinfo response. It has the standard OIDC profile claims and custom
 * claims such as `https://entur.io/organisationID`.
 */
export type UserInfo = {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  nickname?: string;
  picture?: string;
  email?: string;
  email_verified?: boolean;
  updated_at?: string;
  /** Custom claims, e.g. "https://entur.io/organisationID". */
  [claim: string]: unknown;
};

export type UserInfoService = {
  /**
   * Fetches the user's profile from the tenant's userinfo endpoint. Returns
   * `undefined` on any failure and never throws, so callers can render the page
   * as anonymous without a try/catch.
   */
  getUserInfo(
    tenantName: AuthTenant["name"],
    token: string,
    sub: string,
  ): Promise<UserInfo | undefined>;
};

export type UserInfoServiceOptions = {
  /** How long a successfully fetched userinfo is cached. Default 10 minutes. */
  positiveTtlMs?: number;
  /** How long a failed lookup is cached. Default 60 seconds. */
  negativeTtlMs?: number;
  /** Timeout for the userinfo request. Default 5 seconds, the same as jose's JWKS timeout. */
  timeoutMs?: number;
  /** Maximum number of cached users. When the cache is full, the oldest entry is removed. Default 5000. */
  maxEntries?: number;
};

/** Checks whether a userinfo response body is an object with a string `sub`. */
const isUserInfo = (body: unknown): body is UserInfo =>
  typeof body === "object" && body !== null && "sub" in body && typeof body.sub === "string";

/**
 * Fetches userinfo and caches it in memory.
 *
 * The cache key is `tenant|sub`. The token is verified before this service is
 * called, so `sub` can be trusted. Using `sub` instead of the token means the
 * cache still works after the user gets a new token. Parallel lookups for the
 * same user share one request.
 */
export class UserInfoServiceImpl implements UserInfoService {
  private readonly timeoutMs: number;
  private readonly endpoints: Map<AuthTenant["name"], string>;
  private readonly cache: CachedLookup<UserInfo>;

  constructor(tenants: AuthTenant[], options: UserInfoServiceOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 5_000;
    this.endpoints = new Map(tenants.map((tenant) => [tenant.name, tenant.userInfoUri]));
    this.cache = new CachedLookup({
      positiveTtlMs: options.positiveTtlMs ?? 10 * 60_000,
      negativeTtlMs: options.negativeTtlMs ?? 60_000,
      maxEntries: options.maxEntries ?? 5_000,
    });
  }

  async getUserInfo(
    tenantName: AuthTenant["name"],
    token: string,
    sub: string,
  ): Promise<UserInfo | undefined> {
    const userInfoUri = this.endpoints.get(tenantName);
    if (!userInfoUri) return undefined;

    return this.cache.get(`${tenantName}|${sub}`, () =>
      this.fetchUserInfo(tenantName, userInfoUri, token),
    );
  }

  private async fetchUserInfo(
    tenantName: AuthTenant["name"],
    userInfoUri: string,
    token: string,
  ): Promise<UserInfo | undefined> {
    try {
      const res = await fetch(userInfoUri, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) {
        console.warn(`userinfo fetch failed for tenant "${tenantName}": HTTP ${res.status}`);
        return undefined;
      }
      const body: unknown = await res.json();
      // OpenID Connect requires `sub` in every userinfo response.
      if (!isUserInfo(body)) {
        console.warn(`userinfo fetch failed for tenant "${tenantName}": no sub in response`);
        return undefined;
      }
      return body;
    } catch (error) {
      // Timeout, network error or invalid JSON. The caller treats the user as anonymous.
      console.warn(`userinfo fetch failed for tenant "${tenantName}":`, error);
      return undefined;
    }
  }
}

/**
 * The userinfo service for the configured Auth0 tenants. Call
 * `getUserInfo(tenant, token, sub)` with the values that `validateJwt` sets on the
 * context: `authTenant`, `authToken` and `jwtPayload.sub`.
 */
export const userInfoService: UserInfoService = new UserInfoServiceImpl(config.tenants);
