// Segurança Social for trabalhadores independentes.
//
// The whole of the difficulty is that the base is not this month's income. It
// is a third of the *declared period's* relevant income, fixed for three
// months — so the honest computation takes a quarter, and a monthly figure is
// a stand-in for one whose accuracy depends on the income being steady.

import type {
  SelfEmployedActivity,
  SelfEmployedContributions,
} from "../types.js";

/** What the caller knows about the period the base is drawn from. */
export interface PeriodIncome {
  /** Turnover across the declared period, before IVA. */
  total: number;
  /** False when it was assumed from a monthly figure rather than given. */
  given: boolean;
}

/**
 * The period's turnover, from a quarter when one was supplied and from the
 * monthly figure otherwise.
 *
 * The stand-in is exact for steady income and not merely close: a third of
 * three equal months is that month. It diverges only when the months differ,
 * which is why the result carries `given` and the UI says which it used.
 */
export function periodIncome(
  monthlyInvoicing: number,
  quarter: readonly [number, number, number] | undefined,
  params: SelfEmployedContributions,
): PeriodIncome {
  if (quarter) {
    return { total: quarter[0] + quarter[1] + quarter[2], given: true };
  }
  return { total: monthlyInvoicing * params.monthsPerPeriod, given: false };
}

/**
 * Rendimento relevante: turnover after the coefficient for what the activity
 * is. Note hospitality takes the goods coefficient despite being a service.
 *
 * Propriedade intelectual is the one activity that can be outside the base
 * altogether. It is skipped here rather than given a zero coefficient, because
 * the two are only arithmetically the same: excluded income is not income
 * counted at nothing, and the difference shows the moment the worker opts in.
 */
export function relevantIncome(
  periodTotal: number,
  activity: SelfEmployedActivity,
  params: SelfEmployedContributions,
  includeIntellectualProperty = false,
): number {
  if (activity === "intellectual-property" && !includeIntellectualProperty) {
    return 0;
  }
  return periodTotal * params.coefficient[activity];
}

/** The monthly base and the two limits that can move it. */
export interface ContributionBase {
  base: number;
  cappedByCeiling: boolean;
  /** What the 4 × IAS accumulation rule removed, or zero. */
  accumulationRelief: number;
}

/**
 * The monthly contribution base: relevant income ÷ 3, less the accumulation
 * remanescente, capped at 12 × IAS.
 *
 * Order matters and follows the guia prático. The accumulation rule *defines*
 * the base for a worker who also has a salaried job ("corresponde ao valor que
 * ultrapasse aquele limite"), so the ceiling applies to what is left, not to
 * the figure before the subtraction. Capping first would let a high earner's
 * relief vanish into the ceiling.
 */
export function contributionBase(
  relevant: number,
  ias: number,
  params: SelfEmployedContributions,
  accumulatesEmployment = false,
): ContributionBase {
  const monthly = relevant / params.monthsPerPeriod;

  let base = monthly;
  let accumulationRelief = 0;
  if (accumulatesEmployment) {
    const threshold = params.accumulationThresholdMultiplier * ias;
    accumulationRelief = Math.min(monthly, threshold);
    base = Math.max(0, monthly - threshold);
  }

  const ceiling = params.ceilingMultiplier * ias;
  const cappedByCeiling = base > ceiling;
  if (cappedByCeiling) base = ceiling;

  return { base, cappedByCeiling, accumulationRelief };
}

/** The contribution owed, and which rule set it. */
export interface ContributionAmount {
  amount: number;
  rate: number;
  /** True when the 20 € floor produced the figure. */
  atMinimum: boolean;
}

/**
 * The monthly contribution: base × rate, floored at 20 €.
 *
 * The floor is on the CONTRIBUTION, not the base — the guide fixes "a base de
 * incidência que corresponda ao montante de contribuições naquele valor, ou
 * seja, 20,00 € por mês", and its own worked example has Marta paying 20 €.
 * Applying it to the base instead would charge 4,28 €.
 *
 * It does not reach a worker exempted by the accumulation rule: their partial
 * exemption is an exemption, and a floor cannot resurrect a contribution the
 * statute has just removed. A zero base from accumulation therefore stays zero,
 * where a zero base from having no income becomes 20 €.
 */
export function contributionAmount(
  base: number,
  params: SelfEmployedContributions,
  options: { soleTrader?: boolean; exemptByAccumulation?: boolean } = {},
): ContributionAmount {
  const rate = options.soleTrader ? params.soleTraderRate : params.rate;

  if (options.exemptByAccumulation && base <= 0) {
    return { amount: 0, rate, atMinimum: false };
  }

  const computed = base * rate;
  if (computed < params.minimumContribution) {
    return { amount: params.minimumContribution, rate, atMinimum: true };
  }
  return { amount: computed, rate, atMinimum: false };
}
