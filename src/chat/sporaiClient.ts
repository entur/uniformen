import type { MachineTokenProvider } from "../auth/machineToken";

export type SporaiConfig = {
  /** The base URL of sporai, without a trailing slash. */
  baseUrl: string;
  /** Gives the machine token for sporai. It never throws. */
  tokens: Pick<MachineTokenProvider, "getToken">;
};

export type SporaiClientOptions = {
  /** How long a call to sporai may take. Default 30 seconds. */
  timeoutMs?: number;
};

/** Sporai could not answer. The reason is in the log. */
export type SporaiError = { kind: "error" };

/** Sporai answered 429, because the user sent too many questions. */
export type SporaiRateLimited = {
  kind: "rateLimited";
  /** The seconds to wait, from the `Retry-After` header. Missing when the header is missing or not usable. */
  retryAfterSeconds?: number;
};

export type SessionResult = { kind: "ok"; sessionId: string } | SporaiRateLimited | SporaiError;
/** `sessionGone` means sporai does not know the session, for example because it expired. */
export type ChatResult =
  | { kind: "ok"; reply: string }
  | { kind: "sessionGone" }
  | SporaiRateLimited
  | SporaiError;

export type ChatRequest = {
  sessionId: string;
  query: string;
  /** Sent as the `Rate-Limit-Key` header, not in the body. Sporai limits each value. */
  rateLimitKey: string;
  /** The page the user is on. Sporai only accepts path characters. */
  location?: string;
};

// Sporai limits the model to 1024 output tokens, so a reply this long means something
// is wrong.
const MAX_REPLY_CHARS = 8_000;

/**
 * Calls sporai with the machine token, and never throws. A failure comes back as a
 * result.
 */
export class SporaiClient {
  private readonly timeoutMs: number;

  constructor(
    private readonly config: SporaiConfig,
    options: SporaiClientOptions = {},
  ) {
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  async createSession(signal?: AbortSignal): Promise<SessionResult> {
    const res = await this.request("/api/chat/sessions", { method: "POST" }, signal);
    if (!(res instanceof Response)) return res;
    if (res.status === 429) return { kind: "rateLimited" };
    if (!res.ok) return this.logFailure(res.status);
    // Invalid JSON is handled in the same way as a missing session id.
    const sessionId = readField(await res.json().catch(() => undefined), "sessionId");
    if (typeof sessionId === "string") return { kind: "ok", sessionId };
    console.warn("sporai createSession failed: no session id in the response");
    return { kind: "error" };
  }

  async chat(question: ChatRequest, signal?: AbortSignal): Promise<ChatResult> {
    const { rateLimitKey, ...body } = question;
    const res = await this.request(
      "/api/chat",
      { method: "POST", body: JSON.stringify(body), headers: { "Rate-Limit-Key": rateLimitKey } },
      signal,
    );
    if (!(res instanceof Response)) return res;
    if (res.status === 404) return { kind: "sessionGone" };
    if (res.status === 429) return { kind: "rateLimited", retryAfterSeconds: readRetryAfter(res) };
    if (!res.ok) return this.logFailure(res.status);
    let reply: string;
    try {
      reply = await res.text();
    } catch (error) {
      console.warn("sporai chat failed while reading the reply:", errorName(error));
      return { kind: "error" };
    }
    if (reply.length > MAX_REPLY_CHARS) {
      console.warn("sporai chat failed: the reply is too long");
      return { kind: "error" };
    }
    return { kind: "ok", reply };
  }

  /**
   * Sends a request with the machine token. Returns the response, or an error result
   * if there was no token, the request failed or it took too long.
   */
  private async request(
    path: string,
    init: { method: string; body?: string; headers?: Record<string, string> },
    signal?: AbortSignal,
  ): Promise<Response | SporaiError> {
    const token = await this.config.tokens.getToken();
    if (!token) return { kind: "error" };

    const timeout = AbortSignal.timeout(this.timeoutMs);
    try {
      const res = await fetch(`${this.config.baseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json, text/plain",
          ...init.headers,
        },
        signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
      });
      // Do not clear the token here. Uniformen also uses it for notifications.
      if (res.status === 401 || res.status === 403) {
        console.error(
          `sporai rejected the machine token: HTTP ${res.status}. Check the Auth0 client.`,
        );
      }
      return res;
    } catch (error) {
      console.warn(`sporai request failed for ${init.method} ${path}:`, errorName(error));
      return { kind: "error" };
    }
  }

  /** Logs the status of a failed answer from sporai. */
  private logFailure(status: number): SporaiError {
    console.warn(`sporai request failed: HTTP ${status}`);
    return { kind: "error" };
  }
}

/** Returns only the name of an error, so a log line cannot contain a secret. */
function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "unknown error";
}

/**
 * Returns the `Retry-After` header of `res` as a number of seconds. Returns `undefined`
 * when the header is missing or is not a positive whole number.
 */
function readRetryAfter(res: Response): number | undefined {
  const value = res.headers.get("Retry-After");
  if (value === null || !/^\d+$/.test(value)) return undefined;
  const seconds = Number(value);
  return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : undefined;
}

/** Reads a property from a parsed JSON value. Returns `undefined` if there is none. */
function readField(body: unknown, name: string): unknown {
  return typeof body === "object" && body !== null ? Reflect.get(body, name) : undefined;
}
