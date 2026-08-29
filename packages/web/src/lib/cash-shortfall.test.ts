import { describe, expect, it } from "vitest";
import { maxPropertyPriceForDate } from "@pt-finance-tools/engine";
import type { MaxPriceInput } from "@pt-finance-tools/engine";
import { buildShortfall } from "./cash-shortfall.js";

const base: MaxPriceInput = {
  borrower: { monthlyIncome: 2000, age: 30 },
  savings: 0,
  purpose: "own-permanent-residence",
  region: "continente",
  annualRate: 0.033,
  termYears: 40,
  assessmentDate: "2026-09-01",
};

/** The state-guarantee, young-first-home case the user hits with no savings. */
const guaranteed: MaxPriceInput = {
  ...base,
  youngFirstHome: true,
  stateGuarantee: true,
};

describe("buildShortfall", () => {
  it("quantifies the gap instead of just refusing", () => {
    const result = maxPropertyPriceForDate(guaranteed);
    expect(result.maxPrice).toBe(0);

    const shortfall = buildShortfall(result, 0);
    expect(shortfall.needed).toBeGreaterThan(0);
    expect(shortfall.missing).toBeCloseTo(shortfall.needed, 6);
  });

  it("shrinks the gap as savings rise", () => {
    const result = maxPropertyPriceForDate({ ...guaranteed, savings: 150 });
    const shortfall = buildShortfall(result, 150);
    expect(shortfall.missing).toBeCloseTo(shortfall.needed - 150, 6);
    expect(shortfall.missing).toBeLessThan(buildShortfall(result, 0).missing);
  });

  it("never reports a negative gap", () => {
    const result = maxPropertyPriceForDate(guaranteed);
    expect(buildShortfall(result, 1_000_000).missing).toBe(0);
  });

  it("names what the money is for", () => {
    const shortfall = buildShortfall(maxPropertyPriceForDate(guaranteed), 0);
    expect(shortfall.lines.length).toBeGreaterThan(0);
    // Deed and registration are the irreducible part: no credit covers them.
    expect(shortfall.lines.map((l) => l.key)).toContain("registration");
  });

  it("drops the sub-euro artefacts of the nominal evaluation", () => {
    // The costs are evaluated at a nominal price, so the selo do crédito comes
    // out at a cent or two. Shown as a line it would read as a real charge and
    // suggest the selo is negligible — on a real purchase it is a percentage
    // of the amount borrowed.
    const shortfall = buildShortfall(maxPropertyPriceForDate(guaranteed), 0);
    for (const line of shortfall.lines) {
      expect(line.amount).toBeGreaterThanOrEqual(1);
    }
  });

  it("orders the charges largest first", () => {
    const shortfall = buildShortfall(maxPropertyPriceForDate(base), 0);
    const amounts = shortfall.lines.map((l) => l.amount);
    expect([...amounts].sort((a, b) => b - a)).toEqual(amounts);
  });

  it("reports the young exemption when it applied", () => {
    expect(buildShortfall(maxPropertyPriceForDate(guaranteed), 0).exemptYoung).toBe(
      true,
    );
  });

  it("reports no young exemption when the buyer did not claim it", () => {
    const plain = maxPropertyPriceForDate({ ...base, stateGuarantee: true });
    expect(buildShortfall(plain, 0).exemptYoung).toBe(false);
  });
});
