// Axis B: end-to-end golden tests against an INDEPENDENT implementation.
//
// wage/withholding.test.ts proves the engine follows the despacho formula, and
// data/continente-2026.source.test.ts proves the table was transcribed
// correctly — but both ultimately trust our own reading of the rules. These
// scenarios come from a third party's simulator, so they catch the class of
// error the other two cannot: applying a correct table the wrong way (wrong
// table per category, misplaced §5.h reduction, bad rounding).
//
// See fixtures/continente-2026-doutorfinancas.json for provenance and for why
// `netMonthly` (not the displayed IRS line) is the field compared.

import { describe, expect, it } from "vitest";
import fixture from "../data/fixtures/continente-2026-doutorfinancas.json" with { type: "json" };
import { computeNetWage } from "./withholding.js";
import { CONTINENTE_2026 } from "../data/continente-2026.js";
import { MEAL_ALLOWANCE_2026 } from "../data/meal-allowance-2026.js";
import type {
  MealAllowanceMethod,
  Region,
  TaxpayerCategory,
} from "../types.js";

describe(`engine vs ${fixture.source}`, () => {
  for (const s of fixture.scenarios) {
    const label =
      `${s.category}, ${s.dependents} dep, ${s.grossMonthly} €` +
      (s.note ? ` — ${s.note}` : "");

    it(label, () => {
      const result = computeNetWage(
        {
          grossMonthly: s.grossMonthly,
          region: fixture.region as Region,
          category: s.category as TaxpayerCategory,
          dependents: s.dependents,
          referenceDate: fixture.referenceDate,
        },
        CONTINENTE_2026,
      );

      expect(result.netMonthly).toBeCloseTo(s.netMonthly, 2);
      expect(result.socialSecurity).toBeCloseTo(s.socialSecurity, 2);
    });
  }
  describe("meal allowance (subsídio de alimentação)", () => {
    for (const s of fixture.mealScenarios) {
      it(`${s.grossMonthly} € + ${s.meal.dailyAmount}×${s.meal.days} ${s.meal.method} — ${s.note}`, () => {
        const result = computeNetWage(
          {
            grossMonthly: s.grossMonthly,
            region: fixture.region as Region,
            category: s.category as TaxpayerCategory,
            dependents: s.dependents,
            referenceDate: fixture.referenceDate,
            mealAllowance: {
              dailyAmount: s.meal.dailyAmount,
              days: s.meal.days,
              method: s.meal.method as MealAllowanceMethod,
            },
          },
          CONTINENTE_2026,
          MEAL_ALLOWANCE_2026,
        );

        expect(result.netMonthly).toBeCloseTo(s.netMonthly, 2);
        expect(result.socialSecurity).toBeCloseTo(s.socialSecurity, 2);
      });
    }
  });
});
