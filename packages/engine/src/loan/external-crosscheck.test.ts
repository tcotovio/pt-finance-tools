// Axis B for the loan side: the engine end-to-end against an INDEPENDENT
// implementation of the same rules.
//
// Axis A already proves the limits were transcribed correctly. It cannot
// prove they are *applied* the way the Recomendação intends — right income in
// the denominator, right instalment stressed, right inversion of the annuity.
// Only comparing against something that implemented the rules separately can,
// and this is that comparison (PLAN.md §6).
//
// SCOPE. Only legally determined outputs are compared: the payment budget and
// the loan it supports. Commercial pricing — spread, bundling, a bank's own
// credit policy, the 10 % exception allowance — is deliberately outside the
// claim, because it is a decision rather than a computation and nothing in
// this engine asserts it. The comparison is possible at all because the
// source states its own arithmetic (Euribor 12M 2,798 % + 0,7 spread, then
// the 1,5 p.p. shock), so the rate can be held constant on both sides.
//
// WHAT IT COVERS: the 45 % ceiling, income as the denominator, existing debt
// entering the numerator at FACE VALUE while only the new instalment is
// stressed, the shock itself, and the inversion of the annuity across five
// terms from 20 to 40 years.
//
// WHAT IT DOES NOT: the LTV ceiling (this source takes no property price) and
// the past-70 income reduction — see the divergence below.

import { describe, expect, it } from "vitest";
import fixture from "./fixtures/credivel-2026.json" with { type: "json" };
import { maxLoan } from "./max-loan.js";
import { incomeReductionFraction } from "./stress.js";
import { BDP_2026 } from "../data/bdp-2026.js";
import { INTEREST_RATE_SHOCK_2023 } from "../data/interest-rate-shock-2023.js";
import type { MaxLoanInput } from "../types.js";

interface Scenario {
  label: string;
  monthlyIncome: number;
  age: number;
  existingMonthlyDebt: number;
  termYears: number;
  expectedMaxPayment: number;
  expectedMaxLoan: number;
}

function solve(scenario: Scenario) {
  const input: MaxLoanInput = {
    borrower: {
      monthlyIncome: scenario.monthlyIncome,
      age: scenario.age,
      existingMonthlyDebt: scenario.existingMonthlyDebt || undefined,
    },
    purpose: "own-permanent-residence",
    // Large enough that the DSTI always binds: this source models no LTV, so
    // letting the property cap the answer would compare different rules.
    propertyPrice: 10_000_000,
    annualRate: fixture.contractRate,
    termYears: scenario.termYears,
    assessmentDate: "2026-09-01",
  };
  return maxLoan(input, BDP_2026, INTEREST_RATE_SHOCK_2023);
}

describe("provenance", () => {
  it("compares against a source that says it implements Recomendação 1/2026", () => {
    expect(fixture.statedRegime).toContain("Recomendação Macroprudencial n.º 1/2026");
  });

  it("holds the rate constant using the source's stated arithmetic", () => {
    // 2,798 % (Euribor 12M) + 0,7 % (spread) — the shock is added by each
    // side's own implementation, which is precisely what is being compared.
    expect(fixture.statedBasis).toContain("2,798%");
    expect(fixture.statedBasis).toContain("1,5");
    expect(fixture.contractRate).toBeCloseTo(0.02798 + 0.007, 10);
  });

  it("sees the same stressed rate the source states (4,998 %)", () => {
    const result = solve(fixture.scenarios[0] as Scenario);
    expect(result.dsti.stressedRate).toBeCloseTo(0.04998, 10);
  });
});

describe("Axis B — engine vs the Crédivel simulator", () => {
  for (const scenario of fixture.scenarios as Scenario[]) {
    describe(scenario.label, () => {
      const result = solve(scenario);

      it("computes the same monthly budget", () => {
        expect(result.dsti.paymentBudget).toBeCloseTo(
          scenario.expectedMaxPayment,
          2,
        );
      });

      it("computes the same maximum loan, to the euro", () => {
        // Their figure is rounded to the euro, so the tolerance is that
        // rounding and nothing more.
        expect(result.dsti.maxLoan).toBeCloseTo(scenario.expectedMaxLoan, -0.5);
        expect(Math.abs(result.dsti.maxLoan - scenario.expectedMaxLoan)).
          toBeLessThan(1);
      });
    });
  }

  it("agrees on every scenario it should", () => {
    expect(fixture.scenarios).toHaveLength(7);
  });
});

describe("Known divergence: the past-70 income reduction", () => {
  // Recomendação art. 4.º n.º 5 al. b) reduces the income considered when the
  // contract ends after 70, weighted by the share of it lived past that age.
  // This source does not implement it — it takes only an age *band* (≤35 /
  // >35), which cannot express the weighting at all.
  //
  // The statute wins, exactly as it did for the duodécimos gap in §6.1. The
  // divergence is recorded here rather than hidden, and pinned to its exact
  // cause: remove the reduction and the two sides agree to the euro.
  for (const scenario of fixture.divergentScenarios as Scenario[]) {
    describe(scenario.label, () => {
      const result = solve(scenario);

      it("is lower than the source, by the reduction and only the reduction", () => {
        expect(result.dsti.maxLoan).toBeLessThan(scenario.expectedMaxLoan);

        const reduction = incomeReductionFraction(
          { monthlyIncome: scenario.monthlyIncome, age: scenario.age },
          scenario.termYears,
          BDP_2026,
        );
        expect(reduction).toBeGreaterThan(0);

        // Undo the haircut and the two implementations coincide.
        const unreduced = solve({
          ...scenario,
          // Ending exactly at 70 does not trigger "superior a 70 anos".
          age: 70 - scenario.termYears,
        });
        expect(unreduced.dsti.maxLoan).toBeCloseTo(scenario.expectedMaxLoan, -0.5);
      });

      it("keeps the gap proportional to the reduction", () => {
        const gap = 1 - result.dsti.maxLoan / scenario.expectedMaxLoan;
        const reduction = incomeReductionFraction(
          { monthlyIncome: scenario.monthlyIncome, age: scenario.age },
          scenario.termYears,
          BDP_2026,
        );
        // The budget shrinks by the reduction, and the loan is linear in the
        // budget — but existing debt is subtracted after the haircut, so the
        // loan gap is at least the income gap.
        expect(gap).toBeGreaterThanOrEqual(reduction - 1e-9);
      });
    });
  }
});
