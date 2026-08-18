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
   * Meal allowance for the month. Omit when the worker receives none — the
   * exempt portion changes neither the withholding nor the contribution.
   */
  mealAllowance?: MealAllowance;
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
  /**
   * The amount both the withholding and the contribution are computed on:
   * `grossMonthly` plus any taxable meal allowance.
   */
  taxableBase: number;
  /** IRS retenção na fonte withheld this month. */
  irsWithholding: number;
  /** Employee Social Security contribution (Segurança Social). */
  socialSecurity: number;
  /**
   * Take-home: base gross + meal allowance paid − withholding − social
   * security. The exempt part of the allowance is money in hand, so it is
   * included here even though it is not taxed.
   */
  netMonthly: number;
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
