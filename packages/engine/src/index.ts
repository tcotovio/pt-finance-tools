export const ENGINE_VERSION = "0.0.1";

export type {
  Region,
  TaxpayerCategory,
  WageInput,
  WageResult,
  WithholdingBracket,
  WithholdingTable,
  WithholdingDataset,
} from "./types.js";

export {
  computeNetWage,
  withholdingForBracket,
  socialSecurityContribution,
  EMPLOYEE_SOCIAL_SECURITY_RATE,
  selectTable,
  selectBracket,
} from "./wage/index.js";
