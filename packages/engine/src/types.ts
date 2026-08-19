// Shared input/output types for the calculation engine.
// Framework-agnostic: no DOM, no React, no bundler-specific imports.

/** Portuguese tax regions with distinct withholding tables. */
export type Region = "continente" | "madeira" | "acores";

/**
 * Which withholding table applies to a taxpayer. In the 2026+ formula model,
 * dependents are handled via a per-bracket deduction (not separate tables),
 * so the category alone selects the table.
 */
export type TaxpayerCategory =
  | "unmarried" // não casado
  | "married-single-earner" // casado, único titular
  | "married-dual-earner"; // casado, dois titulares

/** How the meal allowance is paid — the exemption ceiling differs by method. */
export type MealAllowanceMethod = "card" | "cash";

/** A month's meal allowance (subsídio de alimentação). */
export interface MealAllowance {
  /** Amount paid per working day, in euros. */
  dailyAmount: number;
  /** Number of days it is paid for this month. */
  days: number;
  method: MealAllowanceMethod;
}

/**
 * Per-day meal allowance exemption ceilings for a year. Above the ceiling the
 * excess is treated as ordinary remuneration: it enters both the IRS
 * withholding base and the Segurança Social base.
 */
export interface MealAllowanceLimits {
  year: number;
  /** ISO `YYYY-MM-DD` the limits take effect. */
  effectiveFrom: string;
  perDay: Record<MealAllowanceMethod, number>;
  /** Human-readable provenance. */
  source: string;
  /** Whether the values have been independently cross-checked. */
  verified: boolean;
}

/**
 * How much of each subsidy is paid monthly in duodécimos, as a fraction:
 * 1 = the whole subsidy spread over the year, 0.5 = half, 0 = paid as a lump
 * sum in its usual month (and so outside this monthly calculation).
 */
export interface TwelfthsOption {
  /** Subsídio de férias. */
  holiday: number;
  /** Subsídio de Natal. */
  christmas: number;
}

/**
 * IRS Jovem parameters for a year (CIRS art. 12.º-B), versioned like every
 * other time-varying input.
 */
export interface IrsJovemRegime {
  year: number;
  /** ISO `YYYY-MM-DD` the parameters take effect. */
  effectiveFrom: string;
  /** Indexante dos Apoios Sociais for the year. */
  ias: number;
  /** Annual exempt-income ceiling as a multiple of IAS (55 for 2026). */
  capMultiplier: number;
  /** Payments the annual ceiling is divided across at source (14). */
  paymentsPerYear: number;
  /** Exempt share by year of earning, index 0 = first year. */
  exemptionByYear: readonly number[];
  source: string;
  verified: boolean;
}

/** Opting into IRS Jovem for the month. */
export interface IrsJovemInput {
  /** Which year of earning this is, 1-based (1 … 10). */
  yearOfIncome: number;
}

/** Inputs to a monthly net-wage (withholding) calculation. */
export interface WageInput {
  /** Gross monthly remuneration in euros (remuneração mensal bruta). */
  grossMonthly: number;
  region: Region;
  category: TaxpayerCategory;
  /** Number of dependents (dependentes). */
  dependents: number;
  /**
   * Reference date (ISO `YYYY-MM-DD`) used to select the effective dataset.
   * Tax tables change at least yearly, so calculations are date-aware.
   */
  referenceDate: string;
  /**
   * Retribuição por isenção de horário de trabalho (IHT) for the month, in
   * euros — the specific pay owed under CT art. 265.º to a worker exempt
   * from a fixed schedule.
   *
   * Ordinary remuneration with no special tax treatment: it enters the IRS
   * withholding base and the Segurança Social base exactly like base salary.
   * It is a separate input only so the result can itemize it.
   */
  workScheduleExemption?: number;
  /**
   * Remuneração por trabalho suplementar paid this month, in euros. Withheld
   * autonomously at half the month's effective rate (CIRS art. 99.º-C n.º 8,
   * despacho 233-A/2026 §5.f) and contributory for Segurança Social.
   */
  overtime?: number;
  /**
   * Meal allowance for the month. Omit when the worker receives none — the
   * exempt portion changes neither the withholding nor the contribution.
   */
  mealAllowance?: MealAllowance;
  /**
   * Subsídios de férias / Natal received in duodécimos. Omit when both are
   * taken as lump sums.
   */
  twelfths?: TwelfthsOption;
  /**
   * The full value of one subsidy, if it differs from `grossMonthly`.
   * Defaults to `grossMonthly`, which is the ordinary case.
   */
  subsidyAmount?: number;
  /** IRS Jovem, when the worker has invoked it with the employer. */
  irsJovem?: IrsJovemInput;
}

