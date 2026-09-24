/** Whether this instance should get traffic. */
let ready = true;

/** Returns whether the instance is ready. It returns false after shutdown has started. */
export const isReady = (): boolean => ready;

/**
 * Marks the instance as not ready. It cannot be made ready again. Returns false
 * if shutdown had already started, so a second signal does not start a second
 * shutdown.
 *
 * In tests this also lasts for the rest of the run, because `bun test` shares
 * modules between test files. Check readiness before you call it.
 */
export const beginShutdown = (): boolean => {
  if (!ready) return false;
  ready = false;
  return true;
};
