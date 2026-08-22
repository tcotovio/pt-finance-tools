// The capacity direction, end to end through the pure helpers: form strings in,
// a summary the panel can render out.

import { describe, expect, it } from "vitest";
import {
  maxPropertyPriceForDate,
  purchaseCostsForDate,
  STATE_GUARANTEE_2024,
} from "@pt-finance-tools/engine";
import {
  DEFAULT_LOAN_FORM,
  toMaxPriceInput,
  toPurchaseCostsInput,
  validateLoanForm,
  type LoanForm,
} from "./loan-form.js";
import { buildPriceSummary } from "./loan-result.js";
import { loanSources } from "./sources.js";
import { EURIBOR_FALLBACK } from "@pt-finance-tools/engine";

const DATE = "2026-09-01";
const INDEX = 0.02855087;

const form = (overrides: Partial<LoanForm> = {}): LoanForm => ({
  ...DEFAULT_LOAN_FORM,
  mode: "capacity",
  income: "2500",
  savings: "50000",
  ...overrides,
});

const solve = (overrides: Partial<LoanForm> = {}) => {
  const input = toMaxPriceInput(form(overrides), DATE, INDEX);
  if (!input) throw new Error("expected a usable input");
  return maxPropertyPriceForDate(input);
};

describe("toMaxPriceInput", () => {
  it("needs income and savings, and says so by returning null", () => {
    expect(toMaxPriceInput(form({ income: "" }), DATE, INDEX)).toBeNull();
    expect(toMaxPriceInput(form({ savings: "" }), DATE, INDEX)).toBeNull();
  });

  it("accepts zero savings — that is a real answer, not a missing one", () => {
    const input = toMaxPriceInput(form({ savings: "0" }), DATE, INDEX);
    expect(input?.savings).toBe(0);
  });

  it("carries the region through, since it selects the IMT tables", () => {
    expect(toMaxPriceInput(form({ region: "madeira" }), DATE, INDEX)?.region).toBe(
      "madeira",
    );
  });

  it("passes the two assertions through only when they are made", () => {
    const plain = toMaxPriceInput(form(), DATE, INDEX);
    expect(plain?.youngFirstHome).toBeUndefined();
    expect(plain?.stateGuarantee).toBeUndefined();

    const asserted = toMaxPriceInput(
      form({ youngFirstHome: true, stateGuarantee: true }),
      DATE,
      INDEX,
    );
    expect(asserted?.youngFirstHome).toBe(true);
    expect(asserted?.stateGuarantee).toBe(true);
  });

  it("composes the contract rate the same way the forward direction does", () => {
    const input = toMaxPriceInput(form({ spread: "0,7" }), DATE, INDEX);
    expect(input?.annualRate).toBeCloseTo(INDEX + 0.007, 10);
  });

  it("takes the fixed rate whole when the contract is taxa fixa", () => {
    const input = toMaxPriceInput(
      form({ rateType: "fixed", annualRate: "3,2" }),
      DATE,
      INDEX,
    );
    expect(input?.annualRate).toBeCloseTo(0.032, 10);
  });

  it("does not send bank fees it was not given", () => {
    expect(toMaxPriceInput(form(), DATE, INDEX)?.bankFees).toBeUndefined();
    expect(
      toMaxPriceInput(form({ bankFees: "800" }), DATE, INDEX)?.bankFees,
    ).toBe(800);
  });
});

describe("validateLoanForm — the new fields", () => {
  it("accepts a filled capacity form", () => {
    expect(validateLoanForm(form())).toEqual({});
  });

  it("rejects negative savings, fees and a nonsense VPT", () => {
    const errors = validateLoanForm(
      form({ savings: "-1", bankFees: "-5", vpt: "0" }),
    );
    expect(errors.savings).toBeDefined();
    expect(errors.bankFees).toBeDefined();
    expect(errors.vpt).toBeDefined();
  });

  it("treats an empty field as unfilled rather than wrong", () => {
    expect(validateLoanForm(form({ vpt: "", bankFees: "" }))).toEqual({});
  });
});

describe("buildPriceSummary", () => {
  it("adds the savings as a third ceiling beside the two regulatory ones", () => {
    const summary = buildPriceSummary(solve(), 2_500);
    expect(summary.constraints.map((c) => c.key)).toEqual([
      "dsti",
      "ltv",
      "cash",
    ]);
    expect(summary.constraints.filter((c) => c.binding)).toHaveLength(1);
  });

  it("names the savings as the binding limit when they are", () => {
    const summary = buildPriceSummary(
      solve({ income: "8000", savings: "30000" }),
      8_000,
    );
    expect(summary.binding.key).toBe("cash");
    expect(summary.binding.remedy).toContain("1 000");
  });

  it("names the loan's own cap in the remedy, not just the savings", () => {
    // The price always stops where the cash does, so "poupança" is the binding
    // row — but what a borrower does about it depends on what froze the loan
    // underneath, and the copy has to say which.
    const summary = buildPriceSummary(
      solve({ income: "2000", savings: "200000" }),
      2_000,
    );
    expect(summary.binding.key).toBe("cash");
    expect(summary.binding.remedy).toContain("rendimento trava o empréstimo");
    expect(summary.binding.remedy).toContain("1 000");
  });

  it("adds the deposit and the taxes up to the cash it reports", () => {
    const summary = buildPriceSummary(solve(), 2_500);
    expect(summary.costs).not.toBeNull();
    expect(summary.cashNeeded).toBeCloseTo(
      summary.deposit + (summary.costs?.upfrontTotal ?? 0),
      2,
    );
    // And the whole thing fits inside what was declared.
    expect(summary.cashNeeded).toBeLessThanOrEqual(50_000);
  });

  it("reports the total credit cost without calling it the MTIC", () => {
    const summary = buildPriceSummary(solve(), 2_500);
    const total = summary.totalCredit;
    expect(total).not.toBeNull();
    expect(total?.total).toBeCloseTo(
      (total?.capital ?? 0) +
        (total?.interest ?? 0) +
        (total?.stampDutyCredit ?? 0) +
        (total?.stampDutyInterest ?? 0),
      2,
    );
    // Own housing: the 4 % on interest is exempt, and the reason travels.
    expect(total?.stampDutyInterest).toBe(0);
    expect(summary.costs?.stampDutyInterest.exempt).toBe(true);
  });

  it("flags an answer that leans on the state guarantee", () => {
    const summary = buildPriceSummary(
      solve({ income: "6000", savings: "25000", stateGuarantee: true }),
      6_000,
    );
    expect(summary.ltvFromGuarantee).toBe(true);
    expect(summary.parametersVerified).toBe(false);
    const ltv = summary.constraints.find((c) => c.key === "ltv");
    expect(ltv?.detail).toContain("garantia do Estado");
    expect(ltv?.reference).toBe("dl-44-2024");
  });
});

