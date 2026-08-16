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
}

/**
 * One row of the withholding table: for monthly income up to `upTo`, apply
 * `marginalRate` to the income and subtract the deductions.
 *
 * retenção = income × marginalRate − deduction − dependentDeduction × dependents
 */
export interface WithholdingBracket {
  /** Upper bound (inclusive) of monthly income in euros; `null` = top bracket. */
  upTo: number | null;
  /** Taxa marginal máxima, as a fraction (e.g. 0.13 for 13%). */
  marginalRate: number;
  /** Parcela a abater, in euros. */
  deduction: number;
  /** Parcela a abater por dependente for this bracket, in euros. */
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
   * source AND cross-checked against an independent source. Unverified
   * datasets must never be used to produce a result shown as authoritative.
   */
  verified: boolean;
  tables: WithholdingTable[];
}

/** Structured, itemized result so the UI can present the breakdown honestly. */
export interface WageResult {
  grossMonthly: number;
  /** IRS retenção na fonte withheld this month. */
  irsWithholding: number;
  /** Employee Social Security contribution (Segurança Social). */
  socialSecurity: number;
  /** Take-home: gross − withholding − social security. */
  netMonthly: number;
  breakdown: {
    marginalRate: number;
    deduction: number;
    dependentDeduction: number;
    socialSecurityRate: number;
  };
  /**
   * Withholding is an advance on the annual IRS settlement, not the final
   * tax. Always true for this engine (withholding-only scope).
   */
  isWithholdingEstimate: true;
}