/**
 * Parcela a abater (the amount subtracted after applying the marginal rate).
 *
 * In the official tables this is a fixed euro amount for most brackets, but
 * for the lowest brackets it is a formula of the monthly income R, written in
 * the despacho as e.g. `12,50 % × 2,60 × (1 273,85 − R)` — i.e.
 * `marginalRate × multiplier × (base − R)`.
 */
export type Deduction =
  | { kind: "fixed"; amount: number }
  | {
      kind: "formula";
      /** The constant factor the marginal rate is multiplied by (e.g. 2.60). */
      multiplier: number;
      /** The income base the formula subtracts R from (e.g. 1273.85). */
      base: number;
    };

/**
 * One row of the withholding table: for monthly income up to `upTo`, apply
 * `marginalRate` to the income and subtract the deductions.
 *
 * retenção = income × marginalRate − parcelaAbater − dependentDeduction × dependents
 *
 * (with a −1 percentage-point adjustment to `marginalRate` for 3+ dependents;
 * see the withholding calculation and despacho 233-A/2026 §5.h).
 */
export interface WithholdingBracket {
  /** Upper bound (inclusive) of monthly income in euros; `null` = top bracket. */
  upTo: number | null;
  /** Taxa marginal máxima, as a fraction (e.g. 0.241 for 24.10%). */
  marginalRate: number;
  /** Parcela a abater: fixed euros or an R-dependent formula. */
  deduction: Deduction;
  /** Parcela adicional a abater por dependente for this bracket, in euros. */
  dependentDeduction: number;
}

/** A withholding table for one taxpayer category. */
export interface WithholdingTable {
  category: TaxpayerCategory;
  /** Ordered by ascending `upTo`, top (`null`) bracket last. */
  brackets: WithholdingBracket[];
}

/**
 * A complete, versioned withholding dataset for one region and effective
 * period. Adding a new tax year is a new dataset — a data change, not a
 * logic change.
 */
export interface WithholdingDataset {
  year: number;
  region: Region;
  /** ISO `YYYY-MM-DD` the dataset takes effect. */
  effectiveFrom: string;
  /** Human-readable provenance: despacho reference + source URL. */
  source: string;
   /**
   * True only once the numbers have been transcribed from the official
   * source AND independently cross-checked (e.g. against a public simulator).
   * The flag is propagated to {@link WageResult.datasetVerified} so the UI can
   * caveat results computed from data that has not yet been double-checked —
   * it does NOT cause the engine to refuse the calculation.
   */
  verified: boolean;
  tables: WithholdingTable[];
}

