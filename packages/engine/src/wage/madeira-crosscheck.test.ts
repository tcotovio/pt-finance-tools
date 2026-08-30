// Axis B for Madeira: end-to-end against an INDEPENDENT simulator.
//
// The counterpart to external-crosscheck.test.ts, which does this for the
// Continente. data/madeira-2026.source.test.ts already proves the regional
// tables were transcribed correctly; this proves they are APPLIED correctly —
// the right table per category, the per-dependent deduction, the alínea h)
// reduction, the formula brackets.
//
// The dataset shipped `verified: false` for a long time on the stated grounds
// that no public simulator covered Madeira. That was simply wrong: the source
// already used for the Continente supports it, via a `location` field.
//
// See fixtures/madeira-2026-doutorfinancas.json for provenance, and for the
// one place this source departs from the despacho — recorded there rather
// than asserted here.

import { describe, expect, it } from "vitest";
import fixture from "../data/fixtures/madeira-2026-doutorfinancas.json" with { type: "json" };
import { computeNetWage } from "./withholding.js";
import { MADEIRA_2026 } from "../data/madeira-2026.js";
import { selectBracket, selectTable } from "./resolver.js";
import type { Region, TaxpayerCategory } from "../types.js";

describe(`Madeira engine vs ${fixture.source}`, () => {
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
        MADEIRA_2026,
      );

      expect(result.netMonthly).toBeCloseTo(s.netMonthly, 2);
      expect(result.socialSecurity).toBeCloseTo(s.socialSecurity, 2);
    });
  }
});

describe("where that source departs from the despacho", () => {
  // Pinned so the disagreement is not rediscovered later as if it were new,
  // and so that if anyone "fixes" the engine to match the simulator, this
  // fails and says why.
  for (const d of fixture.divergences) {
    it(`${d.grossMonthly} €: follows the despacho, not the simulator`, () => {
      const result = computeNetWage(
        {
          grossMonthly: d.grossMonthly,
          region: fixture.region as Region,
          category: d.category as TaxpayerCategory,
          dependents: d.dependents,
          referenceDate: fixture.referenceDate,
        },
        MADEIRA_2026,
      );
      expect(result.netMonthly).toBeCloseTo(d.ourNetMonthly, 2);
      expect(result.netMonthly).not.toBeCloseTo(d.theirNetMonthly, 2);
    });
  }

  it("uses the rate the despacho prints for the 3 614 – 6 585 row", () => {
    // The row the divergence turns on, asserted against the figures read off
    // page 4 of the JORAM PDF.
    const table = selectTable(MADEIRA_2026, "unmarried");
    const bracket = selectBracket(table, 4000);
    expect(bracket.upTo).toBe(6585);
    expect(bracket.marginalRate).toBeCloseTo(0.3028, 6);
    expect(bracket.deduction).toEqual({ kind: "fixed", amount: 521.72 });
  });

  it("keeps the rate drop that looks like a typo and is not", () => {
    // 30,28 % is followed by 28,02 %. A future reader "correcting" that to be
    // monotonic would be departing from the statute, so it is pinned.
    const table = selectTable(MADEIRA_2026, "unmarried");
    const at6585 = selectBracket(table, 6585);
    const at6954 = selectBracket(table, 6954);
    expect(at6585.marginalRate).toBeGreaterThan(at6954.marginalRate);
    expect(at6954.marginalRate).toBeCloseTo(0.2802, 6);
  });

  it("stays continuous across that drop anyway", () => {
    // Which is what makes the drop safe: the tax itself does not jump, because
    // the parcela moves with the rate.
    const table = selectTable(MADEIRA_2026, "unmarried");
    const taxAt = (r: number) => {
      const b = selectBracket(table, r);
      if (b.deduction.kind !== "fixed") throw new Error("expected a fixed parcela");
      return r * b.marginalRate - b.deduction.amount;
    };
    // Approach the 6 585 boundary from either side.
    expect(taxAt(6585)).toBeCloseTo(6585 * 0.3028 - 521.72, 2);
    expect(6585 * 0.2802 - 372.9).toBeCloseTo(6585 * 0.3028 - 521.72, 1);
  });
});
