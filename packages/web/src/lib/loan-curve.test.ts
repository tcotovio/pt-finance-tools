import { describe, expect, it } from "vitest";
import type { MaxLoanInput } from "@pt-finance-tools/engine";
import { buildLoanCurve } from "./loan-curve.js";

const base: MaxLoanInput = {
  borrower: { monthlyIncome: 2000, age: 30 },
  purpose: "own-permanent-residence",
  propertyPrice: 250_000,
  annualRate: 0.038,
  termYears: 30,
  assessmentDate: "2026-09-01",
};

describe("buildLoanCurve", () => {
  const curve = buildLoanCurve(base);

  it("samples every whole term from 10 to 40 years", () => {
    expect(curve.points).toHaveLength(31);
    expect(curve.points[0].termYears).toBe(10);
    expect(curve.points[30].termYears).toBe(40);
  });

  it("holds the property ceiling flat — the term does not touch it", () => {
    const ltvs = new Set(curve.points.map((p) => p.ltv));
    expect(ltvs.size).toBe(1);
    expect([...ltvs][0]).toBeCloseTo(250_000 * 0.9, 6);
  });

  it("raises the income ceiling as the term lengthens", () => {
    for (let i = 1; i < curve.points.length; i++) {
      expect(curve.points[i].dsti).toBeGreaterThanOrEqual(
        curve.points[i - 1].dsti - 1e-6,
      );
    }
  });

  it("reports the limit as the lower of the two", () => {
    for (const point of curve.points) {
      expect(point.limit).toBeCloseTo(Math.min(point.dsti, point.ltv), 6);
    }
  });

  it("finds where the property becomes the binding limit", () => {
    // With ample income the income ceiling overtakes the property one, and
    // past that term a longer loan buys only interest.
    // 3 000 € crosses at 26 years — comfortably inside the plotted range, so
    // the sample on each side of the crossing exists.
    const rich = buildLoanCurve({
      ...base,
      borrower: { monthlyIncome: 3000, age: 30 },
    });
    expect(rich.crossoverTerm).toBeDefined();
    const at = rich.points.find((p) => p.termYears === rich.crossoverTerm)!;
    expect(at.dsti).toBeGreaterThanOrEqual(at.ltv);
    const before = rich.points.find((p) => p.termYears === rich.crossoverTerm! - 1)!;
    expect(before.dsti).toBeLessThan(before.ltv);
  });

  it("reports no crossover when income binds throughout", () => {
    expect(buildLoanCurve(base).crossoverTerm).toBeUndefined();
  });

  it("flattens at the age-based maturity ceiling, and says where", () => {
    const older = buildLoanCurve({
      ...base,
      borrower: { monthlyIncome: 2000, age: 50 },
    });
    expect(older.maturityCap).toBe(35);
    const at35 = older.points.find((p) => p.termYears === 35)!;
    const at40 = older.points.find((p) => p.termYears === 40)!;
    // Past the ceiling the engine keeps solving the capped term, so the curve
    // stops rising — which is exactly what the note explains.
    expect(at40.dsti).toBeCloseTo(at35.dsti, 6);
  });

  it("reports no cap for a borrower young enough to take 40 years", () => {
    expect(buildLoanCurve(base).maturityCap).toBeUndefined();
  });

  it("returns nothing rather than throwing for an uncovered date", () => {
    // Before 1 August 2026 the 2018 Recomendação governs and is not modelled.
    expect(
      buildLoanCurve({ ...base, assessmentDate: "2026-07-31" }).points,
    ).toEqual([]);
  });
});
