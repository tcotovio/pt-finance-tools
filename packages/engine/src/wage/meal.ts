// Subsídio de alimentação — splitting a month's allowance into its exempt
// and taxable parts.

import type { MealAllowance, MealAllowanceLimits } from "../types.js";

/** The split of a month's meal allowance. */
export interface MealAllowanceSplit {
  paid: number;
  exempt: number;
  taxable: number;
  dailyLimit: number;
}

/**
 * Split a meal allowance against the per-day exemption ceiling.
 *
 * The ceiling is applied **per day**, not to the monthly total: paying
 * 12,00 € on a 10,46 € ceiling yields 1,54 € of taxable income per day, and
 * a worker paid below the ceiling never accrues taxable allowance no matter
 * how many days are involved.
 */
export function splitMealAllowance(
  allowance: MealAllowance,
  limits: MealAllowanceLimits,
): MealAllowanceSplit {
  const { dailyAmount, days, method } = allowance;
  if (dailyAmount < 0 || days < 0) {
    throw new Error(
      `Meal allowance must be non-negative, got ${dailyAmount} × ${days} days.`,
    );
  }

  const dailyLimit = limits.perDay[method];
  if (dailyLimit === undefined) {
    throw new Error(
      `No meal allowance limit for method "${method}" in the ${limits.year} dataset.`,
    );
  }

  const dailyExempt = Math.min(dailyAmount, dailyLimit);
  const paid = dailyAmount * days;
  const exempt = dailyExempt * days;

  return { paid, exempt, taxable: paid - exempt, dailyLimit };
}
