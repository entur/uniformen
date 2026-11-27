import { expect, test } from "bun:test";
import { Glob } from "bun";

// tsc copies import paths into the .d.ts files as written. Apps that use
// `moduleResolution: "nodenext"` only resolve relative imports with a file extension,
// so without one they lose the types that are imported this way.
test("relative imports in the published files have a .js extension", async () => {
  const missing: string[] = [];
  for await (const file of new Glob("**/*.{ts,tsx}").scan(import.meta.dir)) {
    if (/\.test\.tsx?$/.test(file)) continue;
    const source = await Bun.file(`${import.meta.dir}/${file}`).text();
    for (const [, path] of source.matchAll(/from "(\.{1,2}\/[^"]+)"/g)) {
      if (!path?.endsWith(".js")) missing.push(`${file}: ${path}`);
    }
  }
  expect(missing).toEqual([]);
});
