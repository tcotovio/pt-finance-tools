// The reverse direction: how much can this borrower borrow?
//
// Three ceilings apply and the answer is the lowest of them:
//
//   1. DSTI — the stressed instalment plus existing debt may not exceed 45 %
//      of (possibly reduced) income;
//   2. LTV — the loan may not exceed 90 % / 80 % of the lower of price and
//      appraisal value;
//   3. maturity — the term is capped by the oldest borrower's age, which
//      feeds back into (1) by shortening the annuity.
//
// No iteration is needed: at a fixed stressed rate the instalment is linear in
// the principal, so the DSTI ceiling inverts analytically through
// `principalForPayment`. The result reports all three so the UI can say *which*
// rule is binding — the single most useful thing a borrower can learn here,
// since the fix differs entirely (earn more / save a bigger deposit / borrow
// over longer).

import type {
  BorrowerProfile,
  InterestRateShock,
  MacroprudentialParameters,
  MaxLoanInput,
  MaxLoanResult,
} from "../types.js";
import { monthlyPayment, principalForPayment } from "./amortization.js";
import { adjustedIncome, maturityCeiling, shockForTerm } from "./stress.js";
import { mixedPrincipalForBudget, mixedStressedPayment } from "./mixed.js";

/**
 * The stressed DSTI a given instalment would produce — the forward check,
 * for showing a borrower where a loan they have in mind lands.
 *
 * Art. 6.º n.º 2 stresses only the new contract's instalment; instalments on
 * credit already held enter the numerator at face value.
 */
export function stressedDsti(
  newLoanStressedPayment: number,
  borrower: BorrowerProfile,
  termYears: number,
  params: MacroprudentialParameters,
): number {
  const income = adjustedIncome(borrower, termYears, params);
  if (income <= 0) return Infinity;
  const existing = borrower.existingMonthlyDebt ?? 0;
  return (newLoanStressedPayment + existing) / income;
}

/** The largest loan the Recomendação's limits allow, and which one binds. */
export function maxLoan(
  input: MaxLoanInput,
  params: MacroprudentialParameters,
  shockTable: InterestRateShock,
): MaxLoanResult {
  const { borrower, purpose, propertyPrice, annualRate, termYears } = input;

  if (!Number.isFinite(propertyPrice) || propertyPrice <= 0) {
    throw new Error("propertyPrice must be a positive number.");
  }
  if (!Number.isFinite(termYears) || termYears <= 0) {
    throw new Error("termYears must be a positive number.");
  }
  if (!Number.isFinite(borrower.monthlyIncome) || borrower.monthlyIncome < 0) {
    throw new Error("monthlyIncome must not be negative.");
  }

  // 3. Maturity first — it changes both the annuity and the shock band.
  const ceiling = maturityCeiling(borrower.age, params);
  const effectiveTerm = Math.min(termYears, ceiling);
  const months = Math.round(effectiveTerm * 12);

  // 1. DSTI. The shock only exists for contracts whose rate can move:
  // Instrução 23/2023 prescribes one for taxa variável (n.º 1) and taxa mista
  // (n.º 2), and Recomendação art. 6.º n.º 2 defers to it entirely, so a fully
  // fixed contract is tested at its own rate. See `LoanRateType`.
  const rateType = input.rateType ?? "variable";
  const isMixed = rateType === "mixed";
  const shock = rateType === "fixed" ? 0 : shockForTerm(effectiveTerm, shockTable);
  const income = adjustedIncome(borrower, effectiveTerm, params);
  const existing = borrower.existingMonthlyDebt ?? 0;
  // Negative when existing debt alone already breaches the ceiling; clamped,
  // since "how much more can they borrow" is zero, not a negative loan.
  const paymentBudget = Math.max(0, income * params.dstiLimit - existing);

  // Taxa mista is tested on the dearer of its two legs, so it inverts through
  // its own helper rather than through a single annuity.
  if (rateType === "mixed") {
    if (!input.mixedTerms) {
      throw new Error(
        'rateType "mixed" requires mixedTerms (fixedPeriodYears, fixedRate).',
      );
    }
    const dstiMaxMixed = mixedPrincipalForBudget(
      paymentBudget,
      input.mixedTerms,
      annualRate,
      shock,
      months,
    );
    return assemble(
      dstiMaxMixed,
      (limit) =>
        limit > 0
          ? mixedStressedPayment(limit, input.mixedTerms!, annualRate, shock, months)
              .fixedPeriodPayment
          : 0,
      (limit) =>
        limit > 0
          ? mixedStressedPayment(limit, input.mixedTerms!, annualRate, shock, months)
              .stressedPayment
          : 0,
    );
  }

  const stressedRate = annualRate + shock;
  const dstiMax = principalForPayment(paymentBudget, stressedRate, months);

  return assemble(
    dstiMax,
    (limit) => (limit > 0 ? monthlyPayment(limit, annualRate, months) : 0),
    (limit) => (limit > 0 ? monthlyPayment(limit, stressedRate, months) : 0),
  );

  /**
   * Everything downstream of the DSTI ceiling is identical for all three rate
   * types: apply LTV, take the lower, and report which one bound. Only the
   * instalment the borrower actually starts paying differs, which is why it
   * arrives as a callback.
   */
  function assemble(
    dstiCeiling: number,
    contractPaymentFor: (limit: number) => number,
    stressedPaymentFor: (limit: number) => number,
  ): MaxLoanResult {
  // 2. LTV, on the lower of price and appraisal (art. 4.º).
  const propertyValue = Math.min(
    propertyPrice,
    input.appraisalValue ?? propertyPrice,
  );
  const ltvLimit = params.ltvLimit[purpose];
  const ltvMax = propertyValue * ltvLimit;

  const dstiMax = dstiCeiling;
  const limit = Math.min(dstiMax, ltvMax);
  const mixed =
    isMixed && input.mixedTerms && limit > 0
      ? mixedStressedPayment(limit, input.mixedTerms, annualRate, shock, months)
      : undefined;

  return {
    maxLoan: limit,
    // Ties go to DSTI: when both bind exactly, the income constraint is the
    // one that will move if anything about the borrower changes.
    bindingConstraint: dstiMax <= ltvMax ? "dsti" : "ltv",
    termYears: effectiveTerm,
    termCappedByAge: effectiveTerm < termYears,
    dsti: {
      limit: params.dstiLimit,
      adjustedIncome: income,
      incomeReduction:
        borrower.monthlyIncome > 0 ? 1 - income / borrower.monthlyIncome : 0,
      paymentBudget,
      // For mista this is the shocked indexed rate, which is the leg the
      // test usually turns on; `mixedBasis` says when the fixed leg won.
      stressedRate: mixed ? mixed.stressedPostFixedRate : annualRate + shock,
      shock,
      rateType,
      mixedBasis: mixed?.basis,
      maxLoan: dstiMax,
    },
    ltv: {
      limit: ltvLimit,
      propertyValue,
      maxLoan: ltvMax,
    },
    contractPayment: contractPaymentFor(limit),
    stressedPayment: stressedPaymentFor(limit),
    sources: {
      macroprudential: params.source,
      shock: shockTable.source,
    },
    parametersVerified: params.verified && shockTable.verified,
  };
  }
}
