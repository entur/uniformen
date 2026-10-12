import { afterEach, describe, expect, setSystemTime, test } from "bun:test";
import { CachedLookup } from "./cachedLookup";

// The TTL tests fake the clock instead of sleeping. Reset the clock after each test.
afterEach(() => setSystemTime());

function lookup<T>(options: Partial<ConstructorParameters<typeof CachedLookup<T>>[0]> = {}) {
  return new CachedLookup<T>({
    positiveTtlMs: 10_000,
    negativeTtlMs: 1_000,
    maxEntries: 100,
    ...options,
  });
}

/** A loader that counts its calls and returns what you gave it. */
function counter<T>(value: T | undefined) {
  const state = { calls: 0 };
  const load = async () => {
    state.calls++;
    return value;
  };
  return { state, load };
}

describe("CachedLookup", () => {
  test("calls the loader once and caches the value", async () => {
    const cache = lookup<string>();
    const { state, load } = counter("ada");
    expect(await cache.get("a", load)).toBe("ada");
    expect(await cache.get("a", load)).toBe("ada");
    expect(state.calls).toBe(1);
  });

  test("different keys are cached separately", async () => {
    const cache = lookup<string>();
    const { state, load } = counter("ada");
    await cache.get("a", load);
    await cache.get("b", load);
    expect(state.calls).toBe(2);
  });

  test("a loader that returns undefined is cached as a failure", async () => {
    const cache = lookup<string>();
    const { state, load } = counter(undefined);
    expect(await cache.get("a", load)).toBeUndefined();
    expect(await cache.get("a", load)).toBeUndefined();
    expect(state.calls).toBe(1);
  });

  test("positive TTL expiry triggers a re-load", async () => {
    const cache = lookup<string>({ positiveTtlMs: 10 });
    const { state, load } = counter("ada");
    await cache.get("a", load);
    setSystemTime(new Date(Date.now() + 11));
    await cache.get("a", load);
    expect(state.calls).toBe(2);
  });

  test("negative TTL expiry triggers a re-load", async () => {
    const cache = lookup<string>({ negativeTtlMs: 10 });
    const { state, load } = counter(undefined);
    await cache.get("a", load);
    setSystemTime(new Date(Date.now() + 11));
    await cache.get("a", load);
    expect(state.calls).toBe(2);
  });

  test("a failure expires before a value, given a shorter negative TTL", async () => {
    const cache = lookup<string>({ positiveTtlMs: 10_000, negativeTtlMs: 10 });
    const failing = counter<string>(undefined);
    const working = counter("ada");
    await cache.get("fails", failing.load);
    await cache.get("works", working.load);
    setSystemTime(new Date(Date.now() + 11));
    await cache.get("fails", failing.load);
    await cache.get("works", working.load);
    expect(failing.state.calls).toBe(2);
    expect(working.state.calls).toBe(1);
  });

  test("parallel lookups for the same key share one load", async () => {
    const cache = lookup<string>();
    let calls = 0;
    const load = async () => {
      calls++;
      // Wait a little, so the second lookup starts while this one is still running.
      await Bun.sleep(10);
      return "ada";
    };
    const [a, b] = await Promise.all([cache.get("a", load), cache.get("a", load)]);
    expect(a).toBe("ada");
    expect(b).toBe("ada");
    expect(calls).toBe(1);
  });

  test("a rejected load is not cached and does not block the next lookup", async () => {
    const cache = lookup<string>();
    const failing = async (): Promise<string> => {
      throw new Error("boom");
    };
    const rejection = await cache.get("a", failing).then(
      () => undefined,
      (reason: unknown) => reason,
    );
    expect(rejection).toHaveProperty("message", "boom");
    const { state, load } = counter("ada");
    expect(await cache.get("a", load)).toBe("ada");
    expect(state.calls).toBe(1);
  });

  test("maxEntries evicts the oldest entry", async () => {
    const cache = lookup<string>({ maxEntries: 2 });
    const { state, load } = counter("ada");
    await cache.get("1", load);
    await cache.get("2", load);
    await cache.get("3", load); // evicts "1"
    expect(state.calls).toBe(3);
    await cache.get("2", load); // still cached
    expect(state.calls).toBe(3);
    await cache.get("1", load); // evicted, so this loads again
    expect(state.calls).toBe(4);
  });
});
