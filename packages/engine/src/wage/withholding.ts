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
  EMPLOYER_SOCIAL_SECURITY_RATE,
  employerSocialSecurityContribution,
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
  const workScheduleExemption = input.workScheduleExemption ?? 0;
  if (workScheduleExemption < 0) {
    throw new Error(
      `workScheduleExemption must not be negative, got ${workScheduleExemption}.`,
    );
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

  // Isenção de horário is remuneração like any other: it raises the bracket
  // lookup, the withholding and the contribution alike.
  const taxableBase =
    input.grossMonthly + workScheduleExemption + (meal?.taxable ?? 0);

  const table = selectTable(dataset, input.category);
  const bracket = selectBracket(table, taxableBase);

  const detail = withholdingDetailForBracket(
    taxableBase,
    input.dependents,
    bracket,
  );
  // IRS Jovem: art. 99.º-F n.º 4 takes the rate from the FULL remuneration —
  // exempt part included — and levies it only on the non-exempt part.
  let salaryExemption;
  let salaryEffectiveRate = 0;
  let salaryWithholding = detail.withholding;
  if (input.irsJovem) {
    if (!jovemRegime) {
      throw new Error(
        "IRS Jovem was requested but no IrsJovemRegime dataset was passed.",
      );
    }
    salaryEffectiveRate =
      taxableBase > 0 ? detail.withholding / taxableBase : 0;
    salaryExemption = irsJovemExemption(
      taxableBase,
      input.irsJovem.yearOfIncome,
      jovemRegime,
    );
    salaryWithholding = salaryEffectiveRate * salaryExemption.taxable;
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

  // The baseline the exemption is measured against: what this month would
  // have withheld under the ordinary rules, salary and duodécimos alike.
  // Assembled here, after the duodécimos, so the relief covers both.
  const withholdingWithoutExemption =
    detail.withholding + (twelfths?.withholdingWithoutExemption ?? 0);
  const jovem = salaryExemption
    ? {
        fraction: salaryExemption.fraction,
        exempt: salaryExemption.exempt,
        cap: salaryExemption.cap,
        capped: salaryExemption.capped,
        effectiveRate: salaryEffectiveRate,
        withholdingWithoutExemption,
        relief: withholdingWithoutExemption - irsWithholding,
      }
    : undefined;

  const contributionBase = taxableBase + (twelfths?.paid ?? 0);
  const socialSecurity = socialSecurityContribution(contributionBase);

  // The employer contributes on the same base, at its own rate; the exempt
  // part of the meal allowance is a cost but not contributory, so it lands
  // in the remuneration and not in the contribution.
  const remunerationPaid =
    input.grossMonthly +
    workScheduleExemption +
    (meal?.paid ?? 0) +
    (twelfths?.paid ?? 0);
  const employerSocialSecurity =
    employerSocialSecurityContribution(contributionBase);
  const netMonthly =
    input.grossMonthly +
    workScheduleExemption +
    (meal?.paid ?? 0) +
    (twelfths?.paid ?? 0) -
    irsWithholding -
    socialSecurity;

  return {
    grossMonthly: input.grossMonthly,
    ...(workScheduleExemption > 0 ? { workScheduleExemption } : {}),
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
            ...(twelfths.exempt !== undefined
              ? { exempt: twelfths.exempt }
              : {}),
          },
        }
      : {}),
    irsWithholding,
    socialSecurity,
    netMonthly,
    employerCost: {
      remuneration: remunerationPaid,
      socialSecurity: employerSocialSecurity,
      socialSecurityRate: EMPLOYER_SOCIAL_SECURITY_RATE,
      total: remunerationPaid + employerSocialSecurity,
    },
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
