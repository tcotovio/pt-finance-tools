// The ISS's own worked examples, applied end to end.
//
// Not full Axis B, and the fixture says why: the examples share a document
// with the parameters they exercise, so a rule the guide states wrongly would
// be reproduced wrongly on both sides. What they DO catch is the class of
// error a parameter diff cannot — applying correct parameters in the wrong
// order, capping before subtracting the remanescente, or reading the 20 €
// floor as a floor on the base.
//
// Every example is written against the 2025 IAS, which is why the tests pass
// 522,50 explicitly. The pure functions take IAS as a parameter for exactly
// this reason.

import { describe, expect, it } from "vitest";
import fixture from "./fixtures/iss-guia-1009.json" with { type: "json" };
import { SELF_EMPLOYED_CONTRIBUTIONS_2018 as PARAMS } from "../data/selfemployed-contributions-2018.js";
import type { SelfEmployedActivity } from "../types.js";
import {
  contributionAmount,
  contributionBase,
  periodIncome,
  relevantIncome,
} from "./contributions.js";

describe("engine vs the ISS Guia Prático n.º 1009 worked examples", () => {
  it("uses the rate the examples were computed at", () => {
    expect(PARAMS.rate).toBe(fixture.rate);
  });

  for (const example of fixture.examples) {
    it(`${example.name} — ${example.what}`, () => {
      const period = periodIncome(
        // Only Paulo and João state their months; the others give the period
        // total directly, so it is fed in as a third of itself per month.
        example.periodInvoicing / PARAMS.monthsPerPeriod,
        example.quarter as [number, number, number] | undefined,
        PARAMS,
      );
      expect(period.total).toBeCloseTo(example.periodInvoicing, 2);

      const relevant = relevantIncome(
        period.total,
        example.activity as SelfEmployedActivity,
        PARAMS,
      );
      expect(relevant).toBeCloseTo(example.expectedRelevantIncome, 2);

      const accumulates = example.accumulatesEmployment === true;
      const { base } = contributionBase(
        relevant,
        fixture.ias,
        PARAMS,
        accumulates,
      );
      expect(base).toBeCloseTo(example.expectedBase, 2);

      const { amount } = contributionAmount(base, PARAMS, {
        exemptByAccumulation: accumulates,
      });
      expect(amount).toBeCloseTo(example.expectedContribution, 2);
    });
  }

  // The two rules that only these examples reach, pinned separately so a
  // regression names which one broke rather than failing a loop.
  it("caps at 12 × IAS rather than at the relevant income (João)", () => {
    const { base, cappedByCeiling } = contributionBase(
      42000,
      fixture.ias,
      PARAMS,
    );
    expect(cappedByCeiling).toBe(true);
    expect(base).toBeCloseTo(12 * fixture.ias, 2);
  });

  it("subtracts the remanescente before capping, not after (Paulo)", () => {
    // 5 600 − 2 090 = 3 510, which is below the 6 270 ceiling. Capping first
    // would give min(5 600, 6 270) − 2 090 = 3 510 here too, so the order is
    // only observable above the ceiling: a worker on 8 000 € of monthly
    // relevant income owes on 5 910, not on 6 270 − 2 090 = 4 180.
    const { base } = contributionBase(8000 * 3, fixture.ias, PARAMS, true);
    expect(base).toBeCloseTo(8000 - 4 * fixture.ias, 2);
  });
});
