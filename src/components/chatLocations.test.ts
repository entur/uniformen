import { expect, test } from "bun:test";
import { genericPages, locationNames } from "./chatLocations";
import { LOCALES } from "../types";

test("every generic page has a name in every language", () => {
  for (const locale of LOCALES) {
    for (const page of genericPages) expect(locationNames[locale][page]).toBeString();
  }
});
