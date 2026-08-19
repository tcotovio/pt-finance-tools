// Trabalho suplementar — CIRS art. 99.º-C n.º 8 + despacho 233-A/2026 §5.f.
//
// Expectations are derived from the despacho's own words: half the *effective*
// monthly rate, levied on the overtime, without touching the salary's bracket.

import { describe, expect, it } from "vitest";
import { computeNetWage } from "./withholding.js";
import { overtimeDetail } from "./overtime.js";
import { CONTINENTE_2026 } from "../data/continente-2026.js";
import { IRS_JOVEM_2026 } from "../data/irs-jovem-2026.js";

const base = {
  region: "continente",
  category: "unmarried",
  dependents: 0,
  referenceDate: "2026-08-19",
} as const;

const compute = (input: Parameters<typeof computeNetWage>[0]) =>
  computeNetWage(input, CONTINENTE_2026, undefined, IRS_JOVEM_2026);

describe("overtimeDetail", () => {
  it("levies half the month's effective rate", () => {
    const detail = overtimeDetail(200, 0.18);
    expect(detail.rate).toBeCloseTo(0.09, 10);
    expect(detail.withholding).toBeCloseTo(18, 10);
  });

  it("withholds nothing when the month itself withholds nothing", () => {
    // Below the first bracket the effective rate is 0, so half of it is 0 —
    // overtime cannot create withholding where the salary has none.
    expect(overtimeDetail(200, 0).withholding).toBe(0);
  });

  it("rejects a negative amount", () => {
    expect(() => overtimeDetail(-1, 0.18)).toThrow(/must not be negative/);
  });
});

describe("overtime in a month's calculation", () => {
  it("is withheld at half the salary's effective rate", () => {
    const plain = compute({ ...base, grossMonthly: 1500 });
    const withOvertime = compute({
      ...base,
      grossMonthly: 1500,
      overtime: 300,
    });

    const effectiveRate = plain.irsWithholding / plain.taxableBase;
    expect(withOvertime.overtime?.rate).toBeCloseTo(effectiveRate / 2, 10);
    expect(withOvertime.overtime?.withholding).toBeCloseTo(
      (effectiveRate / 2) * 300,
      10,
    );
  });

  it("never changes the salary's own bracket or withholding", () => {
    const plain = compute({ ...base, grossMonthly: 1500 });
    const withOvertime = compute({
      ...base,
      grossMonthly: 1500,
      overtime: 900,
    });

    // Autonomous: 900 € of overtime would cross a bracket if it were added to
    // the salary, and art. 99.º-C n.º 8 says it is not.
    expect(withOvertime.taxableBase).toBe(plain.taxableBase);
    expect(withOvertime.breakdown.marginalRate).toBe(
      plain.breakdown.marginalRate,
    );
    expect(withOvertime.irsWithholding - plain.irsWithholding).toBeCloseTo(
      withOvertime.overtime!.withholding,
      10,
    );
  });

  it("is cheaper than the same money paid as salary", () => {
    const asOvertime = compute({
      ...base,
      grossMonthly: 1500,
      overtime: 300,
    });
    const asSalary = compute({ ...base, grossMonthly: 1800 });

    // The whole point of the 50 % rule.
    expect(asOvertime.irsWithholding).toBeLessThan(asSalary.irsWithholding);
    expect(asOvertime.netMonthly).toBeGreaterThan(asSalary.netMonthly);
  });

  it("is contributory for both halves of Segurança Social", () => {
    const plain = compute({ ...base, grossMonthly: 1500 });
    const withOvertime = compute({
      ...base,
      grossMonthly: 1500,
      overtime: 300,
    });

    expect(withOvertime.socialSecurity).toBeCloseTo(
      plain.socialSecurity + 300 * 0.11,
      10,
    );
    expect(withOvertime.employerCost.socialSecurity).toBeCloseTo(
      plain.employerCost.socialSecurity + 300 * 0.2375,
      10,
    );
    expect(withOvertime.employerCost.remuneration).toBeCloseTo(1800, 10);
  });

  it("is money in hand net of its own withholding", () => {
    const plain = compute({ ...base, grossMonthly: 1500 });
    const withOvertime = compute({
      ...base,
      grossMonthly: 1500,
      overtime: 300,
    });

    expect(withOvertime.netMonthly).toBeCloseTo(
      plain.netMonthly +
        300 -
        withOvertime.overtime!.withholding -
        300 * 0.11,
      10,
    );
  });

  it("is left off the result when none was paid", () => {
    expect(compute({ ...base, grossMonthly: 1500 }).overtime).toBeUndefined();
  });

  it("rejects a negative amount", () => {
    expect(() =>
      compute({ ...base, grossMonthly: 1500, overtime: -5 }),
    ).toThrow(/must not be negative/);
  });

  describe("with IRS Jovem", () => {
    it("shares what is left of the month's exemption ceiling", () => {
      // Despacho §5.g caps the year's accumulated monthly exemptions at the
      // annual limit ÷ 14, so overtime does not get a ceiling of its own.
      const result = compute({
        ...base,
        grossMonthly: 1500,
        overtime: 300,
        irsJovem: { yearOfIncome: 1 },
      });

      const cap = result.irsJovem!.cap;
      const totalExempt = result.irsJovem!.exempt + result.overtime!.exempt!;
      expect(totalExempt).toBeLessThanOrEqual(cap + 1e-9);
    });

    it("exempts the overtime outright when the salary leaves headroom", () => {
      // 1 500 € salary is well under the 2 110,15 € monthly ceiling, so at
      // 100 % all 300 € of overtime is exempt and nothing is withheld on it.
      const result = compute({
        ...base,
        grossMonthly: 1500,
        overtime: 300,
        irsJovem: { yearOfIncome: 1 },
      });

      expect(result.overtime?.exempt).toBeCloseTo(300, 10);
      expect(result.overtime?.withholding).toBeCloseTo(0, 10);
    });

    it("gives overtime no exemption once the salary has used the ceiling", () => {
      // At 4 000 € the salary alone exhausts the monthly ceiling, so the
      // overtime is taxed in full — at half the month's rate.
      const result = compute({
        ...base,
        grossMonthly: 4000,
        overtime: 300,
        irsJovem: { yearOfIncome: 1 },
      });

      expect(result.irsJovem?.capped).toBe(true);
      expect(result.overtime?.exempt).toBeCloseTo(0, 10);
      expect(result.overtime?.withholding).toBeGreaterThan(0);
    });

    it("counts the overtime relief in what the regime is worth", () => {
      const input = {
        ...base,
        grossMonthly: 1500,
        overtime: 300,
      };
      const withJovem = compute({ ...input, irsJovem: { yearOfIncome: 2 } });
      const withoutJovem = computeNetWage(input, CONTINENTE_2026);

      expect(withJovem.irsJovem?.withholdingWithoutExemption).toBeCloseTo(
        withoutJovem.irsWithholding,
        10,
      );
      expect(withJovem.irsJovem?.relief).toBeCloseTo(
        withoutJovem.irsWithholding - withJovem.irsWithholding,
        10,
      );
    });
  });
});
