import { expect, test } from "bun:test";
import { locationsByApp } from "./chatLocations";
import { LOCALES } from "../types";

test("every generic page has a name in every language", () => {
  for (const { names, genericPages } of Object.values(locationsByApp)) {
    for (const locale of LOCALES) {
      for (const page of genericPages) expect(names[locale][page]).toBeString();
    }
  }
});
