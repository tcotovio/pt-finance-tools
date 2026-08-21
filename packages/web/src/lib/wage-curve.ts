// "How much of the next euro do I actually keep?" — the wage curve.
//
// The number people fear is the bracket's marginal rate; the number they pay is
// the effective one, which is always lower and rises smoothly. The gap between
// the two is the single most misunderstood thing about Portuguese payroll, and
// the tables the engine already ships encode the answer — so this needs no new
// data, no new source, and nothing to keep verified.
//
// The curve is deliberately built from a SIMPLIFIED input: base salary only,
// with the meal allowance, duodécimos and overtime stripped out. Those are real
// for the user's own month but would make the curve a picture of their extras
// rather than of the tables. The user's actual gross is marked on it instead.

import {
  computeNetWageForDate,
  type WageInput,
  type WageResult,
} from "@pt-finance-tools/engine";

export interface RatePoint {
  gross: number;
  /** The bracket's taxa marginal máxima at this gross, as a fraction. */
  marginalRate: number;
  /** IRS actually withheld over the gross it was withheld on. */
  effectiveRate: number;
  /**
   * What the effective rate would be without IRS Jovem. Present only when the
   * input has the regime on, which is when the comparison means anything.
   */
  effectiveWithoutJovem?: number;
}

/** Lowest gross the curve starts at — below any 2026 withholding threshold. */
const MIN_GROSS = 800;
/** Highest gross the curve reaches unless the user earns more. */
const DEFAULT_MAX_GROSS = 6000;
const STEP = 100;

/** Strip everything that is not base salary, so the curve shows the tables. */
function salaryOnly(input: WageInput, gross: number): WageInput {
  return {
    grossMonthly: gross,
    region: input.region,
    category: input.category,
    dependents: input.dependents,
    referenceDate: input.referenceDate,
    ...(input.irsJovem ? { irsJovem: input.irsJovem } : {}),
  };
}

function effectiveRateOf(result: WageResult): number {
  return result.taxableBase > 0
    ? result.irsWithholding / result.taxableBase
    : 0;
}

/**
 * Sample the withholding curve across gross salaries for one taxpayer
 * situation.
 *
 * Returns an empty array rather than throwing when the dataset cannot serve the
 * region/date — the caller is already showing that error, and a chart is not
 * the place to raise it a second time.
 */
export function buildRateCurve(input: WageInput): RatePoint[] {
  const max = Math.max(DEFAULT_MAX_GROSS, Math.ceil(input.grossMonthly / STEP) * STEP);
  const points: RatePoint[] = [];

  for (let gross = MIN_GROSS; gross <= max; gross += STEP) {
    try {
      const result = computeNetWageForDate(salaryOnly(input, gross));
      const point: RatePoint = {
        gross,
        marginalRate: result.breakdown.marginalRate,
        effectiveRate: effectiveRateOf(result),
      };

      if (input.irsJovem) {
        const { irsJovem, ...withoutJovem } = salaryOnly(input, gross);
        void irsJovem;
        point.effectiveWithoutJovem = effectiveRateOf(
          computeNetWageForDate(withoutJovem),
        );
      }

      points.push(point);
    } catch {
      return [];
    }
  }

  return points;
}

/** The point on the curve nearest a given gross, for marking the user's own. */
export function nearestPoint(
  points: RatePoint[],
  gross: number,
): RatePoint | undefined {
  if (points.length === 0) return undefined;
  return points.reduce((best, point) =>
    Math.abs(point.gross - gross) < Math.abs(best.gross - gross) ? point : best,
  );
}
