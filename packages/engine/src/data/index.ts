// Registry of versioned withholding datasets + date-aware lookup.

import type {
  MealAllowanceLimits,
  Region,
  WithholdingDataset,
} from "../types.js";
import { CONTINENTE_2026 } from "./continente-2026.js";
import { MEAL_ALLOWANCE_2026 } from "./meal-allowance-2026.js";

/** All datasets known to the engine. Add a tax year by adding to this list. */
const DATASETS: readonly WithholdingDataset[] = [CONTINENTE_2026];

/**
 * The dataset for a region that is in effect on `referenceDate` (ISO
 * `YYYY-MM-DD`): the most recent one whose `effectiveFrom` is on or before
 * that date. Throws if none is available.
 *
 * Does not filter on `verified` — whether the data has been independently
 * cross-checked is surfaced via {@link WageResult.datasetVerified} so the UI
 * can caveat, rather than making the calculator refuse to run.
 */
export function getWithholdingDataset(
  region: Region,
  referenceDate: string,
): WithholdingDataset {
  const dataset = DATASETS.filter(
    (d) => d.region === region && d.effectiveFrom <= referenceDate,
  ).sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))[0];

  if (!dataset) {
    throw new Error(
      `No withholding dataset for region "${region}" effective on or before ${referenceDate}.`,
    );
  }
  return dataset;
}

/**
 * Meal allowance exemption limits, newest first. Unlike the withholding
 * tables these are national, so there is no region dimension.
 */
const MEAL_LIMITS: readonly MealAllowanceLimits[] = [MEAL_ALLOWANCE_2026];

/** The meal allowance limits in effect on `referenceDate`. Throws if none. */
export function getMealAllowanceLimits(
  referenceDate: string,
): MealAllowanceLimits {
  const limits = MEAL_LIMITS.filter(
    (l) => l.effectiveFrom <= referenceDate,
  ).sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))[0];

  if (!limits) {
    throw new Error(
      `No meal allowance limits effective on or before ${referenceDate}.`,
    );
  }
  return limits;
}

export { CONTINENTE_2026, MEAL_ALLOWANCE_2026 };
