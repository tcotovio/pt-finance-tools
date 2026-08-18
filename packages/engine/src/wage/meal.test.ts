import { describe, expect, it } from "vitest";
import { splitMealAllowance } from "./meal.js";
import { MEAL_ALLOWANCE_2026 } from "../data/meal-allowance-2026.js";
import { computeNetWage } from "./withholding.js";
import { CONTINENTE_2026 } from "../data/continente-2026.js";

const limits = MEAL_ALLOWANCE_2026;

describe("splitMealAllowance", () => {
  it("treats an allowance below the ceiling as wholly exempt", () => {
    const s = splitMealAllowance(
      { dailyAmount: 5, days: 20, method: "card" },
      limits,
    );
    expect(s).toEqual({ paid: 100, exempt: 100, taxable: 0, dailyLimit: 10.46 });
  });

  it("treats an allowance exactly at the ceiling as wholly exempt", () => {
    const s = splitMealAllowance(
      { dailyAmount: 10.46, days: 22, method: "card" },
      limits,
    );
    expect(s.taxable).toBe(0);
    expect(s.exempt).toBeCloseTo(230.12, 2);
  });

  it("taxes only the per-day excess, multiplied by days", () => {
    const s = splitMealAllowance(
      { dailyAmount: 12, days: 22, method: "card" },
      limits,
    );
    expect(s.paid).toBeCloseTo(264, 2);
    expect(s.taxable).toBeCloseTo(33.88, 2); // (12 − 10.46) × 22
  });

  it("applies the lower ceiling when paid in cash", () => {
    const card = splitMealAllowance(
      { dailyAmount: 8, days: 22, method: "card" },
      limits,
    );
    const cash = splitMealAllowance(
      { dailyAmount: 8, days: 22, method: "cash" },
      limits,
    );
    expect(card.taxable).toBe(0);
    expect(cash.taxable).toBeCloseTo(40.7, 2); // (8 − 6.15) × 22
  });

  it("applies the ceiling per day, not to the monthly total", () => {
    // 5 €/day over 30 days is 150 € — well above a single day's ceiling, but
    // never taxable, because no individual day exceeds it.
    const s = splitMealAllowance(
      { dailyAmount: 5, days: 30, method: "cash" },
      limits,
    );
    expect(s.taxable).toBe(0);
  });

  it("rejects negative inputs", () => {
    expect(() =>
      splitMealAllowance({ dailyAmount: -1, days: 20, method: "card" }, limits),
    ).toThrow(/non-negative/);
  });
});

describe("computeNetWage with a meal allowance", () => {
  const base = {
    region: "continente",
    category: "unmarried",
    dependents: 0,
    referenceDate: "2026-08-18",
  } as const;

  it("adds the exempt allowance to take-home without taxing it", () => {
    const without = computeNetWage(
      { ...base, grossMonthly: 1500 },
      CONTINENTE_2026,
    );
    const with_ = computeNetWage(
      {
        ...base,
        grossMonthly: 1500,
        mealAllowance: { dailyAmount: 10, days: 20, method: "card" },
      },
      CONTINENTE_2026,
      limits,
    );

    expect(with_.irsWithholding).toBeCloseTo(without.irsWithholding, 10);
    expect(with_.socialSecurity).toBeCloseTo(without.socialSecurity, 10);
    expect(with_.netMonthly).toBeCloseTo(without.netMonthly + 200, 2);
    expect(with_.taxableBase).toBe(1500);
  });

  it("can push the taxpayer into a higher bracket via the taxable excess", () => {
    // 1 810 € sits in the 24,10 % bracket (up to 1 819 €); 20 € of taxable
    // excess carries the base past that boundary into the 31,10 % bracket.
    const result = computeNetWage(
      {
        ...base,
        grossMonthly: 1810,
        mealAllowance: { dailyAmount: 11.46, days: 20, method: "card" },
      },
      CONTINENTE_2026,
      limits,
    );
    expect(result.taxableBase).toBeCloseTo(1830, 2);
    expect(result.breakdown.marginalRate).toBe(0.311);
  });

  it("throws when an allowance is given without a limits dataset", () => {
    expect(() =>
      computeNetWage(
        {
          ...base,
          grossMonthly: 1500,
          mealAllowance: { dailyAmount: 10, days: 20, method: "card" },
        },
        CONTINENTE_2026,
      ),
    ).toThrow(/no MealAllowanceLimits/);
  });
});
