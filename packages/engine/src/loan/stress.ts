// The two adjustments the DSTI test makes before comparing to the ceiling:
// a shock to the new contract's rate, and a haircut to income for the part of
// the contract lived past 70.
//
// Both are prescribed, both are easy to get subtly wrong, and each is one
// function here so the reverse solver reads as the rule does.

import type {
  BorrowerProfile,
  InterestRateShock,
  MacroprudentialParameters,
} from "../types.js";

/**
 * The rate shock for a contract of `termYears`, per Instrução 23/2023 art. 1.º.
 *
 * Bands are inclusive at the top ("prazo igual ou inferior a 5 anos"), so a
 * contract of exactly 10 years takes 1 p.p. rather than 1,5.
 */
export function shockForTerm(
  termYears: number,
  shockTable: InterestRateShock,
): number {
  if (!Number.isFinite(termYears) || termYears <= 0) {
    throw new Error("termYears must be a positive number.");
  }
  const band = shockTable.bands.find(
    (b) => b.upToYears === null || termYears <= b.upToYears,
  );
  if (!band) {
    throw new Error(
      "Interest rate shock table has no open-ended band; cannot price a term.",
    );
  }
  return band.shock;
}

/**
 * The maturity ceiling for a borrower's age (Recomendação art. 7.º n.º 1),
 * and so the term the solver may actually use.
 */
export function maturityCeiling(
  age: number,
  params: MacroprudentialParameters,
): number {
  const { ageThreshold, yearsAtOrBelowThreshold, yearsAboveThreshold } =
    params.maturity;
  return age <= ageThreshold ? yearsAtOrBelowThreshold : yearsAboveThreshold;
}

/**
 * The income reduction of art. 4.º n.º 5 al. b), as a fraction of income.
 *
 * The rule is *weighted*, and that is the whole subtlety: a 40-year-old on a
 * 35-year loan finishes at 75, so only 5 of the 35 years fall past 70 and the
 * 20 % haircut is scaled to 5/35 of itself — roughly 2,9 %, not 20 %. Applying
 * the full 20 % (the intuitive reading) would understate borrowing capacity
 * for most middle-aged borrowers.
 *
 * Returns 0 when the borrower is already retired at assessment, when the
 * contract ends at or before 70, or when there is nothing to weight.
 */
export function incomeReductionFraction(
  borrower: BorrowerProfile,
  termYears: number,
  params: MacroprudentialParameters,
): number {
  if (borrower.retired) return 0;

  const { age: thresholdAge, fraction } = params.incomeReduction;
  const ageAtMaturity = borrower.age + termYears;
  if (ageAtMaturity <= thresholdAge) return 0;

  // Years of the contract during which the borrower is over the threshold,
  // clamped to the contract itself — a borrower already past 70 has all of it.
  const yearsOverThreshold = Math.min(termYears, ageAtMaturity - thresholdAge);
  return fraction * (yearsOverThreshold / termYears);
}

/** Income as the DSTI denominator sees it, after any reduction. */
export function adjustedIncome(
  borrower: BorrowerProfile,
  termYears: number,
  params: MacroprudentialParameters,
): number {
  const reduction = incomeReductionFraction(borrower, termYears, params);
  return borrower.monthlyIncome * (1 - reduction);
}
