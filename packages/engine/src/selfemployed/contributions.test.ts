// Structural properties of the contribution calculation.
//
// The euro answers live in external-crosscheck.test.ts, against the ISS's own
// examples. What is tested here is the behaviour those four examples do not
// happen to exercise — the coefficients other than 70 %, the ENI rate, the
// interaction of the floor with the accumulation exemption, and the property
// that makes the monthly stand-in legitimate at all.

import { describe, expect, it } from "vitest";
import { SELF_EMPLOYED_CONTRIBUTIONS_2018 as PARAMS } from "../data/selfemployed-contributions-2018.js";
import {
  contributionAmount,
  contributionBase,
  periodIncome,
  relevantIncome,
} from "./contributions.js";

const IAS = 537.13; // 2026

describe("periodIncome", () => {
  it("sums a supplied quarter and reports it as given", () => {
    expect(periodIncome(0, [1000, 2000, 3000], PARAMS)).toEqual({
      total: 6000,
      given: true,
    });
  });

  it("multiplies the monthly figure up when no quarter is supplied", () => {
    expect(periodIncome(2000, undefined, PARAMS)).toEqual({
      total: 6000,
      given: false,
    });
  });

  // The property the whole form shape rests on: for steady income the
  // stand-in is not an approximation, it is the same number. If this ever
  // stopped holding, the surface field would be quietly wrong for the
  // majority case rather than merely conditional.
  it("is exact for steady income — a third of three equal months is the month", () => {
    // 9 999 is deliberately past the 12 × IAS ceiling: the two paths must
    // still agree there, which is the property the form shape needs. What
    // they agree ON is the capped base, not 70 % of the month.
    for (const monthly of [0, 500, 1234.56, 9999]) {
      const assumed = periodIncome(monthly, undefined, PARAMS);
      const given = periodIncome(0, [monthly, monthly, monthly], PARAMS);
      expect(assumed.total).toBeCloseTo(given.total, 10);

      const baseOf = (total: number) =>
        contributionBase(relevantIncome(total, "services", PARAMS), IAS, PARAMS)
          .base;
      expect(baseOf(assumed.total)).toBeCloseTo(baseOf(given.total), 10);
    }
  });

  it("puts the steady month's base at exactly 70 % of it, below the ceiling", () => {
    for (const monthly of [500, 1234.56, 5000]) {
      const { base, cappedByCeiling } = contributionBase(
        relevantIncome(periodIncome(monthly, undefined, PARAMS).total, "services", PARAMS),
        IAS,
        PARAMS,
      );
      expect(cappedByCeiling).toBe(false);
      expect(base).toBeCloseTo(monthly * 0.7, 10);
    }
  });
});

describe("relevantIncome", () => {
  it("applies 70 % to services", () => {
    expect(relevantIncome(6000, "services", PARAMS)).toBeCloseTo(4200, 2);
  });

  it("applies 20 % to the sale of goods", () => {
    expect(relevantIncome(6000, "goods", PARAMS)).toBeCloseTo(1200, 2);
  });

  // The three-way split, pinned. Hospitality is a prestação de serviços that
  // takes the goods coefficient; anyone "simplifying" the type to a two-way
  // services/goods split has to delete this test first, and would be charging
  // a restaurant 3,5 times what it owes.
  it("applies 20 %, not 70 %, to hospitality despite it being a service", () => {
    expect(relevantIncome(6000, "hospitality", PARAMS)).toBeCloseTo(1200, 2);
    expect(relevantIncome(6000, "hospitality", PARAMS)).not.toBeCloseTo(
      relevantIncome(6000, "services", PARAMS),
      2,
    );
  });

  describe("propriedade intelectual", () => {
    it("is outside the base by default", () => {
      expect(relevantIncome(6000, "intellectual-property", PARAMS)).toBe(0);
    });

    // Opting in restores the ORDINARY treatment rather than applying a rate of
    // its own — which is why the dataset records 70 % here and the exclusion
    // lives in the engine. If the opt-in produced anything other than the
    // services answer, one of the two has drifted.
    it("takes the ordinary services coefficient once opted in", () => {
      expect(relevantIncome(6000, "intellectual-property", PARAMS, true))
        .toBeCloseTo(relevantIncome(6000, "services", PARAMS), 2);
    });

    it("ignores the opt-in for every other activity", () => {
      for (const activity of ["services", "goods", "hospitality"] as const) {
        expect(relevantIncome(6000, activity, PARAMS, true)).toBeCloseTo(
          relevantIncome(6000, activity, PARAMS),
          2,
        );
      }
    });
  });
});

