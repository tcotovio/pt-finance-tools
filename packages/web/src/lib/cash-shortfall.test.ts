import { describe, expect, it } from "vitest";
import { maxPropertyPriceForDate } from "@pt-finance-tools/engine";
import type { MaxPriceInput } from "@pt-finance-tools/engine";
import { buildCapacityTarget, buildShortfall } from "./cash-shortfall.js";

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

describe("buildCapacityTarget", () => {
  const result = maxPropertyPriceForDate(guaranteed);

  it("finds the cash needed to borrow everything the income allows", () => {
    const target = buildCapacityTarget(guaranteed, result, 0)!;
    expect(target).not.toBeNull();
    expect(target.loan).toBeCloseTo(result.loanResult.dsti.maxLoan, 6);

    // At that savings level the loan really does reach the ceiling.
    const at = maxPropertyPriceForDate({
      ...guaranteed,
      savings: target.savingsNeeded,
    });
    expect(at.loan).toBeGreaterThanOrEqual(target.loan - 1);
  });

  it("is a genuine threshold: a little less does not reach it", () => {
    const target = buildCapacityTarget(guaranteed, result, 0)!;
    const below = maxPropertyPriceForDate({
      ...guaranteed,
      savings: target.savingsNeeded - 50,
    });
    expect(below.loan).toBeLessThan(target.loan - 1);
  });

  it("is far above the floor — the distinction the panel exists to make", () => {
    // Being short by the cost of the deed reads as "find that and I can borrow
    // the maximum". It is not: reaching the maximum also means covering the
    // deposit and the taxes on a real purchase.
    const target = buildCapacityTarget(guaranteed, result, 0)!;
    expect(target.savingsNeeded).toBeGreaterThan(result.cashNeeded * 4);
  });

  it("shows the state guarantee doing its job", () => {
    // Same buyer, same income ceiling: without the guarantee the deposit has
    // to come from savings, and the requirement multiplies.
    const withoutGuarantee = { ...guaranteed, stateGuarantee: false };
    const plain = maxPropertyPriceForDate(withoutGuarantee);
    const a = buildCapacityTarget(guaranteed, result, 0)!;
    const b = buildCapacityTarget(withoutGuarantee, plain, 0)!;
    expect(b.loan).toBeCloseTo(a.loan, 6);
    expect(b.savingsNeeded).toBeGreaterThan(a.savingsNeeded * 5);
  });

  it("counts what the buyer already has", () => {
    const target = buildCapacityTarget(guaranteed, result, 400)!;
    const bare = buildCapacityTarget(guaranteed, result, 0)!;
    expect(target.stillMissing).toBeCloseTo(bare.savingsNeeded - 400, 6);
  });

  it("never reports a negative gap", () => {
    const target = buildCapacityTarget(guaranteed, result, 10_000_000)!;
    expect(target.stillMissing).toBe(0);
  });

  it("returns null when the income supports no loan at all", () => {
    const broke = { ...guaranteed, borrower: { monthlyIncome: 0, age: 30 } };
    const result0 = maxPropertyPriceForDate(broke);
    expect(buildCapacityTarget(broke, result0, 0)).toBeNull();
  });
});

describe("the target explains itself", () => {
  const result = maxPropertyPriceForDate(guaranteed);

  it("itemises the cash, deposit included", () => {
    // Evaluated at a nominal price the charges are a few hundred euros of
    // notary; at the price the loan actually buys, the deposit dominates. The
    // deposit is also the only part most people can act on.
    const target = buildCapacityTarget(guaranteed, result, 0)!;
    expect(target.lines.length).toBeGreaterThan(0);
    const total = target.lines.reduce((sum, l) => sum + l.amount, 0);
    expect(total).toBeCloseTo(target.savingsNeeded, -1);
  });

  it("orders the itemisation largest first", () => {
    const amounts = buildCapacityTarget(guaranteed, result, 0)!.lines.map(
      (l) => l.amount,
    );
    expect([...amounts].sort((a, b) => b - a)).toEqual(amounts);
  });

  it("reports the cash as a share of the price, so any house can be scaled", () => {
    const target = buildCapacityTarget(guaranteed, result, 0)!;
    expect(target.shareOfPrice).toBeGreaterThan(0);
    expect(target.shareOfPrice).toBeLessThan(1);
    expect(target.shareOfPrice * target.price).toBeCloseTo(
      target.savingsNeeded,
      -1,
    );
  });

  it("puts the deposit at the top without the state guarantee", () => {
    // With a 90 % ceiling the deposit is an order of magnitude above every
    // charge beside it, and the panel should say so first.
    const withoutGuarantee = { ...guaranteed, stateGuarantee: false };
    const plain = maxPropertyPriceForDate(withoutGuarantee);
    const target = buildCapacityTarget(withoutGuarantee, plain, 0)!;
    expect(target.lines[0].key).toBe("deposit");
    expect(target.lines[0].amount).toBeGreaterThan(target.savingsNeeded * 0.7);
  });
});
