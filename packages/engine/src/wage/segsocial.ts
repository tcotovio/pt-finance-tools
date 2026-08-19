// Segurança Social (employee Social Security) contribution.

/**
 * Employee Social Security contribution rate (taxa contributiva do
 * trabalhador) for general regime dependent workers: 11%.
 */
export const EMPLOYEE_SOCIAL_SECURITY_RATE = 0.11;

/**
 * Employer contribution rate (taxa contributiva da entidade empregadora) for
 * general regime dependent workers: 23,75%. With the employee's 11% it makes
 * up the 34,75% taxa contributiva global of Código Contributivo art. 53.º.
 */
export const EMPLOYER_SOCIAL_SECURITY_RATE = 0.2375;

/** Employee Social Security contribution on a gross monthly amount. */
export function socialSecurityContribution(
  grossMonthly: number,
  rate: number = EMPLOYEE_SOCIAL_SECURITY_RATE,
): number {
  return grossMonthly * rate;
}

/** Employer Social Security contribution on the same contribution base. */
export function employerSocialSecurityContribution(
  contributionBase: number,
  rate: number = EMPLOYER_SOCIAL_SECURITY_RATE,
): number {
  return contributionBase * rate;
}
