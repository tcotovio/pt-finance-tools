// What the month costs the employer.
//
// The employer's 23,75% and the employee's 11% are the two halves of the
// 34,75% taxa contributiva global (Código Contributivo art. 53.º), levied on
// the same base — which is what these tests pin.

import { describe, expect, it } from "vitest";
import { computeNetWage } from "./withholding.js";
import { CONTINENTE_2026 } from "../data/continente-2026.js";
import { MEAL_ALLOWANCE_2026 } from "../data/meal-allowance-2026.js";
import { IRS_JOVEM_2026 } from "../data/irs-jovem-2026.js";

const base = {
  region: "continente",
  category: "unmarried",
  dependents: 0,
  referenceDate: "2026-08-19",
} as const;

const compute = (input: Parameters<typeof computeNetWage>[0]) =>
  computeNetWage(input, CONTINENTE_2026, MEAL_ALLOWANCE_2026, IRS_JOVEM_2026);

describe("employer cost", () => {
  it("is the salary plus 23,75% on a plain month", () => {
    const { employerCost } = compute({ ...base, grossMonthly: 1500 });

    expect(employerCost.socialSecurityRate).toBe(0.2375);
    expect(employerCost.remuneration).toBe(1500);
    expect(employerCost.socialSecurity).toBeCloseTo(356.25, 2);
    expect(employerCost.total).toBeCloseTo(1856.25, 2);
  });

  it("contributes on the same base as the employee", () => {
    const result = compute({
      ...base,
      grossMonthly: 1500,
      workScheduleExemption: 330,
      mealAllowance: { dailyAmount: 12, days: 22, method: "card" },
      twelfths: { holiday: 1, christmas: 1 },
    });

    // 23,75 / 11 is the ratio of the two halves of art. 53.º — if the bases
    // ever diverged, this is what would catch it.
    expect(result.employerCost.socialSecurity / result.socialSecurity).toBeCloseTo(
      0.2375 / 0.11,
      10,
    );
  });

  it("counts the exempt meal allowance as cost but not as contribution", () => {
    const withMeal = compute({
      ...base,
      grossMonthly: 1500,
      // Exactly at the card ceiling: all exempt, so nothing is contributory.
      mealAllowance: { dailyAmount: 10.46, days: 22, method: "card" },
    });
    const withoutMeal = compute({ ...base, grossMonthly: 1500 });

    expect(withMeal.employerCost.remuneration).toBeCloseTo(1500 + 230.12, 2);
    expect(withMeal.employerCost.socialSecurity).toBeCloseTo(
      withoutMeal.employerCost.socialSecurity,
      10,
    );
    expect(withMeal.employerCost.total).toBeCloseTo(
      withoutMeal.employerCost.total + 230.12,
      2,
    );
  });

  it("includes the isenção de horário and the duodécimos", () => {
    const result = compute({
      ...base,
      grossMonthly: 1500,
      workScheduleExemption: 330,
      twelfths: { holiday: 1, christmas: 1 },
    });

    // 1500 + 330 + (1500/12 × 2) = 2080 paid out.
    expect(result.employerCost.remuneration).toBeCloseTo(2080, 2);
    expect(result.employerCost.socialSecurity).toBeCloseTo(2080 * 0.2375, 2);
  });

  it("is unaffected by IRS, which is the worker's tax and not a cost", () => {
    const plain = compute({ ...base, grossMonthly: 1500 });
    const exempt = compute({
      ...base,
      grossMonthly: 1500,
      irsJovem: { yearOfIncome: 1 },
    });

    // IRS Jovem changes what the worker takes home, never what the employer
    // pays: withholding is money the employer forwards, not money it spends.
    expect(exempt.irsWithholding).toBeLessThan(plain.irsWithholding);
    expect(exempt.employerCost.total).toBeCloseTo(plain.employerCost.total, 10);
  });
});
