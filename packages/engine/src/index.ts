import type { WageInput, WageResult } from "./types.js";
import { computeNetWage } from "./wage/index.js";
import { getWithholdingDataset } from "./data/index.js";

export const ENGINE_VERSION = "0.0.1";

/**
 * Compute the monthly net wage, resolving the correct verified dataset for the
 * input's region and `referenceDate` automatically. Throws if no verified
 * dataset covers that region/date.
 */
export function computeNetWageForDate(input: WageInput): WageResult {
  const dataset = getWithholdingDataset(input.region, input.referenceDate);
  return computeNetWage(input, dataset);
}

export type {
  Region,
  TaxpayerCategory,
  WageInput,
  WageResult,
  Deduction,
  WithholdingBracket,
  WithholdingTable,
  WithholdingDataset,
} from "./types.js";

export {
  computeNetWage,
  withholdingForBracket,
  withholdingDetailForBracket,
  socialSecurityContribution,
  EMPLOYEE_SOCIAL_SECURITY_RATE,
  selectTable,
  selectBracket,
} from "./wage/index.js";
export type { WithholdingDetail } from "./wage/index.js";

export { getWithholdingDataset, CONTINENTE_2026 } from "./data/index.js";