/** Structured, itemized result so the UI can present the breakdown honestly. */
export interface WageResult {
  /** Base monthly remuneration, as given on the input. */
  grossMonthly: number;
  /**
   * Meal allowance split into its exempt and taxable parts. Absent when the
   * input carried no allowance.
   */
  mealAllowance?: {
    /** Total paid this month (dailyAmount × days). */
    paid: number;
    /** The part within the per-day ceiling: no IRS, no Segurança Social. */
    exempt: number;
    /** The part above the ceiling: taxed and contributed on as salary. */
    taxable: number;
    /** Ceiling per day applied, from the versioned dataset. */
    dailyLimit: number;
  };
  /** Retribuição por isenção de horário paid this month, if any. */
  workScheduleExemption?: number;
  /**
   * The amount the *salary* withholding is computed on: `grossMonthly` plus
   * any isenção de horário and any taxable meal allowance. Duodécimos are
   * deliberately excluded — CIRS art. 99.º-C n.º 5 withholds them
   * autonomously.
   */
  taxableBase: number;
  /**
   * IRS Jovem as applied this month. Absent when not opted into.
   *
   * Note `exempt` reduces the withholding base only — Segurança Social is
   * contributed on the full remuneration regardless.
   */
  irsJovem?: {
    /** Exempt share for the year of earning (1 = 100 %). */
    fraction: number;
    /** Exempt euros on the salary, after the per-payment ceiling. */
    exempt: number;
    /** The ceiling that applied to the salary payment. */
    cap: number;
    /** True when the ceiling bit, i.e. the exemption was reduced by it. */
    capped: boolean;
    /** Rate levied on the non-exempt part — from the FULL remuneration. */
    effectiveRate: number;
    /**
     * IRS that would have been withheld this month had the exemption not
     * applied — salary plus any duodécimos, at the same table rates.
     */
    withholdingWithoutExemption: number;
    /**
     * What the regime is worth this month: `withholdingWithoutExemption`
     * less the {@link WageResult.irsWithholding} actually retained.
     */
    relief: number;
  };
  /**
   * Duodécimos paid and withheld this month. Absent when the input carried
   * no `twelfths`.
   */
  twelfths?: {
    /** Amount paid this month across both subsidies. */
    paid: number;
    /** IRS withheld on it, computed autonomously. */
    withholding: number;
    /** Withholding due on one whole subsidy, before pro-rating. */
    withholdingOnFullSubsidy: number;
    /** The full-subsidy value used. */
    subsidyAmount: number;
    /**
     * The part of this month's duodécimo exempted by IRS Jovem, which has
     * its own share of the per-payment ceiling. Absent without IRS Jovem.
     */
    exempt?: number;
  };
  /**
   * Trabalho suplementar paid and withheld this month. Absent when none was
   * paid.
   */
  overtime?: {
    /** Amount paid this month. */
    paid: number;
    /** The rate levied: half the month's effective rate. */
    rate: number;
    /** IRS withheld on it, computed autonomously. */
    withholding: number;
    /** The part exempted by IRS Jovem, if any. */
    exempt?: number;
  };
  /**
   * Total IRS retenção na fonte withheld this month — salary, duodécimos and
   * trabalho suplementar, each computed separately and summed only here.
   */
  irsWithholding: number;
  /** Employee Social Security contribution (Segurança Social). */
  socialSecurity: number;
  /**
   * Take-home: base gross + meal allowance paid − withholding − social
   * security. The exempt part of the allowance is money in hand, so it is
   * included here even though it is not taxed.
   */
  netMonthly: number;
  /**
   * What the month costs the employer: everything paid to the worker plus
   * the employer's Segurança Social contribution (TSU patronal).
   *
   * Direct cost only. It deliberately excludes the mandatory seguro de
   * acidentes de trabalho, occupational health, training levies and any
   * other overhead — none of those has a statutory rate the engine could
   * apply without inventing one.
   */
  employerCost: {
    /** Everything paid to the worker this month, exempt parts included. */
    remuneration: number;
    /** Employer contribution, on the same base as the employee's. */
    socialSecurity: number;
    /** The rate applied, as a fraction (0.2375). */
    socialSecurityRate: number;
    /** `remuneration + socialSecurity`. */
    total: number;
  };
  breakdown: {
    marginalRate: number;
    deduction: number;
    dependentDeduction: number;
    socialSecurityRate: number;
  };
  /** Whether the dataset used has been independently cross-checked. */
  datasetVerified: boolean;
  /** Provenance of the dataset used (despacho reference + source URL). */
  datasetSource: string;
  /**
   * Withholding is an advance on the annual IRS settlement, not the final
   * tax. Always true for this engine (withholding-only scope).
   */
  isWithholdingEstimate: true;
}
