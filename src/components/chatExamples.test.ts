import { expect, test } from "bun:test";
import { LOCALES } from "../types";
import { examplesByApp } from "./chatExamples";

test("every app with example questions has some in every language", () => {
  for (const [appId, examples] of Object.entries(examplesByApp)) {
    for (const locale of LOCALES) {
      // An empty list would show no example questions, instead of the general ones.
      expect(examples[locale].length, `${appId} ${locale}`).toBeGreaterThan(0);
    }
  }
});
