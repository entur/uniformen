/**
 * Whether this instance should be sent traffic.
 *
 * Its own module so the readiness route and the signal handler that flips it don't
 * have to know about each other — the route reads, the handler writes, and neither
 * imports the other.
 */
let ready = true;

/** What the readiness probe answers. False from the moment a shutdown begins. */
export const isReady = (): boolean => ready;

/**
 * Start failing readiness. One-way: a draining pod is on its way out, and nothing
 * brings it back. Returns false if a shutdown was already under way, so a second
 * signal doesn't start a second drain.
 *
 * One-way in tests too — `bun test` shares one module registry across files, so
 * this stays flipped for the rest of the run. Assert readiness before calling it.
 */
export const beginShutdown = (): boolean => {
  if (!ready) return false;
  ready = false;
  return true;
};
