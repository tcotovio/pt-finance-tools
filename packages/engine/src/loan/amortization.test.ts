// French amortization.
//
// Expectations come from three independent places, deliberately — a test that
// only re-runs the formula proves nothing (PLAN.md §6):
//
//   * published textbook annuities (200 000 @ 6 % / 30 y = 1 199,10) that any
//     mortgage table agrees on;
//   * structural invariants the arithmetic must satisfy whatever the formula
//     (the schedule's capital parts sum to the principal, period 1's interest
//     is balance × rate, the balance closes at zero);
//   * round-tripping the forward and reverse directions against each other.

import { describe, expect, it } from "vitest";
import {
  amortize,
  amortizationSchedule,
  monthlyPayment,
  monthlyRate,
  principalForPayment,
} from "./amortization.js";

describe("monthlyRate", () => {
  it("divides the nominal annual rate by 12", () => {
    expect(monthlyRate(0.06)).toBeCloseTo(0.005, 12);
  });

  it("rejects a negative rate", () => {
    expect(() => monthlyRate(-0.01)).toThrow(/must not be negative/);
  });
});

describe("monthlyPayment", () => {
  it("matches the published annuity for 200 000 at 6 % over 30 years", () => {
    expect(monthlyPayment(200_000, 0.06, 360)).toBeCloseTo(1199.1, 2);
  });

  it("matches the published annuity for 100 000 at 5 % over 30 years", () => {
    expect(monthlyPayment(100_000, 0.05, 360)).toBeCloseTo(536.82, 2);
  });

  it("splits the principal evenly at a zero rate", () => {
    // Not a degenerate guard: interest-free credit exists, and the annuity
    // formula divides by zero there. The limit is P / n.
    expect(monthlyPayment(100_000, 0, 100)).toBeCloseTo(1000, 10);
  });

  it("rejects a non-integer or non-positive term", () => {
    expect(() => monthlyPayment(1000, 0.05, 12.5)).toThrow(/positive integer/);
    expect(() => monthlyPayment(1000, 0.05, 0)).toThrow(/positive integer/);
  });

  it("rejects a negative principal", () => {
    expect(() => monthlyPayment(-1, 0.05, 12)).toThrow(/must not be negative/);
  });
});

describe("principalForPayment", () => {
  it("inverts monthlyPayment exactly", () => {
    const principal = 237_450.19;
    const payment = monthlyPayment(principal, 0.0412, 420);
    expect(principalForPayment(payment, 0.0412, 420)).toBeCloseTo(principal, 6);
  });

  it("inverts at a zero rate too", () => {
    expect(principalForPayment(1000, 0, 100)).toBeCloseTo(100_000, 10);
  });

  it("buys no loan with no budget", () => {
    expect(principalForPayment(0, 0.05, 360)).toBe(0);
  });
});

describe("amortize", () => {
  it("reports what the loan costs over its life", () => {
    const result = amortize(200_000, 0.06, 360);
    expect(result.monthlyPayment).toBeCloseTo(1199.1, 2);
    expect(result.totalPaid).toBeCloseTo(result.monthlyPayment * 360, 10);
    expect(result.totalInterest).toBeCloseTo(result.totalPaid - 200_000, 10);
    // Over 30 years at 6 % the interest exceeds the capital borrowed — worth
    // pinning, because it is the number that surprises borrowers most.
    expect(result.totalInterest).toBeGreaterThan(200_000);
  });

  it("charges no interest at a zero rate", () => {
    expect(amortize(50_000, 0, 60).totalInterest).toBeCloseTo(0, 10);
  });
});

describe("amortizationSchedule", () => {
  const principal = 150_000;
  const schedule = amortizationSchedule(principal, 0.035, 360);

  it("has one row per month", () => {
    expect(schedule).toHaveLength(360);
    expect(schedule[0].period).toBe(1);
    expect(schedule[359].period).toBe(360);
  });

  it("charges the first month's interest on the full balance", () => {
    expect(schedule[0].interest).toBeCloseTo(principal * (0.035 / 12), 10);
  });

  it("repays exactly the principal in capital", () => {
    const capital = schedule.reduce((sum, p) => sum + p.principal, 0);
    expect(capital).toBeCloseTo(principal, 6);
  });

  it("closes at exactly zero", () => {
    // Forced, not merely near-zero: the sub-cent residue of 360 real-valued
    // instalments is an artefact of the arithmetic, not a debt.
    expect(schedule[359].balance).toBe(0);
  });

  it("shifts from interest to capital over the life of the loan", () => {
    expect(schedule[0].interest).toBeGreaterThan(schedule[0].principal);
    expect(schedule[359].principal).toBeGreaterThan(schedule[359].interest);
  });

  it("keeps the instalment constant", () => {
    const first = schedule[0].payment;
    expect(schedule.every((p) => p.payment === first)).toBe(true);
  });
});
