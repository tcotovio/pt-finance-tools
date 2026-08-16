// Segurança Social (employee Social Security) contribution.

/**
 * Employee Social Security contribution rate (taxa contributiva do
 * trabalhador) for general regime dependent workers: 11%.
 */
export const EMPLOYEE_SOCIAL_SECURITY_RATE = 0.11;

/** Employee Social Security contribution on a gross monthly amount. */
export function socialSecurityContribution(
  grossMonthly: number,
  rate: number = EMPLOYEE_SOCIAL_SECURITY_RATE,
): number {
  return grossMonthly * rate;
}
