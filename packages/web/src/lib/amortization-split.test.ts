// The chart's job is to make one claim: early instalments are mostly interest.
// These pin that the claim is true of the numbers, not just of the drawing —
// and that the totals still reconcile with the engine's own.

import { describe, expect, it } from "vitest";
import { amortize, monthlyPayment } from "@pt-finance-tools/engine";
import { buildAmortizationSplit } from "./amortization-split.js";

const split = buildAmortizationSplit(250_000, 0.032, 40)!;

describe("buildAmortizationSplit — the shape of a mortgage", () => {
  it("has one row per year of the contract", () => {
    expect(split.years).toHaveLength(40);
    expect(split.years[0]?.year).toBe(1);
    expect(split.years[39]?.year).toBe(40);
  });

  it("starts out mostly interest, which is the whole point of the chart", () => {
    // Nearly three quarters of the first instalment is rent on the money.
    expect(split.firstMonthInterestShare).toBeCloseTo(0.721, 3);
    // And what is left barely dents a 250 000 € debt.
    expect(split.firstMonthPrincipal).toBeCloseTo(257.35, 2);
  });

  it("crosses over around the middle, which is not a stable enough fact to lead with", () => {
    // Pinned because the chart marks it, but the copy leans on the halfway
    // balance instead: this number swings from year 3 to year 22 across
    // ordinary loans, so it cannot carry the explanation.
    expect(split.crossoverYear).toBe(19);
  });

  it("front-loads about 70 % of the interest into the first half", () => {
    expect(split.interestInFirstHalf).toBeCloseTo(0.7, 2);
  });

  it("still owes about two thirds at the halfway mark", () => {
    // The durable fact, and the one the copy states.
    expect(split.halfway.year).toBe(20);
    expect(split.halfway.shareOutstanding).toBeCloseTo(0.655, 3);
    expect(split.halfway.balance).toBeCloseTo(163_640, 0);
  });

  it("ends at a zero balance", () => {
    expect(split.years[39]?.balance).toBe(0);
  });

  it("shifts from interest to capital monotonically", () => {
    // A constant instalment means the two series are mirror images: every
    // year pays a little less interest and a little more capital than the
    // one before, with no exceptions to explain away.
    for (let i = 1; i < split.years.length; i++) {
      expect(split.years[i]!.interest).toBeLessThan(split.years[i - 1]!.interest);
      expect(split.years[i]!.principal).toBeGreaterThan(
        split.years[i - 1]!.principal,
      );
    }
  });
});

describe("buildAmortizationSplit — what the copy is allowed to claim", () => {
  // The component states the halfway balance and the first-half interest share
  // as though they were general facts about mortgages. They very nearly are,
  // and this is the guard that stops that wording outliving its truth.
  const shapes = [
    { principal: 250_000, rate: 0.032, years: 40 },
    { principal: 250_000, rate: 0.032, years: 30 },
    { principal: 214_265, rate: 0.0356, years: 40 },
    { principal: 120_000, rate: 0.03, years: 25 },
    { principal: 80_000, rate: 0.045, years: 20 },
  ];

  it.each(shapes)(
    "still owes 55–70 % half way through $principal @ $rate over $years years",
    ({ principal, rate, years }) => {
      const shape = buildAmortizationSplit(principal, rate, years)!;
      expect(shape.halfway.shareOutstanding).toBeGreaterThan(0.55);
      expect(shape.halfway.shareOutstanding).toBeLessThan(0.7);
    },
  );

  it.each(shapes)(
    "pays 65–75 % of all interest in the first half of $years years",
    ({ principal, rate, years }) => {
      const shape = buildAmortizationSplit(principal, rate, years)!;
      expect(shape.interestInFirstHalf).toBeGreaterThan(0.65);
      expect(shape.interestInFirstHalf).toBeLessThan(0.75);
    },
  );
});

describe("buildAmortizationSplit — reconciliation", () => {
  it("adds its yearly interest back up to the engine's total", () => {
    const summed = split.years.reduce((sum, year) => sum + year.interest, 0);
    expect(summed).toBeCloseTo(amortize(250_000, 0.032, 480).totalInterest, 4);
    expect(split.totalInterest).toBeCloseTo(summed, 6);
  });

  it("adds its yearly capital back up to the principal", () => {
    const summed = split.years.reduce((sum, year) => sum + year.principal, 0);
    expect(summed).toBeCloseTo(250_000, 4);
  });

  it("pays the same instalment every month, split differently", () => {
    const payment = monthlyPayment(250_000, 0.032, 480);
    for (const year of split.years) {
      expect(year.interest + year.principal).toBeCloseTo(payment * 12, 4);
    }
  });
});

describe("buildAmortizationSplit — the cases with no chart to draw", () => {
  it("returns null when there is nothing borrowed", () => {
    expect(buildAmortizationSplit(0, 0.032, 40)).toBeNull();
    expect(buildAmortizationSplit(-1, 0.032, 40)).toBeNull();
  });

  it("returns null for a zero term", () => {
    expect(buildAmortizationSplit(250_000, 0.032, 0)).toBeNull();
  });

  it("handles a zero rate, where there is no interest to shift", () => {
    const free = buildAmortizationSplit(120_000, 0, 10)!;
    expect(free.totalInterest).toBeCloseTo(0, 8);
    expect(free.firstMonthInterestShare).toBe(0);
    // With no interest to overtake, capital leads from the first year.
    expect(free.crossoverYear).toBe(1);
  });

  it("crosses over in year one on a short, cheap loan", () => {
    const short = buildAmortizationSplit(10_000, 0.03, 5)!;
    expect(short.years).toHaveLength(5);
    expect(short.crossoverYear).toBe(1);
  });
});
