// Duodécimos: expectations derived from CIRS art. 99.º-C n.ºs 5–6, not from a
// third-party simulator. See the divergence test at the bottom for why.

import { describe, expect, it } from "vitest";
import { computeNetWage } from "./withholding.js";
import { twelfthsDetail } from "./twelfths.js";
import { CONTINENTE_2026 } from "../data/continente-2026.js";
import { selectTable } from "./resolver.js";

const table = selectTable(CONTINENTE_2026, "unmarried");
const base = {
  region: "continente",
  category: "unmarried",
  dependents: 0,
  referenceDate: "2026-08-18",
} as const;

describe("twelfthsDetail", () => {
  it("withholds the proportional part of the tax on the whole subsidy", () => {
    // A 1 500 € subsidy is withheld as its own remuneração:
    //   1 500 × 24,10 % − 193,33 = 168,17 €
    // Both subsidies in duodécimos pay 2/12 of the subsidy each month, and
    // withhold 2/12 of that tax.
    const d = twelfthsDetail({ holiday: 1, christmas: 1 }, 1500, 0, table);
    expect(d.withholdingOnFullSubsidy).toBeCloseTo(168.17, 2);
    expect(d.paid).toBeCloseTo(250, 2);
    expect(d.withholding).toBeCloseTo(28.03, 2); // 168,17 × 2/12
  });

  it("halves the amount and the tax for a half subsidy", () => {
    const full = twelfthsDetail({ holiday: 1, christmas: 0 }, 1500, 0, table);
    const half = twelfthsDetail({ holiday: 0.5, christmas: 0 }, 1500, 0, table);
    expect(half.paid).toBeCloseTo(full.paid / 2, 10);
    expect(half.withholding).toBeCloseTo(full.withholding / 2, 10);
  });

  it("gives the subsidy its own bracket, not the salary's", () => {
    // A subsidy below the 920 € threshold is withheld at 0 %, however high
    // the salary that month happens to be.
    const d = twelfthsDetail({ holiday: 1, christmas: 1 }, 900, 0, table);
    expect(d.withholdingOnFullSubsidy).toBe(0);
    expect(d.withholding).toBe(0);
    expect(d.paid).toBeCloseTo(150, 2);
  });

  it("applies the per-dependent deduction to the subsidy too", () => {
    const without = twelfthsDetail({ holiday: 1, christmas: 1 }, 1800, 0, table);
    const with2 = twelfthsDetail({ holiday: 1, christmas: 1 }, 1800, 2, table);
    // 34,29 € × 2 dependents less tax on the full subsidy, pro-rated by 2/12.
    expect(without.withholdingOnFullSubsidy - with2.withholdingOnFullSubsidy)
      .toBeCloseTo(68.58, 2);
    expect(without.withholding - with2.withholding).toBeCloseTo(68.58 * 2 / 12, 2);
  });

  it("rejects fractions outside 0..1", () => {
    expect(() => twelfthsDetail({ holiday: 2, christmas: 0 }, 1500, 0, table))
      .toThrow(/between 0 and 1/);
  });
});

describe("computeNetWage with duodécimos", () => {
  it("does not let duodécimos push the salary into a higher bracket", () => {
    // 1 800 € salary sits in the 24,10 % bracket. Adding 300 € of duodécimos
    // would cross the 1 819 € boundary if they were pooled — art. 99.º-C n.º 5
    // says they are not.
    const result = computeNetWage(
      { ...base, grossMonthly: 1800, twelfths: { holiday: 1, christmas: 1 } },
      CONTINENTE_2026,
    );
    expect(result.taxableBase).toBe(1800);
    expect(result.breakdown.marginalRate).toBe(0.241);
  });

  it("contributes to Segurança Social on salary plus duodécimos", () => {
    const result = computeNetWage(
      { ...base, grossMonthly: 1500, twelfths: { holiday: 1, christmas: 1 } },
      CONTINENTE_2026,
    );
    // 11 % of 1 750 €, not of 1 500 €.
    expect(result.socialSecurity).toBeCloseTo(192.5, 2);
  });

  it("sums salary and duodécimo withholding into irsWithholding", () => {
    const result = computeNetWage(
      { ...base, grossMonthly: 1500, twelfths: { holiday: 1, christmas: 1 } },
      CONTINENTE_2026,
    );
    expect(result.irsWithholding).toBeCloseTo(168.17 + 28.03, 2);
    expect(result.twelfths?.paid).toBeCloseTo(250, 2);
    expect(result.netMonthly).toBeCloseTo(1750 - 192.5 - 196.2, 2);
  });

  it("honours a subsidyAmount that differs from the monthly salary", () => {
    const result = computeNetWage(
      {
        ...base,
        grossMonthly: 1500,
        subsidyAmount: 1200,
        twelfths: { holiday: 1, christmas: 0 },
      },
      CONTINENTE_2026,
    );
    expect(result.twelfths?.subsidyAmount).toBe(1200);
    expect(result.twelfths?.paid).toBeCloseTo(100, 2); // 1 200 / 12
  });
});

describe("known divergence from the Doutor Finanças simulator", () => {
  // Documented deliberately: our duodécimo withholding follows art. 99.º-C
  // n.º 6 (tax on the whole subsidy, pro-rated). The reference simulator
  // agrees at 1 500 € to within a cent but drifts at 2 500 €, apparently
  // rounding the effective rate. The statute is the authority, so the engine
  // follows it and this test records the gap rather than hiding it.
  it("matches the simulator at 1 500 € to within one cent", () => {
    const result = computeNetWage(
      { ...base, grossMonthly: 1500, twelfths: { holiday: 1, christmas: 1 } },
      CONTINENTE_2026,
    );
    expect(Math.abs(result.netMonthly - 1361.33)).toBeLessThan(0.05);
  });

  it("differs from the simulator at 2 500 € by well under a euro", () => {
    const result = computeNetWage(
      { ...base, grossMonthly: 2500, twelfths: { holiday: 1, christmas: 1 } },
      CONTINENTE_2026,
    );
    // Engine 2 045,94 € vs simulator 2 046,49 €.
    expect(result.netMonthly).toBeCloseTo(2045.94, 2);
    expect(Math.abs(result.netMonthly - 2046.49)).toBeLessThan(1);
  });
});
