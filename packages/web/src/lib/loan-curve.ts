// "What would actually move my limit?" — the loan curve.
//
// The result panel names which of the two ceilings binds. This shows the shape
// behind that answer: how far the DSTI ceiling climbs as the term lengthens,
// against an LTV ceiling that does not move at all, and where the two cross.
//
// The crossing is the useful part. Left of it the borrower is limited by
// income and a longer term buys real capacity; right of it they are limited by
// the property, and borrowing longer buys nothing but interest.
//
// Built entirely from the engine — no new data, nothing to keep verified.

import { maxLoanForDate, type MaxLoanInput } from "@pt-finance-tools/engine";

export interface LimitPoint {
  termYears: number;
  /** What income alone would allow over this term. */
  dsti: number;
  /** What the property allows — flat, since the term does not touch it. */
  ltv: number;
  /** The lower of the two: what can actually be borrowed. */
  limit: number;
  /** True once the age-based maturity ceiling has capped this term. */
  cappedByAge: boolean;
}

/** Shortest term worth plotting; below this the instalment dominates everything. */
const MIN_TERM = 10;
const MAX_TERM = 40;

export interface LoanCurve {
  points: LimitPoint[];
  /**
   * The shortest term at which the property becomes the binding limit, i.e.
   * where lengthening the loan stops buying capacity. Absent when the DSTI
   * never catches the LTV within the plotted range.
   */
  crossoverTerm?: number;
  /** The term beyond which the age ceiling flattens the curve, if it does. */
  maturityCap?: number;
}

/**
 * Sample both ceilings across contract terms.
 *
 * Returns an empty curve rather than throwing when the parameters cannot serve
 * the assessment date — the caller already surfaces that error.
 */
export function buildLoanCurve(input: MaxLoanInput): LoanCurve {
  const points: LimitPoint[] = [];
  let crossoverTerm: number | undefined;
  let maturityCap: number | undefined;

  for (let termYears = MIN_TERM; termYears <= MAX_TERM; termYears++) {
    try {
      const result = maxLoanForDate({ ...input, termYears });
      const point: LimitPoint = {
        termYears,
        dsti: result.dsti.maxLoan,
        ltv: result.ltv.maxLoan,
        limit: result.maxLoan,
        cappedByAge: result.termCappedByAge,
      };
      points.push(point);

      if (point.cappedByAge && maturityCap === undefined) {
        // The first capped term is one past the ceiling itself.
        maturityCap = result.termYears;
      }
      if (crossoverTerm === undefined && point.dsti >= point.ltv) {
        crossoverTerm = termYears;
      }
    } catch {
      return { points: [] };
    }
  }

  return { points, crossoverTerm, maturityCap };
}
