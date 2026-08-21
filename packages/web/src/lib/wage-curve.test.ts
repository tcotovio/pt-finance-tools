import { describe, expect, it } from "vitest";
import type { WageInput } from "@pt-finance-tools/engine";
import { buildRateCurve, nearestPoint } from "./wage-curve.js";

const base: WageInput = {
  grossMonthly: 1500,
  region: "continente",
  category: "unmarried",
  dependents: 0,
  referenceDate: "2026-08-19",
};

describe("buildRateCurve", () => {
  const points = buildRateCurve(base);

  it("samples a range that brackets ordinary Portuguese salaries", () => {
    expect(points.length).toBeGreaterThan(30);
    expect(points[0].gross).toBe(800);
    expect(points[points.length - 1].gross).toBeGreaterThanOrEqual(6000);
  });

  it("extends past the default range for a high earner", () => {
    const rich = buildRateCurve({ ...base, grossMonthly: 9000 });
    expect(rich[rich.length - 1].gross).toBeGreaterThanOrEqual(9000);
  });

  it("keeps the effective rate below the bracket rate everywhere", () => {
    // The whole point of the chart: the parcela a abater means the headline
    // rate is never what is actually withheld.
    for (const point of points) {
      expect(point.effectiveRate).toBeLessThanOrEqual(point.marginalRate + 1e-9);
    }
  });

  it("has an effective rate that only ever rises", () => {
    // Progressivity: no salary increase can lower the effective rate. A
    // regression here would mean a transcription or bracket-selection bug.
    for (let i = 1; i < points.length; i++) {
      expect(points[i].effectiveRate).toBeGreaterThanOrEqual(
        points[i - 1].effectiveRate - 1e-9,
      );
    }
  });

  it("starts at zero withholding and ends well above it", () => {
    expect(points[0].effectiveRate).toBe(0);
    expect(points[points.length - 1].effectiveRate).toBeGreaterThan(0.15);
  });

  it("ignores the month's extras, so the curve shows the tables", () => {
    // Meal allowance, duodécimos and overtime are real for the user's own
    // month but would make this a picture of their extras instead.
    const withExtras = buildRateCurve({
      ...base,
      mealAllowance: { dailyAmount: 10, days: 22, method: "card" },
      twelfths: { holiday: 1, christmas: 1 },
      overtime: 200,
    });
    expect(withExtras).toEqual(points);
  });

  it("adds the counterfactual only when IRS Jovem is on", () => {
    expect(points.every((p) => p.effectiveWithoutJovem === undefined)).toBe(true);

    const jovem = buildRateCurve({ ...base, irsJovem: { yearOfIncome: 1 } });
    expect(jovem.every((p) => p.effectiveWithoutJovem !== undefined)).toBe(true);
  });

  it("shows IRS Jovem costing less than the ordinary rate", () => {
    const jovem = buildRateCurve({ ...base, irsJovem: { yearOfIncome: 1 } });
    const taxed = jovem.filter((p) => (p.effectiveWithoutJovem ?? 0) > 0);
    expect(taxed.length).toBeGreaterThan(0);
    for (const point of taxed) {
      expect(point.effectiveRate).toBeLessThanOrEqual(
        (point.effectiveWithoutJovem ?? 0) + 1e-9,
      );
    }
  });

  it("returns nothing rather than throwing for an uncovered region", () => {
    // The Açores tables are not transcribed; the caller is already showing
    // that error and a chart must not raise it a second time.
    expect(buildRateCurve({ ...base, region: "acores" })).toEqual([]);
  });
});

describe("nearestPoint", () => {
  const points = buildRateCurve(base);

  it("finds the sample closest to a gross", () => {
    expect(nearestPoint(points, 1520)?.gross).toBe(1500);
    expect(nearestPoint(points, 1580)?.gross).toBe(1600);
  });

  it("clamps to the ends rather than failing", () => {
    expect(nearestPoint(points, 10)?.gross).toBe(800);
    expect(nearestPoint(points, 999_999)?.gross).toBe(
      points[points.length - 1].gross,
    );
  });

  it("returns nothing for an empty curve", () => {
    expect(nearestPoint([], 1500)).toBeUndefined();
  });
});
