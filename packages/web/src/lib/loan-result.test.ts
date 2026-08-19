import { describe, expect, it } from "vitest";
import { maxLoanForDate, monthlyPayment } from "@pt-finance-tools/engine";
import type { MaxLoanInput } from "@pt-finance-tools/engine";
import { buildLoanSummary } from "./loan-result.js";

const input = (overrides: Partial<MaxLoanInput> = {}): MaxLoanInput => ({
  borrower: { monthlyIncome: 2000, age: 30 },
  purpose: "own-permanent-residence",
  propertyPrice: 250_000,
  annualRate: 0.032,
  termYears: 40,
  assessmentDate: "2026-09-01",
  ...overrides,
});

const summarize = (i: MaxLoanInput) =>
  buildLoanSummary(
    maxLoanForDate(i),
    i.propertyPrice,
    i.borrower.monthlyIncome,
    i.borrower.existingMonthlyDebt ?? 0,
  );

describe("buildLoanSummary — the headline numbers", () => {
  it("floors the loan to the euro rather than rounding it", () => {
    // A ceiling rounded up is a ceiling overstated. The engine's raw answer
    // carries cents; the displayed one must never exceed it.
    const result = maxLoanForDate(input());
    const summary = summarize(input());
    expect(summary.maxLoan).toBe(Math.floor(result.maxLoan));
    expect(summary.maxLoan).toBeLessThanOrEqual(result.maxLoan);
    expect(Number.isInteger(summary.maxLoan)).toBe(true);
  });

  it("derives the deposit so loan + deposit is exactly the price", () => {
    const summary = summarize(input());
    expect(summary.maxLoan + summary.deposit).toBe(250_000);
  });

  it("computes the instalment on the loan actually shown", () => {
    const summary = summarize(input());
    expect(summary.contractPayment).toBeCloseTo(
      monthlyPayment(summary.maxLoan, 0.032, 480),
      8,
    );
  });

  it("shows a stressed instalment that is higher than the real one", () => {
    const summary = summarize(input());
    expect(summary.stressedPayment).toBeGreaterThan(summary.contractPayment);
    expect(summary.stressedRate).toBeCloseTo(0.032 + 0.015, 10);
  });
});

describe("buildLoanSummary — effort rate vs DSTI", () => {
  it("keeps them apart: the DSTI is on the ceiling, the effort rate below it", () => {
    // The supervisory ratio sits on 45 % by construction; what the household
    // actually pays is lower, because nobody pays the stressed instalment.
    const summary = summarize(input());
    expect(summary.dstiRatio).toBeCloseTo(0.45, 3);
    expect(summary.effortRate).toBeLessThan(summary.dstiRatio);
  });

  it("counts existing debt in the effort rate", () => {
    const summary = summarize(
      input({
        borrower: { monthlyIncome: 2000, age: 30, existingMonthlyDebt: 200 },
      }),
    );
    expect(summary.effortRate).toBeCloseTo(
      (summary.contractPayment + 200) / 2000,
      8,
    );
  });
});

describe("buildLoanSummary — the binding constraint", () => {
  it("names income when the DSTI binds, and offers the income remedy", () => {
    const summary = summarize(input());
    expect(summary.binding.key).toBe("dsti");
    expect(summary.binding.remedy).toMatch(/entrada maior não altera/i);
  });

  it("names the property when the LTV binds, and offers the deposit remedy", () => {
    const summary = summarize(
      input({
        borrower: { monthlyIncome: 9000, age: 30 },
        propertyPrice: 200_000,
      }),
    );
    expect(summary.binding.key).toBe("ltv");
    expect(summary.binding.remedy).toMatch(/capitais próprios/i);
  });

  it("marks exactly one constraint as binding", () => {
    const summary = summarize(input());
    expect(summary.constraints.filter((c) => c.binding)).toHaveLength(1);
    expect(summary.constraints).toHaveLength(2);
  });

  it("quotes the LTV percentage that applies to the purpose", () => {
    expect(summarize(input()).constraints[1].detail).toContain("90 %");
    expect(summarize(input({ purpose: "other" })).constraints[1].detail).toContain(
      "80 %",
    );
  });

  it("quotes the shock in percentage points", () => {
    expect(summarize(input()).constraints[0].detail).toContain("1,5 p.p.");
    expect(summarize(input({ termYears: 5 })).constraints[0].detail).toContain(
      "0,5 p.p.",
    );
  });
});

