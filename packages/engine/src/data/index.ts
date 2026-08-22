// Registry of versioned withholding datasets + date-aware lookup.

import type {
  InterestRateShock,
  IrsJovemRegime,
  MacroprudentialParameters,
  MealAllowanceLimits,
  Region,
  WithholdingDataset,
} from "../types.js";
import { CONTINENTE_2026 } from "./continente-2026.js";
import { MADEIRA_2026 } from "./madeira-2026.js";
import { MEAL_ALLOWANCE_2026 } from "./meal-allowance-2026.js";
import { IRS_JOVEM_2026 } from "./irs-jovem-2026.js";
import { BDP_2026 } from "./bdp-2026.js";
import { INTEREST_RATE_SHOCK_2023 } from "./interest-rate-shock-2023.js";
import { EURIBOR_2026_07 } from "./euribor-2026-07.js";
import { MORTGAGE_MARKET_2026_06 } from "./mortgage-market-2026-06.js";
import { CONSUMER_MARKET_2026_06 } from "./consumer-market-2026-06.js";

/** All datasets known to the engine. Add a tax year by adding to this list. */
const DATASETS: readonly WithholdingDataset[] = [
  CONTINENTE_2026,
  MADEIRA_2026,
];

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

/** IRS Jovem parameters by year, newest first. */
const JOVEM_REGIMES: readonly IrsJovemRegime[] = [IRS_JOVEM_2026];

/** The IRS Jovem regime in effect on `referenceDate`. Throws if none. */
export function getIrsJovemRegime(referenceDate: string): IrsJovemRegime {
  const regime = JOVEM_REGIMES.filter(
    (r) => r.effectiveFrom <= referenceDate,
  ).sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))[0];

  if (!regime) {
    throw new Error(
      `No IRS Jovem regime effective on or before ${referenceDate}.`,
    );
  }
  return regime;
}

/**
 * Banco de Portugal macroprudential parameters, newest first. Keyed on the
 * date of the *solvency assessment* (Recomendação art. 11.º), not the date
 * the contract is signed.
 */
const MACROPRUDENTIAL: readonly MacroprudentialParameters[] = [BDP_2026];

/** The macroprudential parameters in effect on `assessmentDate`. Throws if none. */
export function getMacroprudentialParameters(
  assessmentDate: string,
): MacroprudentialParameters {
  const params = MACROPRUDENTIAL.filter(
    (p) => p.effectiveFrom <= assessmentDate,
  ).sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))[0];

  if (!params) {
    throw new Error(
      `No macroprudential parameters effective on or before ${assessmentDate}. ` +
        "Assessments before 2026-08-01 fall under the 2018 Recomendação, which " +
        "is not yet modelled.",
    );
  }
  return params;
}

/** DSTI interest-rate shock tables, newest first. */
const SHOCKS: readonly InterestRateShock[] = [INTEREST_RATE_SHOCK_2023];

/** The interest-rate shock in effect on `assessmentDate`. Throws if none. */
export function getInterestRateShock(assessmentDate: string): InterestRateShock {
  const shock = SHOCKS.filter((s) => s.effectiveFrom <= assessmentDate).sort(
    (a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1),
  )[0];

  if (!shock) {
    throw new Error(
      `No interest rate shock effective on or before ${assessmentDate}.`,
    );
  }
  return shock;
}

/**
 * The Euribor snapshot compiled into the bundle. Unlike the other datasets
 * this one is a *fallback* rather than the authority: the app prefers live
 * ECB values and only lands here when the network and the cache both fail.
 */
export const EURIBOR_FALLBACK = EURIBOR_2026_07;

/** The bundled market-rate reference, superseded by a live fetch when one works. */
export const MORTGAGE_MARKET = MORTGAGE_MARKET_2026_06;

/** The consumer-credit market reference in use. */
export const CONSUMER_MARKET = CONSUMER_MARKET_2026_06;

export {
  CONTINENTE_2026,
  MADEIRA_2026,
  MEAL_ALLOWANCE_2026,
  IRS_JOVEM_2026,
  BDP_2026,
  INTEREST_RATE_SHOCK_2023,
  EURIBOR_2026_07,
  MORTGAGE_MARKET_2026_06,
  CONSUMER_MARKET_2026_06,
};
