import { describe, expect, it } from "vitest";
import type { WageInput, WithholdingDataset } from "../types.js";
import { computeNetWage, withholdingForBracket } from "./withholding.js";
import { selectBracket, selectTable } from "./resolver.js";
import { socialSecurityContribution } from "./segsocial.js";

// SYNTHETIC fixture — deliberately round, illustrative numbers. These are NOT
// real IRS coefficients; they exist only to exercise the calculation logic.
// The real, verified 2026 dataset is a separate deliverable (see PLAN.md §5).
const SYNTHETIC: WithholdingDataset = {
  year: 2026,
  region: "continente",
  effectiveFrom: "2026-01-01",
  source: "SYNTHETIC test fixture — not official data",
  verified: false,
  tables: [
    {
      category: "unmarried",
      brackets: [
        {
          upTo: 1000,
          marginalRate: 0,
          deduction: { kind: "fixed", amount: 0 },
          dependentDeduction: 0,
        },
        {
          upTo: 2000,
          marginalRate: 0.2,
          deduction: { kind: "fixed", amount: 200 },
          dependentDeduction: 30,
        },
        {
          upTo: null,
          marginalRate: 0.4,
          deduction: { kind: "fixed", amount: 600 },
          dependentDeduction: 50,
        },
      ],
    },
  ],
};

const baseInput: WageInput = {
  grossMonthly: 1500,
  region: "continente",
  category: "unmarried",
  dependents: 0,
  referenceDate: "2026-06-01",
};

describe("withholdingForBracket", () => {
  const bracket = {
    upTo: 2000,
    marginalRate: 0.2,
    deduction: { kind: "fixed" as const, amount: 200 },
    dependentDeduction: 30,
  };

  it("applies rate then subtracts the fixed deduction", () => {
    expect(withholdingForBracket(1500, 0, bracket)).toBe(100); // 1500*0.2 - 200
  });

  it("subtracts the per-dependent deduction", () => {
    expect(withholdingForBracket(1500, 2, bracket)).toBe(40); // 100 - 30*2
  });

  it("clamps a negative result to zero (no refund at source)", () => {
    expect(withholdingForBracket(1100, 1, bracket)).toBe(0); // 220-200-30 = -10 -> 0
  });

  it("reduces the marginal rate by 1pp for 3+ dependents (§5.h)", () => {
    // rate 0.20 -> 0.19 on income; parcela a abater unchanged.
    // 1500*0.19 - 200 - 30*3 = 285 - 200 - 90 = -5 -> clamped 0. Use a higher
    // income to see a positive value:
    // 5000*0.19 - 200 - 30*3 = 950 - 200 - 90 = 660
    const topBracket = {
      upTo: null,
      marginalRate: 0.2,
      deduction: { kind: "fixed" as const, amount: 200 },
      dependentDeduction: 30,
    };
    expect(withholdingForBracket(5000, 3, topBracket)).toBe(660);
    // 2 dependents keeps the full rate: 5000*0.20 - 200 - 30*2 = 740
    expect(withholdingForBracket(5000, 2, topBracket)).toBe(740);
  });

  it("resolves an R-dependent (formula) parcela a abater", () => {
    // PA = marginalRate * multiplier * (base - R) = 0.2 * 2 * (1500 - R)
    const formulaBracket = {
      upTo: 1400,
      marginalRate: 0.2,
      deduction: { kind: "formula" as const, multiplier: 2, base: 1500 },
      dependentDeduction: 0,
    };
    // R=1200: PA = 0.2*2*(1500-1200) = 0.4*300 = 120; withholding = 1200*0.2 - 120 = 120
    expect(withholdingForBracket(1200, 0, formulaBracket)).toBeCloseTo(120, 10);
  });
});

describe("selectBracket", () => {
  const table = SYNTHETIC.tables[0]!;

  it("selects on the inclusive upper bound", () => {
    expect(selectBracket(table, 1000).marginalRate).toBe(0);
    expect(selectBracket(table, 1000.01).marginalRate).toBe(0.2);
  });

  it("falls through to the open-ended top bracket", () => {
    expect(selectBracket(table, 99999).marginalRate).toBe(0.4);
  });

  it("throws when no bracket matches and there is no open-ended top", () => {
    const capped = { category: "unmarried" as const, brackets: [table.brackets[0]!] };
    expect(() => selectBracket(capped, 5000)).toThrow(/no open-ended/i);
  });
});

describe("selectTable", () => {
  it("throws for a category the dataset does not contain", () => {
    expect(() => selectTable(SYNTHETIC, "married-dual-earner")).toThrow(
      /No withholding table/,
    );
  });
});

describe("socialSecurityContribution", () => {
  it("is 11% of gross by default", () => {
    expect(socialSecurityContribution(1500)).toBeCloseTo(165, 10);
  });
});

describe("computeNetWage", () => {
  it("nets gross minus withholding minus social security", () => {
    const r = computeNetWage(baseInput, SYNTHETIC);
    expect(r.irsWithholding).toBe(100); // 1500*0.2 - 200
    expect(r.socialSecurity).toBeCloseTo(165, 10); // 1500*0.11
    expect(r.netMonthly).toBeCloseTo(1235, 10); // 1500 - 100 - 165
    expect(r.isWithholdingEstimate).toBe(true);
  });

  it("applies dependents through the bracket deduction", () => {
    const r = computeNetWage({ ...baseInput, dependents: 2 }, SYNTHETIC);
    expect(r.irsWithholding).toBe(40); // 100 - 30*2
  });

  it("withholds nothing in the exempt bracket", () => {
    const r = computeNetWage({ ...baseInput, grossMonthly: 800 }, SYNTHETIC);
    expect(r.irsWithholding).toBe(0);
    expect(r.netMonthly).toBeCloseTo(712, 10); // 800 - 0 - 88
  });

  it("rejects a region that does not match the dataset", () => {
    expect(() => computeNetWage({ ...baseInput, region: "madeira" }, SYNTHETIC)).toThrow(
      /does not match/,
    );
  });

  it("rejects a non-integer dependent count", () => {
    expect(() => computeNetWage({ ...baseInput, dependents: 1.5 }, SYNTHETIC)).toThrow(
      /non-negative integer/,
    );
  });
});
