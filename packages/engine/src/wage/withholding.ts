// Monthly IRS withholding (retenção na fonte) — marginal-rate model.

import type {
  Deduction,
  MealAllowanceLimits,
  WageInput,
  WageResult,
  WithholdingBracket,
  WithholdingDataset,
} from "../types.js";
import { splitMealAllowance } from "./meal.js";
import {
  EMPLOYEE_SOCIAL_SECURITY_RATE,
  socialSecurityContribution,
} from "./segsocial.js";
import { selectBracket, selectTable } from "./resolver.js";

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

/**
 * Compute the monthly net wage from an already-selected dataset.
 *
 * The dataset is passed in (rather than looked up here) to keep this a pure
 * function of its inputs. Callers resolve the correct dataset for the input's
 * region and `referenceDate` first.
 */
export function computeNetWage(
  input: WageInput,
  dataset: WithholdingDataset,
  mealLimits?: MealAllowanceLimits,
): WageResult {
  if (input.region !== dataset.region) {
    throw new Error(
      `Dataset region "${dataset.region}" does not match input region "${input.region}".`,
    );
  }
  if (input.dependents < 0 || !Number.isInteger(input.dependents)) {
    throw new Error(`dependents must be a non-negative integer, got ${input.dependents}.`);
  }

  // Meal allowance above the daily ceiling is ordinary remuneration: it
  // raises the bracket lookup, the withholding and the contribution alike.
  let meal;
  if (input.mealAllowance) {
    if (!mealLimits) {
      throw new Error(
        "A meal allowance was given but no MealAllowanceLimits dataset was passed.",
      );
    }
    meal = splitMealAllowance(input.mealAllowance, mealLimits);
  }

  const taxableBase = input.grossMonthly + (meal?.taxable ?? 0);

  const table = selectTable(dataset, input.category);
  const bracket = selectBracket(table, taxableBase);

  const detail = withholdingDetailForBracket(
    taxableBase,
    input.dependents,
    bracket,
  );
  const socialSecurity = socialSecurityContribution(taxableBase);
  const netMonthly =
    input.grossMonthly + (meal?.paid ?? 0) - detail.withholding - socialSecurity;

  return {
    grossMonthly: input.grossMonthly,
    ...(meal
      ? {
          mealAllowance: {
            paid: meal.paid,
            exempt: meal.exempt,
            taxable: meal.taxable,
            dailyLimit: meal.dailyLimit,
          },
        }
      : {}),
    taxableBase,
    irsWithholding: detail.withholding,
    socialSecurity,
    netMonthly,
    breakdown: {
      marginalRate: detail.effectiveRate,
      deduction: detail.parcelaAbater,
      dependentDeduction: detail.dependentDeduction,
      socialSecurityRate: EMPLOYEE_SOCIAL_SECURITY_RATE,
    },
    datasetVerified: dataset.verified,
    datasetSource: dataset.source,
    isWithholdingEstimate: true,
  };
}
