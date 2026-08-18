import type { WageInput, WageResult } from "./types.js";
import { computeNetWage } from "./wage/index.js";
import { getMealAllowanceLimits, getWithholdingDataset } from "./data/index.js";

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
  return computeNetWage(input, dataset, mealLimits);
}

export type {
  Region,
  TaxpayerCategory,
  MealAllowance,
  MealAllowanceMethod,
  MealAllowanceLimits,
  TwelfthsOption,
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
  withholdingForBracket,
  withholdingDetailForBracket,
  socialSecurityContribution,
  EMPLOYEE_SOCIAL_SECURITY_RATE,
  selectTable,
  selectBracket,
} from "./wage/index.js";
export type {
  WithholdingDetail,
  MealAllowanceSplit,
  TwelfthsDetail,
} from "./wage/index.js";

export {
  getWithholdingDataset,
  getMealAllowanceLimits,
  CONTINENTE_2026,
  MEAL_ALLOWANCE_2026,
} from "./data/index.js";
