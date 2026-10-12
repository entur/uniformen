import type { UniformenLayout } from "../types";

/**
 * How long a cached layout can be used when Uniformen fails. An anonymous layout is
 * the same for everyone, so it is kept for a day. A signed-in layout contains the
 * user's name, so it is removed after an hour.
 */
export const ANONYMOUS_STALE_MS = 24 * 60 * 60_000;
export const SIGNED_IN_STALE_MS = 60 * 60_000;

/**
 * The most layouts each cache holds. Anonymous and signed-in layouts have separate
 * limits, so new tokens from many users cannot push out the anonymous layouts.
 */
export const MAX_ENTRIES_PER_CACHE = 100;

type CacheEntry = {
  layout: UniformenLayout;
  /** Until this time the layout is used without asking Uniformen. */
  freshUntil: number;
  /** Until this time the layout is used when Uniformen fails. */
  staleUntil: number;
};

/**
 * Layouts keyed by URL, and for a signed-in user also by a hash of the token. A
 * `Map` keeps insertion order, so the first key is the least recently used one.
 */
const anonymousCache = new Map<string, CacheEntry>();
const signedInCache = new Map<string, CacheEntry>();

/**
 * Increases on every clear. A request that started before a clear checks it, so it
 * does not write an old layout back into the cache.
 */
let generation = 0;

/** Removes all cached layouts. */
export function clearCache(): void {
  anonymousCache.clear();
  signedInCache.clear();
  generation++;
}

/** Returns the current generation. Read it before a request starts, and pass it to `writeCache` when the response arrives. */
export function cacheGeneration(): number {
  return generation;
}

/** Returns the number of cached layouts. Only used by tests. */
export function cachedLayoutCount(): number {
  return anonymousCache.size + signedInCache.size;
}

function cacheFor(signedIn: boolean): Map<string, CacheEntry> {
  return signedIn ? signedInCache : anonymousCache;
}

export function readCache(key: string, signedIn: boolean): CacheEntry | undefined {
  const cache = cacheFor(signedIn);
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.staleUntil <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  // Move the entry to the end, so it is the last one to be evicted.
  cache.delete(key);
  cache.set(key, entry);
  return entry;
}

/**
 * Stores the layout, unless the cache was cleared after `startGeneration`. Removes
 * expired entries from both caches first, so a layout with a user's name is not kept
 * after it expires, even if nobody reads its key again.
 */
export function writeCache(
  key: string,
  signedIn: boolean,
  layout: UniformenLayout,
  freshMs: number,
  startGeneration: number,
): void {
  if (startGeneration !== generation) return;
  const now = Date.now();
  removeExpired(anonymousCache, now);
  removeExpired(signedInCache, now);

  const cache = cacheFor(signedIn);
  cache.delete(key);
  cache.set(key, {
    layout,
    freshUntil: now + freshMs,
    staleUntil: now + (signedIn ? SIGNED_IN_STALE_MS : ANONYMOUS_STALE_MS),
  });
  if (cache.size > MAX_ENTRIES_PER_CACHE) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

function removeExpired(cache: Map<string, CacheEntry>, now: number): void {
  for (const [key, entry] of cache) {
    if (entry.staleUntil <= now) cache.delete(key);
  }
}
