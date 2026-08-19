import type {
  MaxLoanInput,
  MaxLoanResult,
  WageInput,
  WageResult,
} from "./types.js";
import { computeNetWage } from "./wage/index.js";
import { maxLoan } from "./loan/index.js";
import {
  getInterestRateShock,
  getIrsJovemRegime,
  getMacroprudentialParameters,
  getMealAllowanceLimits,
  getWithholdingDataset,
} from "./data/index.js";

export const ENGINE_VERSION = "0.0.1";

/**
 * Compute the monthly net wage, resolving the correct verified dataset for the
 * input's region and `referenceDate` automatically. Throws if no verified
 * dataset covers that region/date.
 */
export function computeNetWageForDate(input: WageInput): WageResult {
  const dataset = getWithholdingDataset(input.region, input.referenceDate);
  const mealLimits = input.mealAllowance
    ? getMealAllowanceLimits(input.referenceDate)
    : undefined;
  const jovemRegime = input.irsJovem
    ? getIrsJovemRegime(input.referenceDate)
    : undefined;
  return computeNetWage(input, dataset, mealLimits, jovemRegime);
}

/**
 * Solve for the largest loan the Banco de Portugal limits allow, resolving the
 * parameter sets in force on the input's `assessmentDate` automatically.
 * Throws if none covers that date.
 */
export function maxLoanForDate(input: MaxLoanInput): MaxLoanResult {
  return maxLoan(
    input,
    getMacroprudentialParameters(input.assessmentDate),
    getInterestRateShock(input.assessmentDate),
  );
}

export type {
  Region,
  TaxpayerCategory,
  MealAllowance,
  MealAllowanceMethod,
  MealAllowanceLimits,
  TwelfthsOption,
  IrsJovemInput,
  IrsJovemRegime,
  WageInput,
  WageResult,
  Deduction,
  WithholdingBracket,
  WithholdingTable,
  WithholdingDataset,
  LoanPurpose,
  MacroprudentialParameters,
  InterestRateShock,
  InterestRateShockBand,
  AmortizationPeriod,
  AmortizationResult,
  BorrowerProfile,
  MaxLoanInput,
  BindingConstraint,
  MaxLoanResult,
  LoanRateType,
  EuriborTenor,
  EuriborSnapshot,
  MarketRateReference,
} from "./types.js";

export {
  computeNetWage,
  splitMealAllowance,
  overtimeDetail,
  OVERTIME_RATE_FACTOR,
  twelfthsDetail,
  irsJovemExemption,
  exemptionFraction,
  paymentExemptionCap,
  withholdingForBracket,
  withholdingDetailForBracket,
  socialSecurityContribution,
  employerSocialSecurityContribution,
  EMPLOYEE_SOCIAL_SECURITY_RATE,
  EMPLOYER_SOCIAL_SECURITY_RATE,
  selectTable,
  selectBracket,
} from "./wage/index.js";
export type {
  OvertimeDetail,
  WithholdingDetail,
  MealAllowanceSplit,
  TwelfthsDetail,
  IrsJovemExemption,
} from "./wage/index.js";

export {
  amortize,
  amortizationSchedule,
  monthlyPayment,
  monthlyRate,
  principalForPayment,
  adjustedIncome,
  incomeReductionFraction,
  maturityCeiling,
  shockForTerm,
  maxLoan,
  stressedDsti,
  referenceMonth,
  isCurrentFor,
  euriborRate,
  contractRate,
} from "./loan/index.js";

export {
  getWithholdingDataset,
  getMacroprudentialParameters,
  getInterestRateShock,
  getMealAllowanceLimits,
  getIrsJovemRegime,
  CONTINENTE_2026,
  MADEIRA_2026,
  MEAL_ALLOWANCE_2026,
  IRS_JOVEM_2026,
  BDP_2026,
  INTEREST_RATE_SHOCK_2023,
  EURIBOR_2026_07,
  EURIBOR_FALLBACK,
  MARKET_RATE_2026_06,
  MARKET_RATE_FALLBACK,
} from "./data/index.js";