describe("buildLoanSummary — fixed rate changes what can be said", () => {
  it("reports no shock for a fixed-rate contract", () => {
    const summary = summarize(input({ rateType: "fixed" }));
    expect(summary.shocked).toBe(false);
    expect(summary.rateType).toBe("fixed");
    expect(summary.stressedRate).toBeCloseTo(0.032, 10);
    expect(summary.stressedPayment).toBeCloseTo(summary.contractPayment, 8);
  });

  it("never says '0,0 p.p.' when there is no shock", () => {
    // The failure this guards against is copy, not arithmetic: a shock of
    // zero rendered into the variable-rate sentence reads as nonsense.
    const detail = summarize(input({ rateType: "fixed" })).constraints[0].detail;
    expect(detail).not.toContain("p.p.");
    expect(detail).toContain("taxa fixa");
  });

  it("still describes the shock for a variable-rate contract", () => {
    const detail = summarize(input()).constraints[0].detail;
    expect(detail).toContain("1,5 p.p.");
    expect(summarize(input()).shocked).toBe(true);
  });
});

describe("buildLoanSummary — taxa mista", () => {
  const mixed = () =>
    summarize(
      input({
        rateType: "mixed",
        mixedTerms: { fixedPeriodYears: 5, fixedRate: 0.031 },
        termYears: 30,
      }),
    );

  it("reports which leg of art. 1.º n.º 2 governed", () => {
    expect(mixed().mixedBasis).toBe("post-fixed");
  });

  it("quotes the fixed-period instalment as what is paid", () => {
    // Not the indexed one, and not the stressed one: a mista borrower starts
    // on the fixed rate. Reconstructing this from a single rate is exactly
    // the bug that made the summary take its instalments from the engine.
    const summary = mixed();
    expect(summary.contractPayment).toBeLessThan(summary.stressedPayment);
  });

  it("scales both instalments to the floored loan", () => {
    const i = input({
      rateType: "mixed",
      mixedTerms: { fixedPeriodYears: 5, fixedRate: 0.031 },
      termYears: 30,
    });
    const raw = maxLoanForDate(i);
    const summary = mixed();
    const scale = summary.maxLoan / raw.maxLoan;
    expect(summary.contractPayment).toBeCloseTo(raw.contractPayment * scale, 8);
    expect(summary.stressedPayment).toBeCloseTo(raw.stressedPayment * scale, 8);
  });

  it("describes the mista test rather than a plain shock", () => {
    const detail = mixed().constraints[0].detail;
    expect(detail).toContain("taxa mista");
    expect(detail).toContain("indexante agravado");
  });
});

describe("buildLoanSummary — the age rules surface", () => {
  it("reports the term cap for an older borrower", () => {
    const summary = summarize(
      input({ borrower: { monthlyIncome: 2000, age: 50 } }),
    );
    expect(summary.termCappedByAge).toBe(true);
    expect(summary.termYears).toBe(35);
  });

  it("reports the past-70 income reduction, and that it is partial", () => {
    const summary = summarize(
      input({ borrower: { monthlyIncome: 2000, age: 45 }, termYears: 35 }),
    );
    // 45 + 35 = 80, so 10 of 35 years past the threshold: 20 % × 10/35.
    expect(summary.incomeReduction).toBeCloseTo(0.2 * (10 / 35), 8);
    expect(summary.adjustedIncome).toBeCloseTo(
      2000 * (1 - summary.incomeReduction),
      8,
    );
  });

  it("reports no reduction for a young borrower", () => {
    expect(summarize(input()).incomeReduction).toBe(0);
  });
});

describe("buildLoanSummary — provenance", () => {
  it("passes both sources through and flags them verified", () => {
    const summary = summarize(input());
    expect(summary.sources.macroprudential).toContain("1/2026");
    expect(summary.sources.shock).toContain("23/2023");
    // Both axes pass for the legally determined computation; the UI badge
    // reads "Dados verificados" on the strength of that and nothing wider.
    expect(summary.parametersVerified).toBe(true);
  });
});

describe("buildLoanSummary — degenerate cases", () => {
  it("shows zeros rather than NaN when nothing can be borrowed", () => {
    const summary = summarize(
      input({
        borrower: { monthlyIncome: 2000, age: 30, existingMonthlyDebt: 2000 },
      }),
    );
    expect(summary.maxLoan).toBe(0);
    expect(summary.contractPayment).toBe(0);
    expect(summary.totalInterest).toBe(0);
    // The whole price would have to come from savings.
    expect(summary.deposit).toBe(250_000);
    expect(summary.depositShare).toBe(1);
  });
});
