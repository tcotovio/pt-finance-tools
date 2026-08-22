// Crédito ao consumo — the other half of Recomendação 1/2026.
//
// The same DSTI machinery as the mortgage side, with two differences that come
// straight from the statute:
//
//   * NO LTV. There is no property securing it, so art. 5.º simply does not
//     apply and the income ceiling is the only one there is. That makes the
//     answer simpler, not weaker — nothing else can bind.
//   * MATURITY IS SET BY PURPOSE, NOT BY AGE. Art. 7.º n.º 3 caps crédito
//     pessoal at 7 years and crédito automóvel at 10; n.º 4 lifts personal
//     credit to 10 when it is for education, health or the energy transition.
//     The age-based ceilings of n.º 1 are for housing and are not applied here.
//
// The past-70 income reduction (art. 4.º n.º 5 al. b) DOES apply: it is a rule
// about the DSTI denominator, which is shared, not about mortgages.
//
// One consequence worth noting: these terms finally exercise the shock bands
// no mortgage ever reaches. A 7-year personal loan takes 1 p.p. and a 5-year
// one 0,5 p.p., where every mortgage sits in the >10-year band at 1,5.

import type {
  ConsumerLoanInput,
  ConsumerLoanResult,
  InterestRateShock,
  MacroprudentialParameters,
} from "../types.js";
import { amortize, monthlyPayment, principalForPayment } from "./amortization.js";
import { adjustedIncome, shockForTerm } from "./stress.js";

/** The largest consumer credit the DSTI ceiling allows. */
export function maxConsumerLoan(
  input: ConsumerLoanInput,
  params: MacroprudentialParameters,
  shockTable: InterestRateShock,
): ConsumerLoanResult {
  const { borrower, kind, annualRate, termYears } = input;

  if (!Number.isFinite(termYears) || termYears <= 0) {
    throw new Error("termYears must be a positive number.");
  }
  if (!Number.isFinite(borrower.monthlyIncome) || borrower.monthlyIncome < 0) {
    throw new Error("monthlyIncome must not be negative.");
  }

  const maturityCeiling = params.consumerMaturityYears[kind];
  if (maturityCeiling === undefined) {
    throw new Error(`No maturity ceiling for consumer credit of kind "${kind}".`);
  }

  const effectiveTerm = Math.min(termYears, maturityCeiling);
  const months = Math.round(effectiveTerm * 12);

  const rateType = input.rateType ?? "variable";
  const shock =
    rateType === "fixed" ? 0 : shockForTerm(effectiveTerm, shockTable);
  const stressedRate = annualRate + shock;

  const income = adjustedIncome(borrower, effectiveTerm, params);
  const existing = borrower.existingMonthlyDebt ?? 0;
  const paymentBudget = Math.max(0, income * params.dstiLimit - existing);
  const maxLoan = principalForPayment(paymentBudget, stressedRate, months);

  return {
    maxLoan,
    kind,
    termYears: effectiveTerm,
    termCappedByKind: effectiveTerm < termYears,
    maturityCeiling,
    dsti: {
      limit: params.dstiLimit,
      adjustedIncome: income,
      incomeReduction:
        borrower.monthlyIncome > 0 ? 1 - income / borrower.monthlyIncome : 0,
      paymentBudget,
      stressedRate,
      shock,
      rateType,
    },
    contractPayment:
      maxLoan > 0 ? monthlyPayment(maxLoan, annualRate, months) : 0,
    stressedPayment:
      maxLoan > 0 ? monthlyPayment(maxLoan, stressedRate, months) : 0,
    totalInterest:
      maxLoan > 0 ? amortize(maxLoan, annualRate, months).totalInterest : 0,
    sources: {
      macroprudential: params.source,
      shock: shockTable.source,
    },
    parametersVerified: params.verified && shockTable.verified,
  };
}
