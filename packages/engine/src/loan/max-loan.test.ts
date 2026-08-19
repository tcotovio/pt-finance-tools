// The reverse solver: max loan from income, under Recomendação 1/2026.
//
// The DSTI expectations are checked by *reconstructing the ratio* from the
// answer — stress the instalment the solver says is affordable, add existing
// debt, divide by the adjusted income, and it must land exactly on 45 %. That
// is a real check rather than a restatement of the formula: it fails if the
// annuity, the shock band, the income reduction or the budget arithmetic is
// wrong anywhere.

import { describe, expect, it } from "vitest";
import { maxLoan, stressedDsti } from "./max-loan.js";
import { monthlyPayment } from "./amortization.js";
import { adjustedIncome } from "./stress.js";
import { BDP_2026 } from "../data/bdp-2026.js";
import { INTEREST_RATE_SHOCK_2023 } from "../data/interest-rate-shock-2023.js";
import type { MaxLoanInput } from "../types.js";
import { maxLoanForDate } from "../index.js";

const solve = (input: MaxLoanInput) =>
  maxLoan(input, BDP_2026, INTEREST_RATE_SHOCK_2023);

const base: MaxLoanInput = {
  borrower: { monthlyIncome: 2000, age: 30 },
  purpose: "own-permanent-residence",
  propertyPrice: 500_000,
  annualRate: 0.035,
  termYears: 40,
  assessmentDate: "2026-09-01",
};

describe("maxLoan — which limit binds", () => {
  it("is capped by DSTI when the property is expensive relative to income", () => {
    const result = solve(base);
    expect(result.bindingConstraint).toBe("dsti");
    expect(result.maxLoan).toBeCloseTo(result.dsti.maxLoan, 6);
    expect(result.maxLoan).toBeLessThan(result.ltv.maxLoan);
  });

  it("is capped by LTV when income is ample", () => {
    const result = solve({
      ...base,
      borrower: { monthlyIncome: 8000, age: 30 },
      propertyPrice: 200_000,
    });
    expect(result.bindingConstraint).toBe("ltv");
    expect(result.maxLoan).toBeCloseTo(200_000 * 0.9, 6);
  });

  it("applies the stricter 80 % LTV to purposes other than own residence", () => {
    const result = solve({
      ...base,
      borrower: { monthlyIncome: 8000, age: 30 },
      propertyPrice: 200_000,
      purpose: "other",
    });
    expect(result.ltv.limit).toBeCloseTo(0.8, 10);
    expect(result.maxLoan).toBeCloseTo(160_000, 6);
  });

  it("values the property at the lower of price and appraisal (art. 4.º)", () => {
    const result = solve({
      ...base,
      borrower: { monthlyIncome: 8000, age: 30 },
      propertyPrice: 200_000,
      appraisalValue: 180_000,
    });
    expect(result.ltv.propertyValue).toBe(180_000);
    expect(result.maxLoan).toBeCloseTo(180_000 * 0.9, 6);
  });
});

describe("maxLoan — the DSTI ceiling holds exactly", () => {
  it("puts the stressed instalment exactly on 45 % of income", () => {
    const result = solve(base);
    const stressedPayment = monthlyPayment(
      result.maxLoan,
      result.dsti.stressedRate,
      Math.round(result.termYears * 12),
    );
    const ratio = stressedPayment / result.dsti.adjustedIncome;
    expect(ratio).toBeCloseTo(BDP_2026.dstiLimit, 8);
  });

  it("counts existing debt against the same ceiling", () => {
    const result = solve({
      ...base,
      borrower: { monthlyIncome: 2000, age: 30, existingMonthlyDebt: 300 },
    });
    const stressedPayment = monthlyPayment(
      result.maxLoan,
      result.dsti.stressedRate,
      Math.round(result.termYears * 12),
    );
    expect((stressedPayment + 300) / result.dsti.adjustedIncome).toBeCloseTo(
      BDP_2026.dstiLimit,
      8,
    );
    // And it really costs the borrower capacity.
    expect(result.maxLoan).toBeLessThan(solve(base).maxLoan);
  });

  it("stresses only the new contract, not the existing instalments", () => {
    // Art. 6.º n.º 2: existing instalments enter the numerator at face value.
    // If they were stressed too, 300 € of existing debt would cost more
    // capacity than it does here.
    const withDebt = solve({
      ...base,
      borrower: { monthlyIncome: 2000, age: 30, existingMonthlyDebt: 300 },
    });
    const budgetLost =
      solve(base).dsti.paymentBudget - withDebt.dsti.paymentBudget;
    expect(budgetLost).toBeCloseTo(300, 8);
  });

  it("lends nothing when existing debt already breaches the ceiling", () => {
    const result = solve({
      ...base,
      borrower: { monthlyIncome: 2000, age: 30, existingMonthlyDebt: 1500 },
    });
    expect(result.dsti.paymentBudget).toBe(0);
    expect(result.maxLoan).toBe(0);
    expect(result.contractPayment).toBe(0);
  });
});

