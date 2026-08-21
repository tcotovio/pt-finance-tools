import { describe, expect, it } from "vitest";
import type { Percentiles } from "@pt-finance-tools/engine";
import { markerOffset, positionIn } from "./market-position.js";

/** The published instalment distribution: all five points. */
const full: Percentiles = { p10: 156, p25: 242, median: 351, p75: 540, p90: 789 };
/** The variable-rate distribution: BdP omits the first quartile. */
const partial: Percentiles = { p10: 0.0265, median: 0.0319, p75: 0.0343, p90: 0.0366 };

describe("positionIn", () => {
  it("puts a published percentile exactly on its own share", () => {
    expect(positionIn(242, full).percentile).toBeCloseTo(0.25, 10);
    expect(positionIn(351, full).percentile).toBeCloseTo(0.5, 10);
    expect(positionIn(540, full).percentile).toBeCloseTo(0.75, 10);
  });

  it("interpolates linearly between two published points", () => {
    // Halfway from the median (351) to p75 (540) is halfway from 50 % to 75 %.
    expect(positionIn((351 + 540) / 2, full).percentile).toBeCloseTo(0.625, 10);
  });

  it("refuses to extrapolate past the published tails", () => {
    // What a distribution does beyond its published points is exactly what
    // the publisher declined to say, so this clamps and flags rather than
    // inventing a 97th percentile.
    const high = positionIn(2000, full);
    expect(high.percentile).toBeCloseTo(0.9, 10);
    expect(high.beyondPublished).toBe(true);
    expect(high.tail).toBe("above");

    const low = positionIn(50, full);
    expect(low.percentile).toBeCloseTo(0.1, 10);
    expect(low.tail).toBe("below");
  });

  it("treats the boundary values themselves as the tails", () => {
    expect(positionIn(156, full).beyondPublished).toBe(true);
    expect(positionIn(789, full).beyondPublished).toBe(true);
  });

  it("works on a series missing a quartile", () => {
    // Skipping straight from p10 to the median, since p25 is not published.
    const mid = positionIn((0.0265 + 0.0319) / 2, partial);
    expect(mid.percentile).toBeCloseTo(0.3, 10);
    expect(mid.beyondPublished).toBe(false);
  });

  it("never reports a share outside 10–90 %", () => {
    for (const value of [0, 100, 156, 300, 789, 5000]) {
      const { percentile } = positionIn(value, full);
      expect(percentile).toBeGreaterThanOrEqual(0.1);
      expect(percentile).toBeLessThanOrEqual(0.9);
    }
  });
});

describe("markerOffset", () => {
  it("places the tails at the ends of the track", () => {
    expect(markerOffset(156, full)).toBeCloseTo(0, 10);
    expect(markerOffset(789, full)).toBeCloseTo(1, 10);
  });

  it("is positional along p10–p90, not proportional to the value", () => {
    // The track IS the published range; a value's magnitude is irrelevant to
    // where it sits on it.
    expect(markerOffset(351, full)).toBeCloseTo((351 - 156) / (789 - 156), 10);
  });

  it("clamps rather than escaping the plot", () => {
    expect(markerOffset(10_000, full)).toBe(1);
    expect(markerOffset(-500, full)).toBe(0);
  });

  it("survives a degenerate range", () => {
    const flat: Percentiles = { p10: 5, median: 5, p90: 5 };
    expect(markerOffset(5, flat)).toBe(0);
  });
});