describe("toPurchaseCostsInput", () => {
  it("returns null without a price to cost", () => {
    expect(
      toPurchaseCostsInput(form(), 0, 0, 40, 0.032, DATE),
    ).toBeNull();
  });

  it("sends the VPT only when one was typed", () => {
    expect(
      toPurchaseCostsInput(form(), 250_000, 200_000, 40, 0.032, DATE)?.vpt,
    ).toBeUndefined();
    expect(
      toPurchaseCostsInput(
        form({ vpt: "280000" }),
        250_000,
        200_000,
        40,
        0.032,
        DATE,
      )?.vpt,
    ).toBe(280_000);
  });

  it("taxes the VPT when it is the higher of the two", () => {
    const input = toPurchaseCostsInput(
      form({ vpt: "280000" }),
      250_000,
      200_000,
      40,
      0.032,
      DATE,
    );
    expect(purchaseCostsForDate(input!).taxableValue).toBe(280_000);
  });
});

describe("loanSources with costs", () => {
  it("lists the three cost datasets, each with its own verified flag", () => {
    const result = solve();
    const entries = loanSources(
      result.loanResult,
      DATE,
      EURIBOR_FALLBACK,
      result.costs,
    );
    const keys = entries.map((e) => e.key);
    expect(keys).toContain("cost-imt");
    expect(keys).toContain("cost-stamp-duty");
    expect(keys).toContain("cost-registration");
    // None has an Axis B yet, so none may claim to be verified.
    for (const key of ["cost-imt", "cost-stamp-duty", "cost-registration"]) {
      expect(entries.find((e) => e.key === key)?.verified, key).toBe(false);
    }
  });

  it("omits the guarantee unless it actually moved the ceiling", () => {
    const plain = solve();
    expect(
      loanSources(plain.loanResult, DATE, EURIBOR_FALLBACK, plain.costs).map(
        (e) => e.key,
      ),
    ).not.toContain("state-guarantee");

    const guaranteed = solve({
      income: "6000",
      savings: "25000",
      stateGuarantee: true,
    });
    expect(
      loanSources(
        guaranteed.loanResult,
        DATE,
        EURIBOR_FALLBACK,
        guaranteed.costs,
      ).map((e) => e.key),
    ).toContain("state-guarantee");
  });

  it("keeps every cited amount inside the guarantee's own ceiling", () => {
    // A cheap guard on the assertion model: the engine must refuse the
    // guarantee above the transaction cap even when the form asserts it.
    const rich = solve({
      income: "20000",
      savings: "400000",
      stateGuarantee: true,
    });
    if (rich.maxPrice > STATE_GUARANTEE_2024.maxTransactionValue) {
      expect(rich.loanResult.ltv.source).toBe("recomendacao");
    }
  });
});

const result_dstiBinds = (r: ReturnType<typeof solve>) =>
  r.loanResult.bindingConstraint === "dsti";

describe("the two effort rates", () => {
  it("puts the supervisory one on 45 % when the income ceiling binds", () => {
    // The question a user asked of the panel: "how is my taxa de esforço 36 %
    // when you say the taxa de esforço is what limits me?". Both numbers are
    // right and they measure different things — this pins the pair, because
    // showing only the real one made the answer look self-contradictory.
    const summary = buildPriceSummary(
      solve({ income: "2000", savings: "200000" }),
      2_000,
    );
    expect(result_dstiBinds(solve({ income: "2000", savings: "200000" }))).toBe(true);
    expect(summary.dstiRatio).toBeCloseTo(0.45, 6);
    expect(summary.effortRate).toBeLessThan(summary.dstiRatio);
  });

  it("separates them by exactly the shock, and nothing else", () => {
    const result = solve({ income: "2000", savings: "200000" });
    const summary = buildPriceSummary(result, 2_000);
    // No past-70 reduction at 30 + 40 years, so the denominators match and the
    // whole gap is the stressed instalment against the contract one.
    expect(summary.incomeReduction).toBe(0);
    expect(summary.stressedRate - summary.contractRate).toBeCloseTo(
      summary.shock,
      10,
    );
    expect(summary.effortRate / summary.dstiRatio).toBeCloseTo(
      summary.contractPayment / summary.stressedPayment,
      6,
    );
  });

  it("collapses them onto each other for a fixed rate, which has no shock", () => {
    const summary = buildPriceSummary(
      solve({ income: "2000", savings: "200000", rateType: "fixed" }),
      2_000,
    );
    expect(summary.shocked).toBe(false);
    expect(summary.effortRate).toBeCloseTo(summary.dstiRatio, 6);
  });
});
