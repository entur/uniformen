export type CachedLookupOptions = {
  /** How long a successful value is cached. */
  positiveTtlMs: number;
  /** How long a failed lookup is cached. */
  negativeTtlMs: number;
  /** Cache size bound; the oldest entry is evicted on overflow. */
  maxEntries: number;
};

type CacheEntry<T> = {
  /** The loaded value, or `null` for a negative (failed) result. */
  value: T | null;
  expiresAt: number;
};

/**
 * A per-process cache for values loaded over the network.
 *
 * Keeps a value until its TTL runs out, caches failures for a shorter time, and
 * makes concurrent lookups for the same key share one in-flight load. The loader
 * is passed to `get` rather than to the constructor, so it can close over values
 * that change between calls, such as an access token, without them becoming part
 * of the cache key.
 */
export class CachedLookup<T> {
  private readonly positiveTtlMs: number;
  private readonly negativeTtlMs: number;
  private readonly maxEntries: number;
  private readonly cache = new Map<string, CacheEntry<T>>();
  private readonly inFlight = new Map<string, Promise<T | undefined>>();

  constructor(options: CachedLookupOptions) {
    this.positiveTtlMs = options.positiveTtlMs;
    this.negativeTtlMs = options.negativeTtlMs;
    this.maxEntries = options.maxEntries;
  }

  /**
   * Returns the cached value for `key`, or calls `load` and caches what it
   * returns. A `load` that resolves to `undefined` is cached as a failure.
   */
  async get(key: string, load: () => Promise<T | undefined>): Promise<T | undefined> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value ?? undefined;
    }

    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const lookup = load()
      .then((value) => {
        this.store(key, value ?? null);
        return value;
      })
      .finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, lookup);
    return lookup;
  }

  private store(key: string, value: T | null): void {
    // `Map` iterates in insertion order, so dropping the first key is FIFO.
    if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (value === null ? this.negativeTtlMs : this.positiveTtlMs),
    });
  }
}
