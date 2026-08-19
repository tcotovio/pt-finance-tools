// Retribuição por isenção de horário de trabalho (CT art. 265.º).
//
// It has no special tax treatment — the point of these tests is precisely
// that: it must behave as indistinguishable from base salary, against the
// real 2026 dataset where the bracket boundaries are the ones that matter.

import { describe, expect, it } from "vitest";
import { computeNetWage } from "./withholding.js";
import { CONTINENTE_2026 } from "../data/continente-2026.js";

describe("isenção de horário de trabalho", () => {
  const base = {
    region: "continente",
    category: "unmarried",
    dependents: 0,
    referenceDate: "2026-08-19",
  } as const;

  const compute = (input: Parameters<typeof computeNetWage>[0]) =>
    computeNetWage(input, CONTINENTE_2026);

  it("is taxed and contributed on exactly like base salary", () => {
    const split = compute({
      ...base,
      grossMonthly: 1500,
      workScheduleExemption: 330,
    });
    const folded = compute({ ...base, grossMonthly: 1830 });

    // No special treatment: 1500 + 330 must behave as 1830 throughout.
    expect(split.taxableBase).toBeCloseTo(folded.taxableBase, 10);
    expect(split.irsWithholding).toBeCloseTo(folded.irsWithholding, 10);
    expect(split.socialSecurity).toBeCloseTo(folded.socialSecurity, 10);
    expect(split.netMonthly).toBeCloseTo(folded.netMonthly, 10);
  });

  it("is itemized on the result so it can be shown separately", () => {
    expect(
      compute({ ...base, grossMonthly: 1500, workScheduleExemption: 330 })
        .workScheduleExemption,
    ).toBe(330);
    // Absent rather than zero when it is not paid.
    expect(compute({ ...base, grossMonthly: 1500 }).workScheduleExemption)
      .toBeUndefined();
  });

  it("can push the salary into a higher bracket", () => {
    const without = compute({ ...base, grossMonthly: 900 });
    const with_ = compute({
      ...base,
      grossMonthly: 900,
      workScheduleExemption: 200,
    });
    // 900 € falls in the 0 % bracket; 1100 € does not.
    expect(without.irsWithholding).toBe(0);
    expect(with_.irsWithholding).toBeGreaterThan(0);
  });

  it("leaves the duodécimos' own base alone", () => {
    // The subsidy base is `subsidyAmount ?? grossMonthly`: whether the
    // subsídios include the IHT is a contractual question, so the caller
    // states it rather than the engine assuming it.
    const result = compute({
      ...base,
      grossMonthly: 1500,
      workScheduleExemption: 330,
      twelfths: { holiday: 1, christmas: 1 },
    });
    expect(result.twelfths?.subsidyAmount).toBe(1500);

    const included = compute({
      ...base,
      grossMonthly: 1500,
      workScheduleExemption: 330,
      subsidyAmount: 1830,
      twelfths: { holiday: 1, christmas: 1 },
    });
    expect(included.twelfths?.subsidyAmount).toBe(1830);
  });

  it("rejects a negative amount", () => {
    expect(() =>
      compute({ ...base, grossMonthly: 1500, workScheduleExemption: -1 }),
    ).toThrow(/must not be negative/);
  });
});
