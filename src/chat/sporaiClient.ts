export type SporaiConfig = {
  /** The base URL of sporai, without a trailing slash. */
  sporaiUrl: string;
  /** The internal Auth0 token endpoint. */
  tokenUri: string;
  clientId: string;
  clientSecret: string;
  /** The audience to ask Auth0 for. Sporai accepts the internal API audience. */
  audience: string;
};

export type SporaiClientOptions = {
  /** How long a call to sporai may take. Default 30 seconds. */
  timeoutMs?: number;
};

/** The route should answer with this status: 504 for a timeout, 502 for anything else. */
export type SporaiError = { kind: "error"; status: 502 | 504 };

export type SessionResult = { kind: "ok"; sessionId: string } | SporaiError;
/** `sessionGone` means sporai does not know the session, for example because it expired. */
export type ChatResult = { kind: "ok"; reply: string } | { kind: "sessionGone" } | SporaiError;

export type ChatQuestion = {
  sessionId: string;
  query: string;
  /** The page the user is on. Sporai only accepts path characters. */
  location?: string;
};

const TOKEN_TIMEOUT_MS = 5_000;
// Auth0 gives the token a lifetime in seconds. Stop using it this long before it ends.
const TOKEN_EXPIRY_MARGIN_MS = 60_000;
// Sporai limits its answers to about 4,500 characters, so a longer reply is a mistake.
const MAX_REPLY_CHARS = 8_000;

type MachineToken = { value: string; expiresAt: number };

/**
 * Calls sporai with a machine token from Auth0, and never throws. A failure comes
 * back as a result that tells the route which status to answer with.
 *
 * The machine token is cached in memory. Parallel calls that need a new token
 * share one request, in the same way as `UserInfoServiceImpl`.
 */
export class SporaiClient {
  private readonly timeoutMs: number;
  private token: MachineToken | undefined;
  private inFlight: Promise<string | undefined> | undefined;

  constructor(
    private readonly config: SporaiConfig,
    options: SporaiClientOptions = {},
  ) {
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  async createSession(signal?: AbortSignal): Promise<SessionResult> {
    const res = await this.request("/api/chat/sessions", { method: "POST" }, signal);
    if (!(res instanceof Response)) return res;
    if (!res.ok) return this.failed(res.status);
    // Invalid JSON is handled in the same way as a missing session id.
    const sessionId = field(await res.json().catch(() => undefined), "sessionId");
    if (typeof sessionId === "string") return { kind: "ok", sessionId };
    console.warn("sporai createSession failed: no session id in the response");
    return { kind: "error", status: 502 };
  }

  async chat(question: ChatQuestion, signal?: AbortSignal): Promise<ChatResult> {
    const res = await this.request(
      "/api/chat",
      { method: "POST", body: JSON.stringify(question) },
      signal,
    );
    if (!(res instanceof Response)) return res;
    if (res.status === 404) return { kind: "sessionGone" };
    if (!res.ok) return this.failed(res.status);
    let reply: string;
    try {
      reply = await res.text();
    } catch (error) {
      console.warn("sporai chat failed while reading the reply:", errorName(error));
      // The timeout can also end while the body is still arriving.
      return { kind: "error", status: errorName(error) === "TimeoutError" ? 504 : 502 };
    }
    if (reply.length > MAX_REPLY_CHARS) {
      console.warn("sporai chat failed: the reply is too long");
      return { kind: "error", status: 502 };
    }
    return { kind: "ok", reply };
  }

  /**
   * Sends a request with the machine token. Returns the response, or an error result
   * if there was no token, the request failed or it took too long.
   */
  private async request(
    path: string,
    init: { method: string; body?: string },
    signal?: AbortSignal,
  ): Promise<Response | SporaiError> {
    const token = await this.getToken();
    if (!token) return { kind: "error", status: 502 };

    const timeout = AbortSignal.timeout(this.timeoutMs);
    try {
      const res = await fetch(`${this.config.sporaiUrl}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json, text/plain",
        },
        signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
      });
      // Sporai does not accept our token. Throw it away, so the next request gets a new one.
      if (res.status === 401 || res.status === 403) {
        this.token = undefined;
        console.error(
          `sporai rejected the machine token: HTTP ${res.status}. Check the Auth0 client.`,
        );
      }
      return res;
    } catch (error) {
      console.warn(`sporai request failed for ${init.method} ${path}:`, errorName(error));
      return { kind: "error", status: timeout.aborted ? 504 : 502 };
    }
  }

  /** Logs the status of a failed answer from sporai. */
  private failed(status: number): SporaiError {
    console.warn(`sporai request failed: HTTP ${status}`);
    return { kind: "error", status: 502 };
  }

  /** Returns a machine token, or `undefined` if Auth0 could not give one. */
  private getToken(): Promise<string | undefined> {
    if (this.token && this.token.expiresAt > Date.now()) {
      return Promise.resolve(this.token.value);
    }
    this.inFlight ??= this.fetchToken().finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }

  private async fetchToken(): Promise<string | undefined> {
    try {
      const res = await fetch(this.config.tokenUri, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          grant_type: "client_credentials",
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          audience: this.config.audience,
        }),
        signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
      });
      if (!res.ok) {
        console.error(`machine token fetch failed: HTTP ${res.status}`);
        return undefined;
      }
      const body: unknown = await res.json();
      const accessToken = field(body, "access_token");
      if (typeof accessToken !== "string") {
        console.error("machine token fetch failed: no access_token in the response");
        return undefined;
      }
      const expiresIn = field(body, "expires_in");
      const seconds = typeof expiresIn === "number" ? expiresIn : 0;
      this.token = {
        value: accessToken,
        expiresAt: Date.now() + Math.max(seconds * 1000 - TOKEN_EXPIRY_MARGIN_MS, 0),
      };
      return this.token.value;
    } catch (error) {
      console.error("machine token fetch failed:", errorName(error));
      return undefined;
    }
  }
}

/** Returns only the name of an error, so a log line cannot contain a secret. */
function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "unknown error";
}

/** Reads a property from a parsed JSON value. Returns `undefined` if there is none. */
function field(body: unknown, name: string): unknown {
  return typeof body === "object" && body !== null ? Reflect.get(body, name) : undefined;
}
