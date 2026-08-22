// Registry of versioned datasets + date-aware lookup.

import type {
  ImtTables,
  ImtTerritory,
  InterestRateShock,
  IrsJovemRegime,
  MacroprudentialParameters,
  MealAllowanceLimits,
  Region,
  RegistrationFees,
  StampDuty,
  StateGuarantee,
  WithholdingDataset,
} from "../types.js";
import { CONTINENTE_2026 } from "./continente-2026.js";
import { MADEIRA_2026 } from "./madeira-2026.js";
import { MEAL_ALLOWANCE_2026 } from "./meal-allowance-2026.js";
import { IRS_JOVEM_2026 } from "./irs-jovem-2026.js";
import { BDP_2026 } from "./bdp-2026.js";
import { INTEREST_RATE_SHOCK_2023 } from "./interest-rate-shock-2023.js";
import { IMT_2026 } from "./imt-2026.js";
import { STAMP_DUTY_2024 } from "./stamp-duty-2024.js";
import { REGISTRATION_FEES_2024 } from "./registration-fees-2024.js";
import { STATE_GUARANTEE_2024 } from "./state-guarantee-2024.js";
import { EURIBOR_2026_07 } from "./euribor-2026-07.js";
import { MORTGAGE_MARKET_2026_06 } from "./mortgage-market-2026-06.js";
import { CONSUMER_MARKET_2026_06 } from "./consumer-market-2026-06.js";
import { WAGE_MARKET_2026_Q2 } from "./wage-market-2026-q2.js";

/**
 * The dating contract every computed dataset satisfies.
 *
 * `effectiveTo` is optional because almost nothing here has an end date: a tax
 * table stays in force until the next one supersedes it, so "the newest one
 * that has started" is the whole rule. The exception is a *time-limited*
 * regime — the garantia pessoal do Estado runs to the end of 2026 — and
 * nothing supersedes it when it lapses, so without an end date the lookup
 * would go on returning it forever.
 */
interface Dated {
  effectiveFrom: string;
  effectiveTo?: string;
}

/**
 * The entry in effect on `date`: the most recent one that has started and has
 * not ended. ISO `YYYY-MM-DD` strings compare correctly as strings, which is
 * why no date parsing happens anywhere in this file.
 *
 * Returns `undefined` rather than throwing, so a caller whose dataset is
 * genuinely optional — an expired regime is an absence, not an error — can say
 * so, while the rest wrap it in {@link required}.
 */
function effectiveOn<T extends Dated>(
  list: readonly T[],
  date: string,
): T | undefined {
  return list
    .filter(
      (item) =>
        item.effectiveFrom <= date &&
        (item.effectiveTo === undefined || date <= item.effectiveTo),
    )
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))[0];
}

/** {@link effectiveOn}, for the datasets a calculation cannot proceed without. */
function required<T extends Dated>(
  found: T | undefined,
  what: string,
  date: string,
  hint = "",
): T {
  if (!found) {
    throw new Error(`No ${what} effective on ${date}.${hint ? ` ${hint}` : ""}`);
  }
  return found;
}

/** All withholding datasets known to the engine. Add a tax year by adding here. */
const DATASETS: readonly WithholdingDataset[] = [CONTINENTE_2026, MADEIRA_2026];

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
  return required(
    effectiveOn(
      DATASETS.filter((d) => d.region === region),
      referenceDate,
    ),
    `withholding dataset for region "${region}"`,
    referenceDate,
  );
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
  return required(
    effectiveOn(MEAL_LIMITS, referenceDate),
    "meal allowance limits",
    referenceDate,
  );
}

/** IRS Jovem parameters by year, newest first. */
const JOVEM_REGIMES: readonly IrsJovemRegime[] = [IRS_JOVEM_2026];

/** The IRS Jovem regime in effect on `referenceDate`. Throws if none. */
export function getIrsJovemRegime(referenceDate: string): IrsJovemRegime {
  return required(
    effectiveOn(JOVEM_REGIMES, referenceDate),
    "IRS Jovem regime",
    referenceDate,
  );
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
  return required(
    effectiveOn(MACROPRUDENTIAL, assessmentDate),
    "macroprudential parameters",
    assessmentDate,
    "Assessments before 2026-08-01 fall under the 2018 Recomendação, which is not modelled.",
  );
}

/** DSTI interest-rate shock tables, newest first. */
const SHOCKS: readonly InterestRateShock[] = [INTEREST_RATE_SHOCK_2023];

/** The interest-rate shock in effect on `assessmentDate`. Throws if none. */
export function getInterestRateShock(
  assessmentDate: string,
): InterestRateShock {
  return required(
    effectiveOn(SHOCKS, assessmentDate),
    "interest rate shock",
    assessmentDate,
  );
}

/** IMT rate tables by year, newest first. */
const IMT_TABLES: readonly ImtTables[] = [IMT_2026];

/** The IMT tables in effect on `date`. Throws if none. */
export function getImtTables(date: string): ImtTables {
  return required(effectiveOn(IMT_TABLES, date), "IMT tables", date);
}

/**
 * Which set of IMT tables a region uses.
 *
 * IMT splits the country in two where IRS splits it in three: Madeira and the
 * Açores share one set of tables (artigo único da Lei n.º 21/90), whereas
 * their withholding tables are separate despachos. Mapping here rather than
 * widening {@link Region} keeps one region concept in the engine.
 */
export function imtTerritory(region: Region): ImtTerritory {
  return region === "continente" ? "continente" : "regioes-autonomas";
}

/** Imposto do Selo rates, newest first. */
const STAMP_DUTIES: readonly StampDuty[] = [STAMP_DUTY_2024];

/** The Imposto do Selo rates in effect on `date`. Throws if none. */
export function getStampDuty(date: string): StampDuty {
  return required(effectiveOn(STAMP_DUTIES, date), "stamp duty rates", date);
}

/** Registration and deed tariffs, newest first. */
const REGISTRATION: readonly RegistrationFees[] = [REGISTRATION_FEES_2024];

/** The registration tariff in effect on `date`. Throws if none. */
export function getRegistrationFees(date: string): RegistrationFees {
  return required(effectiveOn(REGISTRATION, date), "registration fees", date);
}

/** The State's personal guarantee regimes, newest first. */
const STATE_GUARANTEES: readonly StateGuarantee[] = [STATE_GUARANTEE_2024];

/**
 * The state guarantee regime available on `date`, or `undefined` when none is.
 *
 * Undefined rather than a throw, because unlike every other lookup here an
 * absence is a legitimate answer: the regime is time-limited, and an
 * assessment after it lapses simply has no guarantee to lean on.
 */
export function getStateGuarantee(date: string): StateGuarantee | undefined {
  return effectiveOn(STATE_GUARANTEES, date);
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

/** The wage reference in use — context beside the user's own salary. */
export const WAGE_MARKET = WAGE_MARKET_2026_Q2;

export {
  CONTINENTE_2026,
  MADEIRA_2026,
  MEAL_ALLOWANCE_2026,
  IRS_JOVEM_2026,
  BDP_2026,
  INTEREST_RATE_SHOCK_2023,
  IMT_2026,
  STAMP_DUTY_2024,
  REGISTRATION_FEES_2024,
  STATE_GUARANTEE_2024,
  EURIBOR_2026_07,
  MORTGAGE_MARKET_2026_06,
  CONSUMER_MARKET_2026_06,
  WAGE_MARKET_2026_Q2,
};
