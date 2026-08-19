export {
  computeNetWage,
  withholdingForBracket,
  withholdingDetailForBracket,
} from "./withholding.js";
export type { WithholdingDetail } from "./withholding.js";
export {
  EMPLOYEE_SOCIAL_SECURITY_RATE,
  EMPLOYER_SOCIAL_SECURITY_RATE,
  employerSocialSecurityContribution,
  socialSecurityContribution,
} from "./segsocial.js";
export { selectTable, selectBracket } from "./resolver.js";
export { splitMealAllowance } from "./meal.js";
export { twelfthsDetail } from "./twelfths.js";
export {
  irsJovemExemption,
  exemptionFraction,
  paymentExemptionCap,
} from "./irs-jovem.js";
export type { IrsJovemExemption } from "./irs-jovem.js";
export type { TwelfthsDetail } from "./twelfths.js";
export type { MealAllowanceSplit } from "./meal.js";
