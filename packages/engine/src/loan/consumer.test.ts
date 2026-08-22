// Crédito ao consumo — Recomendação 1/2026 art. 7.º n.ºs 3–4, on the same
// DSTI machinery as the mortgage side.
//
// Expectations come from the statute's own words and from reconstructing the
// ratio, never from re-running the implementation.

import { describe, expect, it } from "vitest";
import { maxConsumerLoan } from "./consumer.js";
import { monthlyPayment } from "./amortization.js";
import { incomeReductionFraction } from "./stress.js";
import { BDP_2026 } from "../data/bdp-2026.js";
import { INTEREST_RATE_SHOCK_2023 } from "../data/interest-rate-shock-2023.js";
import type { ConsumerLoanInput } from "../types.js";
import { maxConsumerLoanForDate } from "../index.js";

const base: ConsumerLoanInput = {
  borrower: { monthlyIncome: 2000, age: 30 },
  kind: "personal",
  annualRate: 0.09,
  termYears: 7,
  assessmentDate: "2026-09-01",
};

const solve = (input: ConsumerLoanInput) =>
  maxConsumerLoan(input, BDP_2026, INTEREST_RATE_SHOCK_2023);

describe("maturity ceilings come from what the credit is for", () => {
  it("caps crédito pessoal at 7 years (art. 7.º n.º 3 al. a)", () => {
    const result = solve({ ...base, termYears: 12 });
    expect(result.maturityCeiling).toBe(7);
    expect(result.termYears).toBe(7);
    expect(result.termCappedByKind).toBe(true);
  });

  it("caps crédito automóvel at 10 years (al. b)", () => {
    const result = solve({ ...base, kind: "auto", termYears: 12 });
    expect(result.maturityCeiling).toBe(10);
    expect(result.termYears).toBe(10);
  });

  it("lifts earmarked personal credit to 10 years (n.º 4)", () => {
    // Education, health and the energy transition. Conditional on the
    // institution verifying the purpose, which the engine cannot do — it is
    // the caller's assertion.
    const result = solve({ ...base, kind: "personal-earmarked", termYears: 12 });
    expect(result.maturityCeiling).toBe(10);
    expect(result.termYears).toBe(10);
  });

  it("leaves a term within the ceiling alone", () => {
    const result = solve({ ...base, termYears: 5 });
    expect(result.termYears).toBe(5);
    expect(result.termCappedByKind).toBe(false);
  });

  it("ignores the borrower's age, unlike the housing ceilings", () => {
    // Art. 7.º n.º 1's 40/35-year bands are for housing. A 60-year-old and a
    // 30-year-old get the same consumer maturity.
    const young = solve({ ...base, termYears: 12 });
    const old = solve({
      ...base,
      borrower: { monthlyIncome: 2000, age: 60 },
      termYears: 12,
    });
    expect(old.termYears).toBe(young.termYears);
  });
});

describe("these terms finally exercise the short shock bands", () => {
  it("takes 1 p.p. on a 7-year contract", () => {
    // Every mortgage sits in the >10y band at 1,5 p.p.; nothing until now
    // reached the 5–10y band at all.
    expect(solve(base).dsti.shock).toBeCloseTo(0.01, 10);
  });

  it("takes 0,5 p.p. on a contract of 5 years or less", () => {
    expect(solve({ ...base, termYears: 5 }).dsti.shock).toBeCloseTo(0.005, 10);
    expect(solve({ ...base, termYears: 3 }).dsti.shock).toBeCloseTo(0.005, 10);
  });

  it("takes 1,5 p.p. only above 10 years, which no kind allows", () => {
    // The capped term decides the band, so a 12-year request on a 10-year
    // product is still tested at the 10-year band.
    const result = solve({ ...base, kind: "auto", termYears: 12 });
    expect(result.termYears).toBe(10);
    expect(result.dsti.shock).toBeCloseTo(0.01, 10);
  });

  it("applies no shock to a fixed-rate contract", () => {
    const fixed = solve({ ...base, rateType: "fixed" });
    expect(fixed.dsti.shock).toBe(0);
    expect(fixed.maxLoan).toBeGreaterThan(solve(base).maxLoan);
  });
});

describe("the DSTI ceiling holds exactly", () => {
  it("puts the stressed instalment on 45 % of income", () => {
    const result = solve(base);
    const stressed = monthlyPayment(
      result.maxLoan,
      result.dsti.stressedRate,
      Math.round(result.termYears * 12),
    );
    expect(stressed / result.dsti.adjustedIncome).toBeCloseTo(0.45, 8);
  });

  it("counts existing debt against the same ceiling", () => {
    const result = solve({
      ...base,
      borrower: { monthlyIncome: 2000, age: 30, existingMonthlyDebt: 400 },
    });
    expect(result.dsti.paymentBudget).toBeCloseTo(2000 * 0.45 - 400, 8);
    expect(result.maxLoan).toBeLessThan(solve(base).maxLoan);
  });

  it("lends nothing when existing debt already breaches the ceiling", () => {
    const result = solve({
      ...base,
      borrower: { monthlyIncome: 2000, age: 30, existingMonthlyDebt: 900 },
    });
    expect(result.maxLoan).toBe(0);
    expect(result.contractPayment).toBe(0);
    expect(result.totalInterest).toBe(0);
  });

  it("applies the past-70 income reduction, which is a DSTI rule not a housing one", () => {
    const result = solve({
      ...base,
      borrower: { monthlyIncome: 2000, age: 66 },
      kind: "auto",
      termYears: 10,
    });
    const expected = incomeReductionFraction(
      { monthlyIncome: 2000, age: 66 },
      10,
      BDP_2026,
    );
    expect(expected).toBeGreaterThan(0);
    expect(result.dsti.incomeReduction).toBeCloseTo(expected, 10);
  });
});

describe("what it reports", () => {
  it("quotes the instalment at the contract rate, not the stressed one", () => {
    const result = solve(base);
    expect(result.contractPayment).toBeCloseTo(
      monthlyPayment(result.maxLoan, base.annualRate, 84),
      8,
    );
    expect(result.stressedPayment).toBeGreaterThan(result.contractPayment);
  });

  it("carries both parameter sources through", () => {
    const result = solve(base);
    expect(result.sources.macroprudential).toContain("1/2026");
    expect(result.sources.shock).toContain("23/2023");
    expect(result.parametersVerified).toBe(true);
  });

  it("rejects nonsensical inputs", () => {
    expect(() => solve({ ...base, termYears: 0 })).toThrow(/positive/);
    expect(() =>
      solve({ ...base, borrower: { monthlyIncome: -1, age: 30 } }),
    ).toThrow(/must not be negative/);
  });
});

describe("maxConsumerLoanForDate", () => {
  it("resolves the parameters in force on the assessment date", () => {
    expect(maxConsumerLoanForDate(base).maxLoan).toBeCloseTo(
      solve(base).maxLoan,
      8,
    );
  });

  it("refuses assessments before the 2026 Recomendação applies", () => {
    expect(() =>
      maxConsumerLoanForDate({ ...base, assessmentDate: "2026-07-31" }),
    ).toThrow(/2018 Recomendação/);
  });
});
