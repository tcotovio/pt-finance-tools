// Reference values the *form* needs in order to explain itself: the meal
// allowance ceilings and the IRS Jovem schedule. They come from the same
// versioned datasets the calculation uses, so a hint can never drift from
// the number the engine actually applied.

import {
  getIrsJovemRegime,
  getMealAllowanceLimits,
} from "@pt-finance-tools/engine";
import type { IrsJovemRegime, MealAllowanceLimits } from "@pt-finance-tools/engine";

/** Meal allowance ceilings in effect, or `null` if the date is uncovered. */
export function mealLimitsFor(date: string): MealAllowanceLimits | null {
  try {
    return getMealAllowanceLimits(date);
  } catch {
    return null;
  }
}

/** IRS Jovem parameters in effect, or `null` if the date is uncovered. */
export function irsJovemRegimeFor(date: string): IrsJovemRegime | null {
  try {
    return getIrsJovemRegime(date);
  } catch {
    return null;
  }
}
