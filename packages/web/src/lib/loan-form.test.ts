import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOAN_FORM,
  toMaxLoanInput,
  validateLoanForm,
  type LoanForm,
} from "./loan-form.js";

const form = (overrides: Partial<LoanForm> = {}): LoanForm => ({
  ...DEFAULT_LOAN_FORM,
  income: "2000",
  propertyPrice: "250000",
  ...overrides,
});

const DATE = "2026-09-01";
/** A stand-in for whatever the Euribor feed returned, as a fraction. */
const INDEX = 0.02855087;

describe("validateLoanForm", () => {
  it("accepts a filled-in form", () => {
    expect(validateLoanForm(form())).toEqual({});
  });

  it("treats empty fields as not-yet-filled rather than wrong", () => {
    // The same rule as the wage form: clearing a box to retype it must not
    // paint the form red.
    expect(validateLoanForm(DEFAULT_LOAN_FORM)).toEqual({});
  });

  it("rejects a non-numeric income", () => {
    expect(validateLoanForm(form({ income: "muito" })).income).toMatch(
      /Introduza um valor/,
    );
  });

  it("rejects a zero or negative income", () => {
    expect(validateLoanForm(form({ income: "0" })).income).toMatch(
      /superior a zero/,
    );
  });

  it("rejects a term beyond any BdP maturity ceiling", () => {
    expect(validateLoanForm(form({ termYears: "45" })).termYears).toMatch(
      /40 anos/,
    );
  });

  it("catches a rate typed in basis points", () => {
    // "320" for 3,20 % is the mistake this guard exists for.
    expect(validateLoanForm(form({ annualRate: "320" })).annualRate).toMatch(
      /em percentagem/,
    );
  });

  it("rejects an implausible age", () => {
    expect(validateLoanForm(form({ age: "12" })).age).toMatch(/entre 18 e 100/);
    expect(validateLoanForm(form({ age: "30,5" })).age).toBeDefined();
  });

  it("rejects an implausible spread", () => {
    expect(validateLoanForm(form({ spread: "15" })).spread).toMatch(
      /demasiado alto/,
    );
    expect(validateLoanForm(form({ spread: "-1" })).spread).toBeDefined();
  });

  it("rejects negative existing debt", () => {
    expect(validateLoanForm(form({ existingDebt: "-50" })).existingDebt)
      .toBeDefined();
  });
});

describe("toMaxLoanInput", () => {
  it("returns null until both income and price are given", () => {
    expect(toMaxLoanInput(DEFAULT_LOAN_FORM, DATE, INDEX)).toBeNull();
    expect(toMaxLoanInput(form({ propertyPrice: "" }), DATE, INDEX)).toBeNull();
    expect(toMaxLoanInput(form({ income: "" }), DATE, INDEX)).toBeNull();
  });

  it("maps the required fields", () => {
    const input = toMaxLoanInput(form({ age: "34", termYears: "30" }), DATE, INDEX);
    expect(input).toMatchObject({
      borrower: { monthlyIncome: 2000, age: 34 },
      propertyPrice: 250_000,
      termYears: 30,
      purpose: "own-permanent-residence",
      assessmentDate: DATE,
    });
  });

  it("composes the variable rate from the live index plus the spread", () => {
    const input = toMaxLoanInput(form({ spread: "1,0" }), DATE, INDEX);
    expect(input?.annualRate).toBeCloseTo(INDEX + 0.01, 10);
    expect(input?.rateType).toBe("variable");
  });

  it("ignores the index entirely when the rate is fixed", () => {
    // A fixed contract has no indexante — and the engine will skip the shock
    // for it, so the two must not be mixed up.
    const input = toMaxLoanInput(
      form({ rateType: "fixed", annualRate: "3,2", spread: "1,0" }),
      DATE,
      INDEX,
    );
    expect(input?.annualRate).toBeCloseTo(0.032, 10);
    expect(input?.rateType).toBe("fixed");
  });

  it("accepts Portuguese thousands separators", () => {
    const input = toMaxLoanInput(
      form({ income: "2.500,50", propertyPrice: "310.000" }),
      DATE,
      INDEX,
    );
    expect(input?.borrower.monthlyIncome).toBeCloseTo(2500.5, 10);
    expect(input?.propertyPrice).toBe(310_000);
  });

  it("omits optional fields that are empty or zero", () => {
    const input = toMaxLoanInput(form(), DATE, INDEX);
    expect(input?.borrower.existingMonthlyDebt).toBeUndefined();
    expect(input?.borrower.retired).toBeUndefined();
    expect(input?.appraisalValue).toBeUndefined();
  });

  it("carries the optional fields through when set", () => {
    const input = toMaxLoanInput(
      form({
        existingDebt: "250",
        retired: true,
        appraisalValue: "240000",
        purpose: "other",
      }),
      DATE,
      INDEX,
    );
    expect(input?.borrower.existingMonthlyDebt).toBe(250);
    expect(input?.borrower.retired).toBe(true);
    expect(input?.appraisalValue).toBe(240_000);
    expect(input?.purpose).toBe("other");
  });
});
