// "Where does my number sit?" — placing a value against a published
// distribution.
//
// BdP publishes percentiles, not the underlying data, so the honest answer is
// an interpolation between the points it does publish, bounded by them. This
// module keeps that honesty explicit: below the tenth percentile and above the
// ninetieth it says "below p10" / "above p90" rather than extrapolating a
// number nobody published.

import type { Percentiles } from "@pt-finance-tools/engine";

export interface MarketPosition {
  /**
   * Estimated share of contracts below this value, 0–1. Interpolated between
   * published percentiles — an estimate, and labelled as one in the UI.
   */
  percentile: number;
  /** True when the value falls outside the published range in either tail. */
  beyondPublished: boolean;
  /** Which end, when it does. */
  tail?: "below" | "above";
}

/** The published points, ascending, dropping the ones a series omits. */
function knownPoints(p: Percentiles): { share: number; value: number }[] {
  return [
    { share: 0.1, value: p.p10 },
    ...(p.p25 !== undefined ? [{ share: 0.25, value: p.p25 }] : []),
    { share: 0.5, value: p.median },
    ...(p.p75 !== undefined ? [{ share: 0.75, value: p.p75 }] : []),
    { share: 0.9, value: p.p90 },
  ];
}

/**
 * Place `value` in the distribution.
 *
 * Linear between adjacent published percentiles. Outside the published range
 * it clamps to p10/p90 and flags the tail, because the shape of a distribution
 * beyond its published points is exactly what the publisher declined to say.
 */
export function positionIn(
  value: number,
  percentiles: Percentiles,
): MarketPosition {
  const points = knownPoints(percentiles);
  const first = points[0];
  const last = points[points.length - 1];

  if (value <= first.value) {
    return { percentile: first.share, beyondPublished: true, tail: "below" };
  }
  if (value >= last.value) {
    return { percentile: last.share, beyondPublished: true, tail: "above" };
  }

  for (let i = 1; i < points.length; i++) {
    const lower = points[i - 1];
    const upper = points[i];
    if (value <= upper.value) {
      const span = upper.value - lower.value;
      const ratio = span === 0 ? 0 : (value - lower.value) / span;
      return {
        percentile: lower.share + ratio * (upper.share - lower.share),
        beyondPublished: false,
      };
    }
  }

  // Unreachable: the bounds above cover everything.
  return { percentile: last.share, beyondPublished: true, tail: "above" };
}

/**
 * Where a value sits along the p10–p90 axis, 0–1, for drawing a marker.
 *
 * Deliberately positional rather than proportional to the value: the strip's
 * axis IS the published range, so a value at p90 sits at 1 whatever its
 * magnitude. Clamped, so an off-scale value pins to the end instead of
 * escaping the plot.
 */
export function markerOffset(value: number, percentiles: Percentiles): number {
  const span = percentiles.p90 - percentiles.p10;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (value - percentiles.p10) / span));
}
