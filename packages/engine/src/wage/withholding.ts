// Monthly net wage: assembling salary withholding, meal allowance,
// duodécimos and Segurança Social into one result.

import type {
  IrsJovemRegime,
  MealAllowanceLimits,
  WageInput,
  WageResult,
  WithholdingDataset,
} from "../types.js";
import { irsJovemExemption } from "./irs-jovem.js";
import { splitMealAllowance } from "./meal.js";
import { twelfthsDetail } from "./twelfths.js";
import {
  EMPLOYEE_SOCIAL_SECURITY_RATE,
  socialSecurityContribution,
} from "./segsocial.js";
import { selectBracket, selectTable } from "./resolver.js";
import { withholdingDetailForBracket } from "./withholding-core.js";

export {
  withholdingDetailForBracket,
  withholdingForBracket,
} from "./withholding-core.js";
export type { WithholdingDetail } from "./withholding-core.js";

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
  jovemRegime?: IrsJovemRegime,
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
  // IRS Jovem: art. 99.º-F n.º 4 takes the rate from the FULL remuneration —
  // exempt part included — and levies it only on the non-exempt part.
  let jovem;
  let salaryWithholding = detail.withholding;
  if (input.irsJovem) {
    if (!jovemRegime) {
      throw new Error(
        "IRS Jovem was requested but no IrsJovemRegime dataset was passed.",
      );
    }
    const effectiveRate =
      taxableBase > 0 ? detail.withholding / taxableBase : 0;
    const exemption = irsJovemExemption(
      taxableBase,
      input.irsJovem.yearOfIncome,
      jovemRegime,
    );
    salaryWithholding = effectiveRate * exemption.taxable;
    jovem = {
      fraction: exemption.fraction,
      exempt: exemption.exempt,
      cap: exemption.cap,
      capped: exemption.capped,
      effectiveRate,
    };
  }

  // Subsídios in duodécimos: withheld autonomously (art. 99.º-C n.º 5), but
  // they do count as remuneration for Segurança Social.
  let twelfths;
  if (input.twelfths) {
    twelfths = twelfthsDetail(
      input.twelfths,
      input.subsidyAmount ?? input.grossMonthly,
      input.dependents,
      table,
      input.irsJovem && jovemRegime
        ? { input: input.irsJovem, regime: jovemRegime }
        : undefined,
    );
  }

  const irsWithholding = salaryWithholding + (twelfths?.withholding ?? 0);
  const socialSecurity = socialSecurityContribution(
    taxableBase + (twelfths?.paid ?? 0),
  );
  const netMonthly =
    input.grossMonthly +
    (meal?.paid ?? 0) +
    (twelfths?.paid ?? 0) -
    irsWithholding -
    socialSecurity;

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
    ...(jovem ? { irsJovem: jovem } : {}),
    ...(twelfths
      ? {
          twelfths: {
            paid: twelfths.paid,
            withholding: twelfths.withholding,
            withholdingOnFullSubsidy: twelfths.withholdingOnFullSubsidy,
            subsidyAmount: twelfths.subsidyAmount,
          },
        }
      : {}),
    irsWithholding,
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
