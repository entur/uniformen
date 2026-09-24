import { config, type AuthTenant } from "../config";

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

type CacheEntry = {
  /** The fetched userinfo, or `null` if the lookup failed. */
  value: UserInfo | null;
  expiresAt: number;
};

/**
 * Fetches userinfo and caches it in memory.
 *
 * The cache key is `tenant|sub`. The token is verified before this service is
 * called, so `sub` can be trusted. Using `sub` instead of the token means the
 * cache still works after the user gets a new token. Parallel lookups for the
 * same user share one request.
 */
export class UserInfoServiceImpl implements UserInfoService {
  private readonly positiveTtlMs: number;
  private readonly negativeTtlMs: number;
  private readonly timeoutMs: number;
  private readonly maxEntries: number;
  private readonly endpoints: Map<AuthTenant["name"], string>;
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<UserInfo | undefined>>();

  constructor(tenants: AuthTenant[], options: UserInfoServiceOptions = {}) {
    this.positiveTtlMs = options.positiveTtlMs ?? 10 * 60_000;
    this.negativeTtlMs = options.negativeTtlMs ?? 60_000;
    this.timeoutMs = options.timeoutMs ?? 5_000;
    this.maxEntries = options.maxEntries ?? 5_000;
    this.endpoints = new Map(tenants.map((tenant) => [tenant.name, tenant.userInfoUri]));
  }

  async getUserInfo(
    tenantName: AuthTenant["name"],
    token: string,
    sub: string,
  ): Promise<UserInfo | undefined> {
    const userInfoUri = this.endpoints.get(tenantName);
    if (!userInfoUri) return undefined;

    const key = `${tenantName}|${sub}`;
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value ?? undefined;
    }

    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const lookup = this.fetchUserInfo(tenantName, userInfoUri, token)
      .then((info) => {
        this.store(key, info ?? null);
        return info;
      })
      .finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, lookup);
    return lookup;
  }

  private store(key: string, value: UserInfo | null): void {
    // `Map` keeps keys in insertion order, so the first key is the oldest entry.
    if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (value === null ? this.negativeTtlMs : this.positiveTtlMs),
    });
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
      const body = await res.json();
      if (typeof body !== "object" || body === null) {
        console.warn(`userinfo fetch failed for tenant "${tenantName}": non-object response`);
        return undefined;
      }
      return body as UserInfo;
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
