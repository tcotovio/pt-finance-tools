// Taxa mista — Instrução 23/2023 art. 1.º n.º 2.
//
// Expectations come from the statute's own words and from structural
// invariants, not from a re-run of the implementation: the tested instalment
// is the HIGHER of the two legs, the post-fixed leg is computed on the balance
// outstanding when the fixed period ends, and the shock band comes from the
// contract's duration rather than the fixed period's.

import { describe, expect, it } from "vitest";
import {
  balanceAfter,
  mixedPrincipalForBudget,
  mixedStressedPayment,
} from "./mixed.js";
import { monthlyPayment } from "./amortization.js";
import { maxLoan } from "./max-loan.js";
import { shockForTerm } from "./stress.js";
import { BDP_2026 } from "../data/bdp-2026.js";
import { INTEREST_RATE_SHOCK_2023 } from "../data/interest-rate-shock-2023.js";
import type { MaxLoanInput } from "../types.js";

const terms = { fixedPeriodYears: 5, fixedRate: 0.031 };

describe("balanceAfter", () => {
  it("owes the whole principal before any payment", () => {
    expect(balanceAfter(200_000, 0.04, 360, 0)).toBeCloseTo(200_000, 6);
  });

  it("owes nothing at the end of the term", () => {
    expect(balanceAfter(200_000, 0.04, 360, 360)).toBeCloseTo(0, 4);
  });

  it("agrees with walking the schedule period by period", () => {
    // The closed form exists for speed; this pins it against the naive
    // simulation it replaces.
    const principal = 150_000;
    const rate = 0.035;
    const total = 360;
    const payment = monthlyPayment(principal, rate, total);
    let balance = principal;
    for (let i = 0; i < 60; i++) {
      balance = balance + balance * (rate / 12) - payment;
    }
    expect(balanceAfter(principal, rate, total, 60)).toBeCloseTo(balance, 6);
  });

  it("repays capital more slowly at a higher rate", () => {
    expect(balanceAfter(200_000, 0.06, 360, 60)).toBeGreaterThan(
      balanceAfter(200_000, 0.02, 360, 60),
    );
  });

  it("rejects a period beyond the contract", () => {
    expect(() => balanceAfter(1000, 0.03, 120, 121)).toThrow(/must not exceed/);
  });
});

describe("mixedStressedPayment", () => {
  it("takes the post-fixed leg when the shocked indexed rate is dearer", () => {
    const result = mixedStressedPayment(200_000, terms, 0.035, 0.015, 360);
    expect(result.basis).toBe("post-fixed");
    expect(result.stressedPayment).toBe(result.postFixedPayment);
    expect(result.postFixedPayment).toBeGreaterThan(result.fixedPeriodPayment);
  });

  it("takes the fixed leg when it is dearer (al. b)", () => {
    // A high fixed teaser followed by a cheap indexed rate: al. b) exists
    // precisely so this does not test as cheap.
    const expensiveFixed = { fixedPeriodYears: 5, fixedRate: 0.09 };
    const result = mixedStressedPayment(200_000, expensiveFixed, 0.01, 0.015, 360);
    expect(result.basis).toBe("fixed-period");
    expect(result.stressedPayment).toBe(result.fixedPeriodPayment);
  });

  it("computes the post-fixed leg on the balance and the remaining term", () => {
    const result = mixedStressedPayment(200_000, terms, 0.035, 0.015, 360);
    expect(result.balanceAtSwitch).toBeCloseTo(
      balanceAfter(200_000, terms.fixedRate, 360, 60),
      6,
    );
    // Not on the original capital over the original term — that would be a
    // different, and wrong, number.
    expect(result.postFixedPayment).toBeCloseTo(
      monthlyPayment(result.balanceAtSwitch, 0.05, 300),
      6,
    );
    expect(result.postFixedPayment).not.toBeCloseTo(
      monthlyPayment(200_000, 0.05, 360),
      2,
    );
  });

  it("adds the shock to the indexed rate only", () => {
    const result = mixedStressedPayment(200_000, terms, 0.035, 0.015, 360);
    expect(result.stressedPostFixedRate).toBeCloseTo(0.05, 10);
  });

  it("scales linearly with the principal", () => {
    // What lets the reverse solver invert analytically.
    const one = mixedStressedPayment(1, terms, 0.035, 0.015, 360).stressedPayment;
    const many = mixedStressedPayment(250_000, terms, 0.035, 0.015, 360)
      .stressedPayment;
    expect(many).toBeCloseTo(one * 250_000, 6);
  });

  it("rejects a fixed period as long as the contract", () => {
    expect(() =>
      mixedStressedPayment(200_000, { fixedPeriodYears: 30, fixedRate: 0.03 }, 0.035, 0.015, 360),
    ).toThrow(/taxa fixa, not taxa mista/);
  });

  it("rejects a zero-length fixed period", () => {
    expect(() =>
      mixedStressedPayment(200_000, { fixedPeriodYears: 0, fixedRate: 0.03 }, 0.035, 0.015, 360),
    ).toThrow(/greater than zero/);
  });
});

