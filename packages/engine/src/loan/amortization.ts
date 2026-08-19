// French amortization (prestação constante) — the forward direction: what a
// given loan costs per month.
//
//   M = P · r · (1 + r)^n / ((1 + r)^n − 1)
//
// with r the monthly rate and n the number of months. Portuguese mortgages are
// quoted as an annual nominal rate (TAN) and compounded monthly, so r is
// simply TAN / 12 — no effective-rate conversion, which is why the engine
// takes the nominal rate and reports the instalment rather than the TAEG.

import type { AmortizationPeriod, AmortizationResult } from "../types.js";

/** Months per year, named so the arithmetic below reads as intended. */
const MONTHS_PER_YEAR = 12;

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number.`);
  }
}

/** The monthly rate a nominal annual rate implies. */
export function monthlyRate(annualRate: number): number {
  assertFinite(annualRate, "annualRate");
  if (annualRate < 0) {
    throw new Error("annualRate must not be negative.");
  }
  return annualRate / MONTHS_PER_YEAR;
}

/**
 * The constant instalment for `principal` over `months` at `annualRate`.
 *
 * A zero rate is not a degenerate input to guard against but a real case —
 * subsidised and interest-free credit exists — so it takes the limit of the
 * formula, `P / n`, rather than dividing by zero.
 */
export function monthlyPayment(
  principal: number,
  annualRate: number,
  months: number,
): number {
  assertFinite(principal, "principal");
  if (principal < 0) throw new Error("principal must not be negative.");
  if (!Number.isInteger(months) || months <= 0) {
    throw new Error("months must be a positive integer.");
  }

  const r = monthlyRate(annualRate);
  if (r === 0) return principal / months;

  const growth = (1 + r) ** months;
  return (principal * r * growth) / (growth - 1);
}

/**
 * The inverse: the largest principal whose instalment does not exceed
 * `payment`. This is the arithmetic the reverse solver leans on — given a
 * budget, how much loan does it buy.
 */
export function principalForPayment(
  payment: number,
  annualRate: number,
  months: number,
): number {
  assertFinite(payment, "payment");
  if (payment < 0) throw new Error("payment must not be negative.");
  if (!Number.isInteger(months) || months <= 0) {
    throw new Error("months must be a positive integer.");
  }

  const r = monthlyRate(annualRate);
  if (r === 0) return payment * months;

  const growth = (1 + r) ** months;
  return (payment * (growth - 1)) / (r * growth);
}

/** Totals for a loan held to term, with no early repayment. */
export function amortize(
  principal: number,
  annualRate: number,
  months: number,
): AmortizationResult {
  const payment = monthlyPayment(principal, annualRate, months);
  const totalPaid = payment * months;
  return {
    principal,
    monthlyPayment: payment,
    annualRate,
    months,
    totalPaid,
    totalInterest: totalPaid - principal,
  };
}

/**
 * The full period-by-period schedule (mapa de amortização).
 *
 * The closing balance is forced to exactly zero on the last period: the
 * instalment is a real number the bank rounds to cents, so accumulating it
 * over 480 periods leaves a sub-cent residue that is an artefact of the
 * arithmetic, not a debt.
 */
export function amortizationSchedule(
  principal: number,
  annualRate: number,
  months: number,
): AmortizationPeriod[] {
  const payment = monthlyPayment(principal, annualRate, months);
  const r = monthlyRate(annualRate);

  const schedule: AmortizationPeriod[] = [];
  let balance = principal;

  for (let period = 1; period <= months; period++) {
    const interest = balance * r;
    const principalPart = payment - interest;
    balance = period === months ? 0 : balance - principalPart;
    schedule.push({
      period,
      payment,
      interest,
      principal: principalPart,
      balance,
    });
  }

  return schedule;
}
