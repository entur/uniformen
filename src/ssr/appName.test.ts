import { describe, expect, test } from "bun:test";
import { parseAppName } from "./appName";

describe("parseAppName", () => {
  test("maps known app slugs to their display names", () => {
    expect(parseAppName("partner")).toBe("Partner");
    expect(parseAppName("sorvis")).toBe("Sørvis");
    expect(parseAppName("cleos")).toBe("CLEOS");
  });

  test("returns undefined when no app is given", () => {
    expect(parseAppName()).toBeUndefined();
    expect(parseAppName(undefined)).toBeUndefined();
  });

  test("returns undefined for unknown or wrongly cased slugs", () => {
    expect(parseAppName("")).toBeUndefined();
    expect(parseAppName("unknown")).toBeUndefined();
    expect(parseAppName("Partner")).toBeUndefined();
    expect(parseAppName("PARTNER")).toBeUndefined();
  });
});
