import { describe, expect, it } from "vitest";
import { computeNetWageForDate } from "@pt-finance-tools/engine";
import type { WageInput } from "@pt-finance-tools/engine";
import { buildBreakdown } from "./breakdown.js";
import type { Breakdown, LineKind } from "./breakdown.js";

const BASE: WageInput = {
  grossMonthly: 1500,
  region: "continente",
  category: "unmarried",
  dependents: 0,
  referenceDate: "2026-08-19",
};

const line = (breakdown: Breakdown, key: string) =>
  breakdown.lines.find((l) => l.key === key);

const keysOf = (breakdown: Breakdown, kind: LineKind) =>
  breakdown.lines.filter((l) => l.kind === kind).map((l) => l.key);

const totalOf = (breakdown: Breakdown, kind: LineKind) =>
  breakdown.lines
    .filter((l) => l.kind === kind)
    .reduce((total, l) => total + l.amount, 0);

const isCents = (value: number) =>
  Math.abs(value * 100 - Math.round(value * 100)) < 1e-9;

describe("buildBreakdown", () => {
  it("lists the salary and its two deductions", () => {
    const breakdown = buildBreakdown(computeNetWageForDate(BASE));

    expect(keysOf(breakdown, "earning")).toEqual(["base"]);
    expect(keysOf(breakdown, "deduction")).toEqual(["irs", "social-security"]);
    expect(keysOf(breakdown, "credit")).toEqual([]);
    expect(breakdown.gross).toBe(1500);
  });

  it("adds a line per component that is actually present", () => {
    const breakdown = buildBreakdown(
      computeNetWageForDate({
        ...BASE,
        mealAllowance: { dailyAmount: 10.46, days: 22, method: "card" },
        twelfths: { holiday: 1, christmas: 1 },
      }),
    );

    expect(keysOf(breakdown, "earning")).toEqual(["base", "meal", "twelfths"]);
    // 10,46 × 22 = 230,12 exempt, plus 1500/12 × 2 = 250,00 of duodécimos.
    expect(breakdown.gross).toBe(1980.12);
  });

  it("marks the duodécimos as an addition, without moving the totals", () => {
    const breakdown = buildBreakdown(
      computeNetWageForDate({ ...BASE, twelfths: { holiday: 1, christmas: 1 } }),
    );

    const twelfths = line(breakdown, "twelfths");
    expect(twelfths?.additive).toBe(true);
    // A display hint only: it is still an earning, still inside the gross.
    expect(twelfths?.kind).toBe("earning");
    expect(breakdown.gross).toBe(1750);
    expect(line(breakdown, "base")?.additive).toBeUndefined();
  });

  it("cites the statute behind the lines that need one", () => {
    const breakdown = buildBreakdown(
      computeNetWageForDate({
        ...BASE,
        twelfths: { holiday: 1, christmas: 1 },
        irsJovem: { yearOfIncome: 2 },
      }),
    );

    expect(line(breakdown, "twelfths")?.reference).toBe("cirs-99c-5");
    expect(line(breakdown, "irs-jovem")?.reference).toBe("cirs-12b");
    // Ordinary lines are not decorated with citations they do not need.
    expect(line(breakdown, "base")?.reference).toBeUndefined();
    expect(line(breakdown, "social-security")?.reference).toBeUndefined();
  });

  it("itemizes the isenção de horário as ordinary pay", () => {
    const breakdown = buildBreakdown(
      computeNetWageForDate({ ...BASE, workScheduleExemption: 330 }),
    );

    const exemption = line(breakdown, "work-schedule-exemption");
    expect(exemption?.amount).toBe(330);
    expect(exemption?.kind).toBe("earning");
    expect(exemption?.reference).toBe("ct-265");
    expect(breakdown.gross).toBe(1830);
  });

  it("says whether the meal allowance was fully exempt", () => {
    const exempt = line(
      buildBreakdown(
        computeNetWageForDate({
          ...BASE,
          mealAllowance: { dailyAmount: 10.46, days: 22, method: "card" },
        }),
      ),
      "meal",
    );
    expect(exempt?.note).toContain("isento na totalidade");

    const partly = line(
      buildBreakdown(
        computeNetWageForDate({
          ...BASE,
          // Above the card ceiling: the excess is taxed and contributed on.
          mealAllowance: { dailyAmount: 12, days: 22, method: "card" },
        }),
      ),
      "meal",
    );
    expect(partly?.note).toContain("tributados");
  });

  it("rounds every line to cents", () => {
    const breakdown = buildBreakdown(
      computeNetWageForDate({
        ...BASE,
        grossMonthly: 1337.77,
        mealAllowance: { dailyAmount: 12, days: 21, method: "card" },
        twelfths: { holiday: 1, christmas: 0.5 },
      }),
    );

    for (const row of breakdown.lines) {
      expect(isCents(row.amount), `${row.key} = ${row.amount}`).toBe(true);
    }
    expect(isCents(breakdown.net)).toBe(true);
  });

  describe("IRS Jovem", () => {
    const JOVEM: WageInput = { ...BASE, irsJovem: { yearOfIncome: 2 } };

    it("puts the credit immediately under the IRS line it gives back", () => {
      const keys = buildBreakdown(computeNetWageForDate(JOVEM)).lines.map(
        (l) => l.key,
      );
      expect(keys).toEqual(["base", "irs", "irs-jovem", "social-security"]);
    });

    it("shows the IRS before the exemption, then credits it back", () => {
      const breakdown = buildBreakdown(computeNetWageForDate(JOVEM));
      const plain = buildBreakdown(computeNetWageForDate(BASE));

      const irs = line(breakdown, "irs");
      const credit = line(breakdown, "irs-jovem");

      // The deduction is the ordinary withholding — the same figure someone
      // without the regime would see...
      expect(irs?.amount).toBe(line(plain, "irs")?.amount);
      expect(irs?.note).toContain("antes da isenção");
      // ...and the credit is what the regime gives back.
      expect(credit?.amount).toBeGreaterThan(0);
      expect(credit?.label).toContain("75%");
    });

    it("leaves the net exactly where it was", () => {
      const breakdown = buildBreakdown(computeNetWageForDate(JOVEM));
      const engineNet = computeNetWageForDate(JOVEM).netMonthly;
      // Presentation only: crediting the relief back must not move the money.
      expect(breakdown.net).toBeCloseTo(engineNet, 1);
    });

    it("names the duodécimos' own exemption in the credit note", () => {
      const withTwelfths = buildBreakdown(
        computeNetWageForDate({
          ...JOVEM,
          twelfths: { holiday: 1, christmas: 1 },
        }),
      );
      expect(line(withTwelfths, "irs-jovem")?.note).toContain("duodécimos");

      const salaryOnly = buildBreakdown(computeNetWageForDate(JOVEM));
      expect(line(salaryOnly, "irs-jovem")?.note).not.toContain("duodécimos");
    });

    it("adds no credit line when the regime gives nothing back", () => {
      // Past the 10-year schedule there is no exemption, so no line.
      const spent = buildBreakdown(
        computeNetWageForDate({ ...BASE, irsJovem: { yearOfIncome: 11 } }),
      );
      expect(keysOf(spent, "credit")).toEqual([]);
      expect(line(spent, "irs")?.note).toBeUndefined();
    });

    it("has no credits at all without the regime", () => {
      expect(
        keysOf(buildBreakdown(computeNetWageForDate(BASE)), "credit"),
      ).toEqual([]);
    });
  });

  describe("the gross split", () => {
    it("accounts for every euro of the gross", () => {
      const breakdown = buildBreakdown(
        computeNetWageForDate({
          ...BASE,
          workScheduleExemption: 330,
          mealAllowance: { dailyAmount: 12, days: 22, method: "card" },
          twelfths: { holiday: 1, christmas: 1 },
        }),
      );

      const total = breakdown.split.reduce((sum, s) => sum + s.amount, 0);
      expect(total).toBeCloseTo(breakdown.gross, 1);
      expect(
        breakdown.split.reduce((sum, s) => sum + s.share, 0),
      ).toBeCloseTo(1, 6);
    });

    it("charts the IRS actually withheld, not the pre-exemption figure", () => {
      const result = computeNetWageForDate({
        ...BASE,
        irsJovem: { yearOfIncome: 2 },
      });
      const breakdown = buildBreakdown(result);
      const irs = breakdown.split.find((s) => s.key === "irs");

      // The line above the chart shows IRS before the relief; the chart must
      // show what was taken, or the slices would not sum to the gross.
      expect(irs?.amount).toBeCloseTo(result.irsWithholding, 2);
      expect(irs?.amount).toBeLessThan(
        line(breakdown, "irs")?.amount ?? Infinity,
      );
      expect(
        breakdown.split.reduce((sum, s) => sum + s.amount, 0),
      ).toBeCloseTo(breakdown.gross, 1);
    });

    it("leads with what the worker keeps", () => {
      const breakdown = buildBreakdown(computeNetWageForDate(BASE));
      expect(breakdown.split.map((s) => s.key)).toEqual([
        "net",
        "irs",
        "social-security",
      ]);
      expect(breakdown.split[0]?.amount).toBe(breakdown.net);
    });

    it("reports zero shares rather than dividing by zero", () => {
      const breakdown = buildBreakdown(
        computeNetWageForDate({ ...BASE, grossMonthly: 0.001 }),
      );
      for (const slice of breakdown.split) {
        expect(Number.isFinite(slice.share)).toBe(true);
      }
    });
  });

  describe("employer cost", () => {
    it("adds the employer contribution to what is paid out", () => {
      const { employer } = buildBreakdown(computeNetWageForDate(BASE));

      expect(employer.remuneration).toBe(1500);
      expect(employer.socialSecurityRate).toBe(0.2375);
      expect(employer.socialSecurity).toBe(356.25);
      expect(employer.total).toBe(1856.25);
    });

    it("totals from the rounded parts, as the panel shows them", () => {
      const { employer } = buildBreakdown(
        computeNetWageForDate({
          ...BASE,
          grossMonthly: 2137.42,
          mealAllowance: { dailyAmount: 9.37, days: 19, method: "cash" },
          twelfths: { holiday: 1, christmas: 1 },
        }),
      );
      expect(employer.total).toBeCloseTo(
        employer.remuneration + employer.socialSecurity,
        10,
      );
    });

    it("relates the cost to what the worker actually keeps", () => {
      const breakdown = buildBreakdown(computeNetWageForDate(BASE));
      expect(breakdown.employer.multipleOfNet).toBeGreaterThan(1);
      expect(breakdown.employer.multipleOfNet).toBeCloseTo(
        breakdown.employer.total / breakdown.net,
        2,
      );
    });
  });

  it("shows a total that adds up from the lines on screen", () => {
    const breakdown = buildBreakdown(
      computeNetWageForDate({
        ...BASE,
        grossMonthly: 2137.42,
        mealAllowance: { dailyAmount: 9.37, days: 19, method: "cash" },
        twelfths: { holiday: 1, christmas: 1 },
      }),
    );

    expect(breakdown.net).toBeCloseTo(
      totalOf(breakdown, "earning") -
        totalOf(breakdown, "deduction") +
        totalOf(breakdown, "credit"),
      10,
    );
  });

  it("still adds up once IRS Jovem puts a credit on screen", () => {
    const breakdown = buildBreakdown(
      computeNetWageForDate({
        ...BASE,
        grossMonthly: 2137.42,
        twelfths: { holiday: 1, christmas: 1 },
        irsJovem: { yearOfIncome: 5 },
      }),
    );

    expect(totalOf(breakdown, "credit")).toBeGreaterThan(0);
    expect(breakdown.net).toBeCloseTo(
      totalOf(breakdown, "earning") -
        totalOf(breakdown, "deduction") +
        totalOf(breakdown, "credit"),
      10,
    );
  });

  it("stays within a cent or two of the engine's own net", () => {
    const result = computeNetWageForDate({
      ...BASE,
      grossMonthly: 2137.42,
      mealAllowance: { dailyAmount: 9.37, days: 19, method: "cash" },
      twelfths: { holiday: 1, christmas: 1 },
    });

    // The displayed total is derived from rounded lines, exactly as a payslip
    // does it — so it may differ from the full-precision sum, but only in the
    // last cents.
    expect(buildBreakdown(result).net).toBeCloseTo(result.netMonthly, 1);
  });

  it("takes the effective rate over everything the IRS was withheld on", () => {
    const result = computeNetWageForDate({
      ...BASE,
      twelfths: { holiday: 1, christmas: 1 },
    });
    const breakdown = buildBreakdown(result);

    expect(breakdown.effectiveIrsRate).toBeCloseTo(
      result.irsWithholding / (result.taxableBase + result.twelfths!.paid),
      10,
    );
  });

  it("reports a zero rate rather than dividing by zero", () => {
    expect(
      buildBreakdown(computeNetWageForDate({ ...BASE, grossMonthly: 0.001 }))
        .effectiveIrsRate,
    ).toBe(0);
  });
});
