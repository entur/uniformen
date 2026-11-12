import { spyOn } from "bun:test";
import { logDestination, logger, resetTokenRejections } from "../logging/logger";

/**
 * Collects every line the logger writes, as parsed JSON, until `restore` is called.
 * It logs at every level while it collects, also when `LOG_LEVEL` is "silent".
 * It also forgets which rejected tokens were logged, so each test sees its own.
 */
export function captureLogs() {
  resetTokenRejections();
  const lines: Record<string, unknown>[] = [];
  const level = logger.level;
  logger.level = "debug";
  const write = spyOn(logDestination, "write").mockImplementation((line: string) => {
    lines.push(JSON.parse(line));
    return true;
  });
  return {
    lines,
    restore() {
      write.mockRestore();
      logger.level = level;
    },
  };
}
