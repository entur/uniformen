import { config } from "../config";

export type MachineTokenOptions = {
  tokenUri: string;
  clientId: string;
  clientSecret: string;
  audience: string;
  /** Ask for a new token this long before the old one runs out. Default 60 seconds. */
  expiryMarginMs?: number;
  /** Timeout for the request to Auth0. Default 5 seconds. */
  timeoutMs?: number;
};

/** What Auth0 returns for a client credentials request. */
type TokenResponse = {
  access_token: string;
  /** Seconds until the token runs out. */
  expires_in: number;
};

function isTokenResponse(body: unknown): body is TokenResponse {
  return (
    typeof body === "object" &&
    body !== null &&
    "access_token" in body &&
    typeof body.access_token === "string" &&
    "expires_in" in body &&
    typeof body.expires_in === "number"
  );
}

/**
 * Gets an access token for uniformen's own machine user and keeps it in memory.
 *
 * Uniformen needs this because the browser has no access token when someone clicks
 * a notification. Returns `undefined` on any failure and never throws, so callers
 * can handle a missing token the same way they handle a failed call.
 */
export class MachineTokenProvider {
  private readonly options: Required<MachineTokenOptions>;
  private cached?: { token: string; expiresAt: number };
  private inFlight?: Promise<string | undefined>;

  constructor(options: MachineTokenOptions) {
    this.options = {
      expiryMarginMs: 60_000,
      timeoutMs: 5_000,
      ...options,
    };
  }

  /**
   * Returns a valid token, asking Auth0 for one if there is none. Callers that ask
   * while a request is running share that request, so a burst of clicks makes one
   * call to Auth0.
   */
  async getToken(): Promise<string | undefined> {
    if (this.cached && this.cached.expiresAt > Date.now()) return this.cached.token;
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.fetchToken().finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }

  /**
   * Throws the cached token away, so the next call asks for a new one.
   *
   * Call this when an API answers 401, which means it no longer accepts the token.
   * Do not call it on 403. A 403 means the token is fine and the machine user is
   * missing a permission, and asking for a new token gives the same answer.
   */
  clear(): void {
    this.cached = undefined;
  }

  private async fetchToken(): Promise<string | undefined> {
    try {
      const response = await fetch(this.options.tokenUri, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          grant_type: "client_credentials",
          client_id: this.options.clientId,
          client_secret: this.options.clientSecret,
          audience: this.options.audience,
        }),
        signal: AbortSignal.timeout(this.options.timeoutMs),
      });

      if (!response.ok) {
        console.warn(`machine token request failed: HTTP ${response.status}`);
        return undefined;
      }

      const body: unknown = await response.json();
      if (!isTokenResponse(body)) {
        console.warn("machine token request failed: unexpected response from Auth0");
        return undefined;
      }

      const lifetimeMs = body.expires_in * 1_000 - this.options.expiryMarginMs;
      this.cached = {
        token: body.access_token,
        expiresAt: Date.now() + Math.max(lifetimeMs, 0),
      };
      return body.access_token;
    } catch (error) {
      // Timeout, network error or invalid JSON.
      console.warn("machine token request failed:", error);
      return undefined;
    }
  }
}

/** `undefined` when the machine user is not configured. */
export const machineToken = config.machineUser
  ? new MachineTokenProvider(config.machineUser)
  : undefined;
