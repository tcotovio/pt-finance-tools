// Taxa mista — the dominant Portuguese mortgage product, and the one the
// stress test treats differently from both of the others.
//
// Instrução 23/2023 art. 1.º n.º 2, verbatim:
//
//   "Quando esteja em causa a celebração de um contrato de crédito a taxa de
//    juro mista, a instituição deve […] considerar:
//    a) O montante dos encargos associados ao cumprimento das obrigações
//       decorrentes do contrato de crédito após o termo do período de taxa de
//       juro fixa, assumindo um aumento do indexante em, pelo menos, 0,5, 1 ou
//       1,5 pontos percentuais, consoante o contrato de crédito tenha,
//       respetivamente, duração igual ou inferior a 5 anos, superior a 5 anos
//       e igual ou inferior a 10 anos, ou superior a 10 anos; ou
//    b) O montante dos encargos associados ao cumprimento das obrigações
//       decorrentes do contrato de crédito durante o período de taxa de juro
//       fixa, se o referido montante for superior ao que resulta da aplicação
//       do disposto na alínea anterior."
//
// So the tested instalment is the HIGHER of the two — not the first, and not
// an average. Three details the wording settles:
//
//   * the shock band comes from the contract's own duration ("o contrato de
//     crédito tenha … duração"), not from the length of the fixed period, so a
//     30-year mista with 5 fixed years still takes 1,5 p.p.;
//   * al. a) is the instalment *after* the fixed period ends, which is
//     computed on the balance outstanding at that point over the remaining
//     term — not on the original capital over the original term;
//   * al. b) exists because a high fixed teaser followed by a low variable
//     rate must not test as cheap; whichever leg is dearer governs.
//
// Everything here is linear in the principal — annuities are, and so is the
// balance after k months — which is what lets the reverse solver keep
// inverting analytically instead of searching.

import { monthlyPayment, monthlyRate } from "./amortization.js";

/** Which leg of art. 1.º n.º 2 produced the tested instalment. */
export type MixedStressBasis = "post-fixed" | "fixed-period";

/** A mista contract's shape: fixed for a while, then indexed. */
export interface MixedRateTerms {
  /** Years the rate is fixed for. Must be shorter than the contract. */
  fixedPeriodYears: number;
  /** The fixed rate itself, as a fraction. */
  fixedRate: number;
}

export interface MixedStressResult {
  /** The instalment the DSTI test uses: the higher of the two legs. */
  stressedPayment: number;
  basis: MixedStressBasis;
  /** Instalment during the fixed period — what the borrower first pays. */
  fixedPeriodPayment: number;
  /** Instalment after the fixed period, at the shocked indexed rate. */
  postFixedPayment: number;
  /** Capital still owed when the fixed period ends. */
  balanceAtSwitch: number;
  /** The indexed rate after the shock. */
  stressedPostFixedRate: number;
}

/**
 * Capital outstanding after `months` of a loan amortized at `annualRate` with
 * the instalment that repays it over `totalMonths`.
 *
 * Closed form rather than a schedule walk: this runs inside the reverse
 * solver, and iterating 480 periods to invert one annuity would be wasteful.
 */
export function balanceAfter(
  principal: number,
  annualRate: number,
  totalMonths: number,
  months: number,
): number {
  if (!Number.isInteger(months) || months < 0) {
    throw new Error("months must be a non-negative integer.");
  }
  if (months > totalMonths) {
    throw new Error("months must not exceed the contract's own term.");
  }
  const payment = monthlyPayment(principal, annualRate, totalMonths);
  const r = monthlyRate(annualRate);
  if (r === 0) return principal - payment * months;

  const growth = (1 + r) ** months;
  return principal * growth - payment * ((growth - 1) / r);
}

/**
 * The instalment art. 1.º n.º 2 tests a mista contract at.
 *
 * @param principal      amount borrowed
 * @param terms          the fixed leg
 * @param indexedRate    the rate that applies afterwards (indexante + spread)
 * @param shock          the p.p. increase for the contract's own duration
 * @param totalMonths    the whole term
 */
export function mixedStressedPayment(
  principal: number,
  terms: MixedRateTerms,
  indexedRate: number,
  shock: number,
  totalMonths: number,
): MixedStressResult {
  const fixedMonths = Math.round(terms.fixedPeriodYears * 12);
  if (fixedMonths <= 0) {
    throw new Error("fixedPeriodYears must be greater than zero.");
  }
  if (fixedMonths >= totalMonths) {
    throw new Error(
      "fixedPeriodYears must be shorter than the contract; a rate fixed for " +
        "the whole term is taxa fixa, not taxa mista.",
    );
  }

  const fixedPeriodPayment = monthlyPayment(
    principal,
    terms.fixedRate,
    totalMonths,
  );
  const balanceAtSwitch = balanceAfter(
    principal,
    terms.fixedRate,
    totalMonths,
    fixedMonths,
  );
  const stressedPostFixedRate = indexedRate + shock;
  const postFixedPayment = monthlyPayment(
    balanceAtSwitch,
    stressedPostFixedRate,
    totalMonths - fixedMonths,
  );

  // "se o referido montante for superior" — the dearer leg governs.
  const usesFixed = fixedPeriodPayment > postFixedPayment;

  return {
    stressedPayment: usesFixed ? fixedPeriodPayment : postFixedPayment,
    basis: usesFixed ? "fixed-period" : "post-fixed",
    fixedPeriodPayment,
    postFixedPayment,
    balanceAtSwitch,
    stressedPostFixedRate,
  };
}

/**
 * The largest principal whose tested instalment does not exceed `budget`.
 *
 * Both legs scale linearly with the principal, so the whole max() does too:
 * price one euro of borrowing and divide. No search, and exact.
 */
export function mixedPrincipalForBudget(
  budget: number,
  terms: MixedRateTerms,
  indexedRate: number,
  shock: number,
  totalMonths: number,
): number {
  if (budget <= 0) return 0;
  const perEuro = mixedStressedPayment(
    1,
    terms,
    indexedRate,
    shock,
    totalMonths,
  ).stressedPayment;
  return budget / perEuro;
}
