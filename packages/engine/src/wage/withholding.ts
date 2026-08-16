// Monthly IRS withholding (retenção na fonte) — marginal-rate model.

import type {
  WageInput,
  WageResult,
  WithholdingBracket,
  WithholdingDataset,
} from "../types.js";
import {
  EMPLOYEE_SOCIAL_SECURITY_RATE,
  socialSecurityContribution,
} from "./segsocial.js";
import { selectBracket, selectTable } from "./resolver.js";

/**
 * IRS withheld for a month, per the 2026+ formula model:
 *
 *   retenção = income × marginalRate − deduction − dependentDeduction × dependents
 *
 * Clamped at 0 (withholding is never negative — a formula result below zero
 * means no tax is withheld, not a refund at source).
 */
export function withholdingForBracket(
  grossMonthly: number,
  dependents: number,
  bracket: WithholdingBracket,
): number {
  const raw =
    grossMonthly * bracket.marginalRate -
    bracket.deduction -
    bracket.dependentDeduction * dependents;
  return Math.max(0, raw);
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
): WageResult {
  if (input.region !== dataset.region) {
    throw new Error(
      `Dataset region "${dataset.region}" does not match input region "${input.region}".`,
    );
  }
  if (input.dependents < 0 || !Number.isInteger(input.dependents)) {
    throw new Error(`dependents must be a non-negative integer, got ${input.dependents}.`);
  }

  const table = selectTable(dataset, input.category);
  const bracket = selectBracket(table, input.grossMonthly);

  const irsWithholding = withholdingForBracket(
    input.grossMonthly,
    input.dependents,
    bracket,
  );
  const socialSecurity = socialSecurityContribution(input.grossMonthly);
  const netMonthly = input.grossMonthly - irsWithholding - socialSecurity;

  return {
    grossMonthly: input.grossMonthly,
    irsWithholding,
    socialSecurity,
    netMonthly,
    breakdown: {
      marginalRate: bracket.marginalRate,
      deduction: bracket.deduction,
      dependentDeduction: bracket.dependentDeduction,
      socialSecurityRate: EMPLOYEE_SOCIAL_SECURITY_RATE,
    },
    isWithholdingEstimate: true,
  };
}
