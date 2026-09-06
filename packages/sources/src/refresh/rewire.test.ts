import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { indexFiles } from "./paths.js";
import { isSameVintage, rewire, type Rename } from "./rewire.js";

const rename: Rename = {
  fromConstant: "EURIBOR_2026_07",
  toConstant: "EURIBOR_2026_08",
  fromModule: "./euribor-2026-07.js",
  toModule: "./euribor-2026-08.js",
};

describe("rewire", () => {
  it("moves the data registry onto the new vintage", () => {
    // Against the real file, so a change to how the registry is written shows
    // up here rather than in a broken build after a refresh.
    const rewired = rewire(readFileSync(indexFiles().data, "utf8"), rename);
    expect(rewired).toContain('import { EURIBOR_2026_08 } from "./euribor-2026-08.js";');
    expect(rewired).toContain("export const EURIBOR_FALLBACK = EURIBOR_2026_08;");
    expect(rewired).not.toContain("EURIBOR_2026_07");
  });

  it("moves the engine's public exports too", () => {
    const rewired = rewire(readFileSync(indexFiles().engine, "utf8"), rename);
    expect(rewired).toContain("EURIBOR_2026_08");
    expect(rewired).not.toContain("EURIBOR_2026_07");
  });

  it("refuses to rewire a file that does not mention the old vintage", () => {
    // Silently changing nothing would leave an import pointing at a module the
    // refresh is about to delete.
    expect(() => rewire("nothing to see", rename)).toThrow(/EURIBOR_2026_07/);
  });

  it("does not touch an identifier the old name is merely a prefix of", () => {
    const source = "EURIBOR_2026_07 EURIBOR_2026_07_OLD";
    expect(rewire(source, rename)).toBe("EURIBOR_2026_08 EURIBOR_2026_07_OLD");
  });

  it("recognises a rename that would change nothing", () => {
    expect(isSameVintage({ ...rename, toConstant: rename.fromConstant })).toBe(true);
  });
});