describe("mixedPrincipalForBudget", () => {
  it("inverts mixedStressedPayment exactly", () => {
    const principal = mixedPrincipalForBudget(1200, terms, 0.035, 0.015, 360);
    expect(
      mixedStressedPayment(principal, terms, 0.035, 0.015, 360).stressedPayment,
    ).toBeCloseTo(1200, 6);
  });

  it("buys nothing with no budget", () => {
    expect(mixedPrincipalForBudget(0, terms, 0.035, 0.015, 360)).toBe(0);
  });
});

describe("maxLoan with taxa mista", () => {
  const base: MaxLoanInput = {
    borrower: { monthlyIncome: 2000, age: 30 },
    purpose: "own-permanent-residence",
    propertyPrice: 10_000_000,
    annualRate: 0.035,
    rateType: "mixed",
    mixedTerms: terms,
    termYears: 30,
    assessmentDate: "2026-09-01",
  };
  const solve = (i: MaxLoanInput) => maxLoan(i, BDP_2026, INTEREST_RATE_SHOCK_2023);

  it("puts the tested instalment exactly on the 45 % ceiling", () => {
    const result = solve(base);
    const tested = mixedStressedPayment(
      result.maxLoan,
      terms,
      base.annualRate,
      result.dsti.shock,
      360,
    ).stressedPayment;
    expect(tested / result.dsti.adjustedIncome).toBeCloseTo(0.45, 8);
  });

  it("reports which leg governed", () => {
    expect(solve(base).dsti.mixedBasis).toBe("post-fixed");
    expect(
      solve({ ...base, mixedTerms: { fixedPeriodYears: 5, fixedRate: 0.09 } })
        .dsti.mixedBasis,
    ).toBe("fixed-period");
  });

  it("quotes the instalment the borrower actually starts paying", () => {
    // During the fixed period — not the stressed one, and not the post-fixed.
    const result = solve(base);
    expect(result.contractPayment).toBeCloseTo(
      monthlyPayment(result.maxLoan, terms.fixedRate, 360),
      6,
    );
  });

  it("takes the shock band from the contract's duration, not the fixed period", () => {
    // 30-year contract with 5 fixed years: 1,5 p.p., not the 0,5 p.p. that a
    // 5-year contract would take.
    const result = solve(base);
    expect(result.dsti.shock).toBeCloseTo(0.015, 10);
    expect(shockForTerm(30, INTEREST_RATE_SHOCK_2023)).toBeCloseTo(0.015, 10);
  });

  it("lends more than a pure variable contract at the same indexed rate", () => {
    // The fixed years are cheaper than the shocked rate, and the post-fixed
    // leg is computed on an already-amortized balance.
    const mixed = solve(base);
    const variable = solve({ ...base, rateType: "variable", mixedTerms: undefined });
    expect(mixed.maxLoan).toBeGreaterThan(variable.maxLoan);
  });

  it("still respects the LTV ceiling", () => {
    const result = solve({ ...base, propertyPrice: 150_000 });
    expect(result.bindingConstraint).toBe("ltv");
    expect(result.maxLoan).toBeCloseTo(135_000, 6);
  });

  it("refuses mixed without its terms", () => {
    expect(() => solve({ ...base, mixedTerms: undefined })).toThrow(
      /requires mixedTerms/,
    );
  });
});