describe("maxLoan — maturity and the shock band", () => {
  it("caps the term by the older borrower's age", () => {
    const result = solve({
      ...base,
      borrower: { monthlyIncome: 2000, age: 50 },
    });
    expect(result.termYears).toBe(35);
    expect(result.termCappedByAge).toBe(true);
  });

  it("leaves a term within the ceiling alone", () => {
    const result = solve({ ...base, termYears: 30 });
    expect(result.termYears).toBe(30);
    expect(result.termCappedByAge).toBe(false);
  });

  it("takes the shock from the capped term, not the requested one", () => {
    // A 40-year request from a 50-year-old becomes 35 years; both sit in the
    // >10y band, so the shock is 1,5 p.p. either way — pinned so that a
    // future band change cannot silently read the wrong term.
    const result = solve({
      ...base,
      borrower: { monthlyIncome: 2000, age: 50 },
    });
    expect(result.dsti.shock).toBeCloseTo(0.015, 10);
    expect(result.dsti.stressedRate).toBeCloseTo(0.035 + 0.015, 10);
  });

  it("uses a smaller shock for a short contract", () => {
    const result = solve({ ...base, termYears: 5 });
    expect(result.dsti.shock).toBeCloseTo(0.005, 10);
  });

  it("reports the instalment at the contract rate, not the stressed one", () => {
    const result = solve(base);
    const contractual = monthlyPayment(
      result.maxLoan,
      base.annualRate,
      Math.round(result.termYears * 12),
    );
    expect(result.contractPayment).toBeCloseTo(contractual, 8);
    // The borrower pays less than the test they were put through.
    expect(result.contractPayment).toBeLessThan(result.dsti.paymentBudget);
  });
});

describe("maxLoan — income reduction past 70", () => {
  it("reduces capacity for a contract running past 70", () => {
    const young = solve({ ...base, borrower: { monthlyIncome: 2000, age: 30 } });
    const older = solve({ ...base, borrower: { monthlyIncome: 2000, age: 45 } });
    expect(older.dsti.incomeReduction).toBeGreaterThan(0);
    expect(young.dsti.incomeReduction).toBe(0);
    expect(older.dsti.adjustedIncome).toBeLessThan(young.dsti.adjustedIncome);
  });

  it("does not reduce it for a borrower already retired", () => {
    const working = solve({
      ...base,
      borrower: { monthlyIncome: 2000, age: 66 },
    });
    const retired = solve({
      ...base,
      borrower: { monthlyIncome: 2000, age: 66, retired: true },
    });
    expect(retired.dsti.incomeReduction).toBe(0);
    expect(retired.maxLoan).toBeGreaterThan(working.maxLoan);
  });
});

describe("maxLoan — provenance and validation", () => {
  it("carries both parameter sets' sources through to the result", () => {
    const result = solve(base);
    expect(result.sources.macroprudential).toContain("1/2026");
    expect(result.sources.shock).toContain("23/2023");
  });

  it("reports the parameters as unverified until Axis B is done", () => {
    // Deliberate: transcription is cross-checked, but nothing has yet
    // compared the solver end-to-end against a bank simulator (PLAN.md §6).
    expect(solve(base).parametersVerified).toBe(false);
  });

  it("rejects nonsensical inputs", () => {
    expect(() => solve({ ...base, propertyPrice: 0 })).toThrow(/positive/);
    expect(() => solve({ ...base, termYears: 0 })).toThrow(/positive/);
    expect(() =>
      solve({ ...base, borrower: { monthlyIncome: -1, age: 30 } }),
    ).toThrow(/must not be negative/);
  });
});

describe("stressedDsti — the forward check", () => {
  it("returns the ratio a given instalment produces", () => {
    const borrower = { monthlyIncome: 2000, age: 30, existingMonthlyDebt: 100 };
    expect(stressedDsti(800, borrower, 30, BDP_2026)).toBeCloseTo(0.45, 10);
  });

  it("accounts for the income reduction the term implies", () => {
    const borrower = { monthlyIncome: 2000, age: 45 };
    const income = adjustedIncome(borrower, 35, BDP_2026);
    expect(stressedDsti(800, borrower, 35, BDP_2026)).toBeCloseTo(
      800 / income,
      10,
    );
  });

  it("is infinite with no income to service the debt", () => {
    expect(stressedDsti(800, { monthlyIncome: 0, age: 30 }, 30, BDP_2026)).toBe(
      Infinity,
    );
  });
});

describe("maxLoanForDate", () => {
  it("resolves the parameters in force on the assessment date", () => {
    const result = maxLoanForDate(base);
    expect(result.maxLoan).toBeCloseTo(solve(base).maxLoan, 8);
  });

  it("refuses assessments before the 2026 Recomendação applies", () => {
    // The 2018 Recomendação governs those (art. 11.º n.º 3) and is not
    // modelled — better to refuse than to answer with the wrong regime.
    expect(() =>
      maxLoanForDate({ ...base, assessmentDate: "2026-07-31" }),
    ).toThrow(/2018 Recomendação/);
  });
});
