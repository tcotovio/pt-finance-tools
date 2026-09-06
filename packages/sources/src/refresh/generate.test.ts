// The templates, checked against the files a person actually wrote.
//
// This is the test that keeps automated refresh honest. Each generator is fed
// the values of the dataset currently in the repo, and its output has to equal
// that file byte for byte. So the prose a maintainer edits by hand and the
// prose a refresh carries forward cannot drift apart: change one without the
// other and this fails.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONSUMER_MARKET, EURIBOR_FALLBACK } from "@pt-finance-tools/engine";
import { dataDir } from "./paths.js";
import {
  constantName,
  formatRate,
  moduleFile,
  monthLabel,
  renderConsumerModule,
  renderEuriborModule,
} from "./generate.js";

const shipped = (file: string): string =>
  readFileSync(join(dataDir(), file), "utf8");

describe("renderEuriborModule", () => {
  it("reproduces the module in the repo exactly", () => {
    const regenerated = renderEuriborModule({
      month: EURIBOR_FALLBACK.month,
      rates: {
        "3m": EURIBOR_FALLBACK.rates["3m"]!,
        "6m": EURIBOR_FALLBACK.rates["6m"]!,
        "12m": EURIBOR_FALLBACK.rates["12m"]!,
      },
      retrievedAt: EURIBOR_FALLBACK.retrievedAt,
    });
    expect(regenerated).toBe(shipped(moduleFile("euribor", EURIBOR_FALLBACK.month)));
  });

  it("names the constant and the file after the month", () => {
    const written = renderEuriborModule({
      month: "2026-08",
      rates: { "3m": 0.0244, "6m": 0.0266, "12m": 0.0286 },
      retrievedAt: "2026-09-06",
    });
    expect(written).toContain("export const EURIBOR_2026_08: EuriborSnapshot");
    expect(written).toContain('month: "2026-08"');
    expect(written).toContain("// Bundled Euribor fallback — August 2026 monthly averages.");
  });
});

describe("renderConsumerModule", () => {
  it("reproduces the module in the repo exactly", () => {
    const regenerated = renderConsumerModule({
      month: CONSUMER_MARKET.month,
      averageRate: CONSUMER_MARKET.averageRate,
      retrievedAt: CONSUMER_MARKET.retrievedAt,
    });
    expect(regenerated).toBe(shipped(moduleFile("consumer-market", CONSUMER_MARKET.month)));
  });
});

describe("formatRate", () => {
  it("removes the dust that dividing a percentage by 100 leaves behind", () => {
    // 2.2261 / 100 is 0.022261000000000003 in binary floating point, and that
    // is what would land in a checked-in source file.
    expect(formatRate(2.2261 / 100)).toBe("0.022261");
    expect(formatRate(2.4253913 / 100)).toBe("0.024253913");
    expect(formatRate(8.81 / 100)).toBe("0.0881");
  });
});

describe("naming", () => {
  it("derives the module name and constant from the period", () => {
    expect(moduleFile("euribor", "2026-08")).toBe("euribor-2026-08.ts");
    expect(constantName("EURIBOR", "2026-08")).toBe("EURIBOR_2026_08");
    expect(moduleFile("wage-market", "2026-Q3")).toBe("wage-market-2026-q3.ts");
    expect(constantName("WAGE_MARKET", "2026-Q3")).toBe("WAGE_MARKET_2026_Q3");
  });

  it("names months the way the header does", () => {
    expect(monthLabel("2026-07")).toBe("July 2026");
    expect(monthLabel("2026-12")).toBe("December 2026");
    expect(() => monthLabel("2026")).toThrow(/YYYY-MM/);
  });
});