describe("contributionBase", () => {
  it("divides the period's relevant income by three", () => {
    const { base } = contributionBase(4200, IAS, PARAMS);
    expect(base).toBeCloseTo(1400, 2);
  });

  it("caps at 12 × IAS and says so", () => {
    const { base, cappedByCeiling } = contributionBase(60000, IAS, PARAMS);
    expect(base).toBeCloseTo(12 * IAS, 2);
    expect(cappedByCeiling).toBe(true);
  });

  it("reports the relief the accumulation rule removed", () => {
    const monthly = 3000;
    const { base, accumulationRelief } = contributionBase(
      monthly * 3,
      IAS,
      PARAMS,
      true,
    );
    expect(accumulationRelief).toBeCloseTo(4 * IAS, 2);
    expect(base).toBeCloseTo(monthly - 4 * IAS, 2);
  });

  it("never goes negative when the remanescente exceeds the income", () => {
    const { base, accumulationRelief } = contributionBase(
      300 * 3,
      IAS,
      PARAMS,
      true,
    );
    expect(base).toBe(0);
    // The relief is what was actually removed, so it stops at the income —
    // reporting 4 × IAS here would claim a relief larger than the base it came
    // from, and the UI would print a number that does not reconcile.
    expect(accumulationRelief).toBeCloseTo(300, 2);
  });
});

describe("contributionAmount", () => {
  it("applies the ordinary rate", () => {
    const { amount, rate } = contributionAmount(1400, PARAMS);
    expect(rate).toBe(0.214);
    expect(amount).toBeCloseTo(299.6, 2);
  });

  it("applies the higher ENI/EIRL rate when asked", () => {
    const { amount, rate } = contributionAmount(1400, PARAMS, {
      soleTrader: true,
    });
    expect(rate).toBe(0.252);
    expect(amount).toBeCloseTo(352.8, 2);
  });

  // The floor is on the CONTRIBUTION. Read as a floor on the base it would
  // give 20 × 21,4 % = 4,28 €, and the guide's own Marta example says 20,00 €.
  it("floors the contribution at 20 €, not the base", () => {
    const { amount, atMinimum } = contributionAmount(0, PARAMS);
    expect(amount).toBe(20);
    expect(atMinimum).toBe(true);
    expect(amount).not.toBeCloseTo(20 * PARAMS.rate, 2);
  });

  it("floors a small but non-zero base too", () => {
    // 50 € of base owes 10,70 €, which the floor lifts to 20 €.
    expect(contributionAmount(50, PARAMS).amount).toBe(20);
  });

  // The floor and the accumulation exemption pull opposite ways, and the
  // exemption wins: a partial exemption is the statute removing the
  // contribution, and a floor cannot resurrect what was just removed.
  it("does not apply the floor to a worker exempted by accumulation", () => {
    const { amount, atMinimum } = contributionAmount(0, PARAMS, {
      exemptByAccumulation: true,
    });
    expect(amount).toBe(0);
    expect(atMinimum).toBe(false);
  });

  it("still applies the floor to a zero base that is NOT an accumulation case", () => {
    expect(contributionAmount(0, PARAMS, { exemptByAccumulation: false }).amount)
      .toBe(20);
  });
});
