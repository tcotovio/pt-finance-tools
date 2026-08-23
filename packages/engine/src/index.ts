import type {
  ConsumerLoanInput,
  ConsumerLoanResult,
  MaxLoanInput,
  MaxLoanResult,
  MaxPriceInput,
  MaxPriceResult,
  WageInput,
  WageResult,
} from "./types.js";
import { computeNetWage } from "./wage/index.js";
import { maxLoan, maxConsumerLoan, maxPropertyPrice } from "./loan/index.js";
import {
  getImtTables,
  getInterestRateShock,
  getIrsJovemRegime,
  getMacroprudentialParameters,
  getMealAllowanceLimits,
  getRegistrationFees,
  getStampDuty,
  getStateGuarantee,
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
    getStateGuarantee(input.assessmentDate),
  );
}

/**
 * Solve for the most expensive property this borrower's income and savings
 * reach together, resolving every dataset from the assessment date.
 *
 * The other direction from {@link maxLoanForDate}: there the price is given
 * and the loan is the unknown; here the savings are given and the price is.
 */
export function maxPropertyPriceForDate(input: MaxPriceInput): MaxPriceResult {
  return maxPropertyPrice(
    input,
    getMacroprudentialParameters(input.assessmentDate),
    getInterestRateShock(input.assessmentDate),
    getImtTables(input.assessmentDate),
    getStampDuty(input.assessmentDate),
    getRegistrationFees(input.assessmentDate),
    getStateGuarantee(input.assessmentDate),
  );
}

/**
 * Solve for the largest crédito ao consumo the Banco de Portugal limits allow,
 * resolving the parameters in force on the assessment date automatically.
 */
export function maxConsumerLoanForDate(
  input: ConsumerLoanInput,
): ConsumerLoanResult {
  return maxConsumerLoan(
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
  ConsumerCreditKind,
  ConsumerLoanInput,
  ConsumerLoanResult,
  LoanRateType,
  EuriborTenor,
  EuriborSnapshot,
  MortgageMarket,
  ConsumerCreditMarket,
  WageMarket,
  Percentiles,
  ImtBracket,
  ImtCharge,
  ImtTableId,
  ImtTables,
  ImtTerritory,
  StampDuty,
  StampDutyTransferCharge,
  StampDutyCreditCharge,
  StampDutyInterestCharge,
  RegistrationFees,
  StateGuarantee,
  SourceRef,
  PurchaseCostsInput,
  PurchaseCosts,
  PriceBindingConstraint,
  MaxPriceInput,
  MaxPriceResult,
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
  maxConsumerLoan,
  stressedDsti,
  referenceMonth,
  isCurrentFor,
  euriborRate,
  contractRate,
  purchaseCosts,
  purchaseCostsForDate,
  imtFor,
  maxPropertyPrice,
} from "./loan/index.js";

export {
  getWithholdingDataset,
  getMacroprudentialParameters,
  getInterestRateShock,
  getMealAllowanceLimits,
  getIrsJovemRegime,
  getImtTables,
  getStampDuty,
  getRegistrationFees,
  getStateGuarantee,
  imtTerritory,
  CONTINENTE_2026,
  MADEIRA_2026,
  MEAL_ALLOWANCE_2026,
  IRS_JOVEM_2026,
  BDP_2026,
  INTEREST_RATE_SHOCK_2023,
  IMT_2026,
  STAMP_DUTY_2024,
  REGISTRATION_FEES_2024,
  STATE_GUARANTEE_2024,
  EURIBOR_2026_07,
  EURIBOR_FALLBACK,
  MORTGAGE_MARKET_2026_06,
  MORTGAGE_MARKET,
  CONSUMER_MARKET_2026_06,
  CONSUMER_MARKET,
  WAGE_MARKET_2026_Q2,
  WAGE_MARKET,
} from "./data/index.js";
