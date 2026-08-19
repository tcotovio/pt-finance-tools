// The DSTI stress adjustments — Instrução 23/2023 art. 1.º and Recomendação
// 1/2026 arts. 4.º n.º 5 and 7.º.
//
// Expectations are read off the statutes' own words, not off the dataset.

import { describe, expect, it } from "vitest";
import {
  adjustedIncome,
  incomeReductionFraction,
  maturityCeiling,
  shockForTerm,
} from "./stress.js";
import { BDP_2026 } from "../data/bdp-2026.js";
import { INTEREST_RATE_SHOCK_2023 } from "../data/interest-rate-shock-2023.js";

const borrower = (age: number, extra: Record<string, unknown> = {}) => ({
  monthlyIncome: 2000,
  age,
  ...extra,
});

describe("shockForTerm", () => {
  it("applies 0,5 p.p. up to 5 years", () => {
    expect(shockForTerm(3, INTEREST_RATE_SHOCK_2023)).toBeCloseTo(0.005, 10);
  });

  it("treats the band bounds as inclusive", () => {
    // "prazo igual ou inferior a 5 anos" — 5 years takes the short band, and
    // 10 years the medium one, not the next one up.
    expect(shockForTerm(5, INTEREST_RATE_SHOCK_2023)).toBeCloseTo(0.005, 10);
    expect(shockForTerm(10, INTEREST_RATE_SHOCK_2023)).toBeCloseTo(0.01, 10);
  });

  it("applies 1 p.p. between 5 and 10 years", () => {
    expect(shockForTerm(7, INTEREST_RATE_SHOCK_2023)).toBeCloseTo(0.01, 10);
  });

  it("applies 1,5 p.p. beyond 10 years", () => {
    expect(shockForTerm(30, INTEREST_RATE_SHOCK_2023)).toBeCloseTo(0.015, 10);
    expect(shockForTerm(40, INTEREST_RATE_SHOCK_2023)).toBeCloseTo(0.015, 10);
  });

  it("rejects a non-positive term", () => {
    expect(() => shockForTerm(0, INTEREST_RATE_SHOCK_2023)).toThrow(
      /positive number/,
    );
  });
});

describe("maturityCeiling", () => {
  it("allows 40 years at or below 35 years of age", () => {
    expect(maturityCeiling(30, BDP_2026)).toBe(40);
    // "idade inferior ou igual a 35 anos" — 35 itself is in the longer band.
    expect(maturityCeiling(35, BDP_2026)).toBe(40);
  });

  it("allows 35 years above that", () => {
    expect(maturityCeiling(36, BDP_2026)).toBe(35);
    expect(maturityCeiling(58, BDP_2026)).toBe(35);
  });
});

describe("incomeReductionFraction", () => {
  it("does not apply when the contract ends at or before 70", () => {
    expect(incomeReductionFraction(borrower(30), 35, BDP_2026)).toBe(0);
    // Ends exactly at 70: "superior a 70 anos" is not satisfied.
    expect(incomeReductionFraction(borrower(35), 35, BDP_2026)).toBe(0);
  });

  it("weights the 20 % by the share of the contract lived past 70", () => {
    // 40 years old on a 35-year loan finishes at 75: 5 of 35 years past the
    // threshold, so 20 % × 5/35 ≈ 2,86 % — NOT a flat 20 %. Getting this
    // wrong understates borrowing capacity for most middle-aged borrowers.
    expect(incomeReductionFraction(borrower(40), 35, BDP_2026)).toBeCloseTo(
      0.2 * (5 / 35),
      10,
    );
  });

  it("reaches the full 20 % only when the whole contract runs past 70", () => {
    expect(incomeReductionFraction(borrower(72), 10, BDP_2026)).toBeCloseTo(
      0.2,
      10,
    );
  });

  it("is waived for a borrower already retired at assessment", () => {
    expect(
      incomeReductionFraction(borrower(68, { retired: true }), 20, BDP_2026),
    ).toBe(0);
  });

  it("grows with the term, all else equal", () => {
    const short = incomeReductionFraction(borrower(50), 20, BDP_2026);
    const long = incomeReductionFraction(borrower(50), 30, BDP_2026);
    expect(long).toBeGreaterThan(short);
  });
});

describe("adjustedIncome", () => {
  it("leaves income untouched when no reduction applies", () => {
    expect(adjustedIncome(borrower(30), 30, BDP_2026)).toBeCloseTo(2000, 10);
  });

  it("removes exactly the weighted fraction", () => {
    const fraction = incomeReductionFraction(borrower(45), 35, BDP_2026);
    expect(adjustedIncome(borrower(45), 35, BDP_2026)).toBeCloseTo(
      2000 * (1 - fraction),
      10,
    );
  });
});
