import type { WageInput, WageResult } from "./types.js";
import { computeNetWage } from "./wage/index.js";
import {
  getIrsJovemRegime,
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
} from "./types.js";

export {
  computeNetWage,
  splitMealAllowance,
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
  WithholdingDetail,
  MealAllowanceSplit,
  TwelfthsDetail,
  IrsJovemExemption,
} from "./wage/index.js";

export {
  getWithholdingDataset,
  getMealAllowanceLimits,
  getIrsJovemRegime,
  CONTINENTE_2026,
  MEAL_ALLOWANCE_2026,
  IRS_JOVEM_2026,
} from "./data/index.js";
