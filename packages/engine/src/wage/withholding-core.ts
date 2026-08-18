// Bracket-level IRS withholding math (retenção na fonte) — marginal-rate
// model. Kept separate from computeNetWage so the duodécimos calculation can
// reuse it without a circular import.

import type { Deduction, WithholdingBracket } from "../types.js";

/**
 * Number of dependents at or above which a −1 percentage-point reduction
 * applies to the marginal rate (despacho 233-A/2026 §5.h).
 */
const LARGE_FAMILY_DEPENDENTS = 3;
const LARGE_FAMILY_RATE_REDUCTION = 0.01;

/**
 * Resolve a parcela a abater to euros. A `formula` deduction uses the
 * bracket's *nominal* marginal rate (the §5.h reduction does not change the
 * parcela a abater — only the rate applied to R).
 */
function resolveDeduction(
  deduction: Deduction,
  nominalRate: number,
  grossMonthly: number,
): number {
  if (deduction.kind === "fixed") {
    return deduction.amount;
  }
  return nominalRate * deduction.multiplier * (deduction.base - grossMonthly);
}

/** The withholding amount plus the intermediate values actually applied. */
export interface WithholdingDetail {
  withholding: number;
  /** Marginal rate applied to income (after any §5.h reduction). */
  effectiveRate: number;
  /** Parcela a abater in euros (formula deductions resolved). */
  parcelaAbater: number;
  dependentDeduction: number;
}

/**
 * IRS withheld for a month (with intermediate values), per the 2026+ model:
 *
 *   retenção = income × marginalRate − parcelaAbater − dependentDeduction × dependents
 *
 * For 3+ dependents the marginal rate applied to income is reduced by 1
 * percentage point (§5.h); the parcela a abater is unaffected. Clamped at 0
 * (withholding is never negative — a formula result below zero means no tax
 * is withheld, not a refund at source).
 */
export function withholdingDetailForBracket(
  grossMonthly: number,
  dependents: number,
  bracket: WithholdingBracket,
): WithholdingDetail {
  const effectiveRate =
    dependents >= LARGE_FAMILY_DEPENDENTS
      ? bracket.marginalRate - LARGE_FAMILY_RATE_REDUCTION
      : bracket.marginalRate;
  const parcelaAbater = resolveDeduction(
    bracket.deduction,
    bracket.marginalRate,
    grossMonthly,
  );
  const raw =
    grossMonthly * effectiveRate -
    parcelaAbater -
    bracket.dependentDeduction * dependents;
  return {
    withholding: Math.max(0, raw),
    effectiveRate,
    parcelaAbater,
    dependentDeduction: bracket.dependentDeduction,
  };
}

/** IRS withheld for a month (see {@link withholdingDetailForBracket}). */
export function withholdingForBracket(
  grossMonthly: number,
  dependents: number,
  bracket: WithholdingBracket,
): number {
  return withholdingDetailForBracket(grossMonthly, dependents, bracket).withholding;
}
