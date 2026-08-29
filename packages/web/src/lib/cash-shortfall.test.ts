import { describe, expect, it } from "vitest";
import { maxPropertyPriceForDate } from "@pt-finance-tools/engine";
import type { MaxPriceInput } from "@pt-finance-tools/engine";
import { buildOutlook, buildShortfall } from "./cash-shortfall.js";

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

describe("buildOutlook", () => {
  const result = maxPropertyPriceForDate(guaranteed);

  it("reports the loan the income alone supports", () => {
    // The reassuring half: the buyer is not short of borrowing power. It is
    // independent of savings, so it holds even when nothing is affordable.
    const outlook = buildOutlook(guaranteed, result);
    expect(outlook.incomeLoanCeiling).toBeGreaterThan(100_000);
  });

  it("starts the rungs ABOVE the shortfall, never at it", () => {
    // The trap this exists to avoid: covering exactly the shortfall buys
    // essentially nothing. The floor pays for a NOMINAL purchase, and every
    // euro of real price wants more cash on top — so the reachable price
    // there is a rounding error beside what the income could support, and
    // answering "what would the missing money buy?" with it would be a
    // non-answer.
    const outlook = buildOutlook(guaranteed, result);
    const atExactly = maxPropertyPriceForDate({
      ...guaranteed,
      savings: Math.ceil(result.cashNeeded),
    });
    expect(atExactly.maxPrice).toBeLessThan(outlook.incomeLoanCeiling / 100);
    for (const step of outlook.steps) {
      expect(step.savings).toBeGreaterThan(result.cashNeeded);
      expect(step.price).toBeGreaterThan(0);
    }
  });

  it("rounds the rungs to figures a person would recognise", () => {
    for (const step of buildOutlook(guaranteed, result).steps) {
      expect(step.savings % 50).toBe(0);
    }
  });

  it("climbs: more savings, more house", () => {
    const steps = buildOutlook(guaranteed, result).steps;
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i].savings).toBeGreaterThan(steps[i - 1].savings);
      expect(steps[i].price).toBeGreaterThanOrEqual(steps[i - 1].price);
    }
  });

  it("says when cash stops being the constraint", () => {
    // Past that rung more savings buy almost nothing, and the honest thing is
    // to stop implying they would.
    const steps = buildOutlook(guaranteed, result).steps;
    const capped = steps.filter((s) => s.incomeCapped);
    expect(capped.length).toBeGreaterThan(0);
    expect(steps[steps.length - 1].incomeCapped).toBe(true);
    expect(steps[0].incomeCapped).toBe(false);
  });
});
