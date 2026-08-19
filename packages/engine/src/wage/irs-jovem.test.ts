// Expectations here come from CIRS art. 12.º-B and 99.º-F n.º 4.

import { describe, expect, it } from "vitest";
import {
  exemptionFraction,
  irsJovemExemption,
  paymentExemptionCap,
} from "./irs-jovem.js";
import { computeNetWage } from "./withholding.js";
import { IRS_JOVEM_2026 } from "../data/irs-jovem-2026.js";
import { CONTINENTE_2026 } from "../data/continente-2026.js";

const regime = IRS_JOVEM_2026;
const base = {
  region: "continente",
  category: "unmarried",
  dependents: 0,
  referenceDate: "2026-08-18",
} as const;

const netWage = (input: Parameters<typeof computeNetWage>[0]) =>
  computeNetWage(input, CONTINENTE_2026, undefined, regime);

describe("exemptionFraction", () => {
  it("follows the art. 12.º-B n.º 5 taper", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((y) => exemptionFraction(y, regime)))
      .toEqual([1, 0.75, 0.75, 0.75, 0.5, 0.5, 0.5, 0.25, 0.25, 0.25]);
  });

  it("exempts nothing past the tenth year", () => {
    expect(exemptionFraction(11, regime)).toBe(0);
  });

  it("rejects a non-positive or fractional year", () => {
    expect(() => exemptionFraction(0, regime)).toThrow(/positive integer/);
    expect(() => exemptionFraction(1.5, regime)).toThrow(/positive integer/);
  });
});

describe("paymentExemptionCap", () => {
  it("is the annual 55 × IAS ceiling over 14 payments", () => {
    // 55 × 537,13 = 29 542,15 € a year; ÷ 14 = 2 110,15 € a payment.
    expect(paymentExemptionCap(regime)).toBeCloseTo(2110.15, 2);
  });

  it("scales for a payment that is only part of a full one", () => {
    expect(paymentExemptionCap(regime, 2 / 12)).toBeCloseTo(2110.15 * 2 / 12, 2);
  });
});

describe("irsJovemExemption", () => {
  it("exempts the whole payment in year 1", () => {
    const e = irsJovemExemption(1500, 1, regime);
    expect(e.exempt).toBe(1500);
    expect(e.taxable).toBe(0);
    expect(e.capped).toBe(false);
  });

  it("caps the exemption at the per-payment ceiling", () => {
    // 75 % of 6 000 € would be 4 500 €, well past the 2 110,15 € ceiling.
    const e = irsJovemExemption(6000, 2, regime);
    expect(e.exempt).toBeCloseTo(2110.15, 2);
    expect(e.taxable).toBeCloseTo(3889.85, 2);
    expect(e.capped).toBe(true);
  });
});

describe("computeNetWage with IRS Jovem", () => {
  it("takes the rate from the full salary and levies it on the rest", () => {
    // Art. 99.º-F n.º 4. At 1 500 € the salary withholds 168,17 €, an
    // effective 11,2113 %. In year 2, 25 % of 1 500 € stays taxable:
    //   375 × 11,2113 % = 42,04 €
    // Taxing 375 € on its own would give zero — that is not the rule.
    const result = netWage({
      ...base,
      grossMonthly: 1500,
      irsJovem: { yearOfIncome: 2 },
    });
    expect(result.irsJovem?.effectiveRate).toBeCloseTo(0.1121133, 6);
    expect(result.irsWithholding).toBeCloseTo(42.04, 2);
  });

  it("withholds nothing in year 1 but still contributes in full", () => {
    const result = netWage({
      ...base,
      grossMonthly: 1500,
      irsJovem: { yearOfIncome: 1 },
    });
    expect(result.irsWithholding).toBe(0);
    // The exemption is an IRS relief; Segurança Social is untouched.
    expect(result.socialSecurity).toBeCloseTo(165, 2);
  });

  it("reports when the ceiling bit, so the UI can explain it", () => {
    const result = netWage({
      ...base,
      grossMonthly: 6000,
      irsJovem: { yearOfIncome: 2 },
    });
    expect(result.irsJovem?.capped).toBe(true);
    expect(result.irsJovem?.exempt).toBeCloseTo(2110.15, 2);
  });

  it("keeps the progressivity of the real salary", () => {
    // Two workers with the same taxable part but different real salaries pay
    // different tax, because the rate tracks the full remuneration.
    const richer = netWage({
      ...base,
      grossMonthly: 3000,
      irsJovem: { yearOfIncome: 5 },
    });
    const plain = netWage({ ...base, grossMonthly: 1500 });
    expect(richer.taxableBase - (richer.irsJovem?.exempt ?? 0)).toBeCloseTo(1500, 2);
    expect(richer.irsWithholding).toBeGreaterThan(plain.irsWithholding);
  });

  it("applies the exemption to duodécimos as well", () => {
    const withJovem = netWage({
      ...base,
      grossMonthly: 1500,
      twelfths: { holiday: 1, christmas: 1 },
      irsJovem: { yearOfIncome: 2 },
    });
    const withoutJovem = computeNetWage(
      { ...base, grossMonthly: 1500, twelfths: { holiday: 1, christmas: 1 } },
      CONTINENTE_2026,
    );
    // 250 € of duodécimos, 25 % taxable at 11,2113 % = 7,01 €.
    expect(withJovem.twelfths?.withholding).toBeCloseTo(7.01, 2);
    expect(withoutJovem.twelfths?.withholding).toBeCloseTo(28.03, 2);
  });

  it("reports what the exemption is worth this month", () => {
    const withJovem = netWage({
      ...base,
      grossMonthly: 1500,
      irsJovem: { yearOfIncome: 2 },
    });
    const withoutJovem = computeNetWage(
      { ...base, grossMonthly: 1500 },
      CONTINENTE_2026,
    );

    // The baseline is the ordinary withholding on the same remuneration...
    expect(withJovem.irsJovem?.withholdingWithoutExemption).toBeCloseTo(
      withoutJovem.irsWithholding,
      10,
    );
    // ...and the relief is what is not retained because of it.
    expect(withJovem.irsJovem?.relief).toBeCloseTo(
      withoutJovem.irsWithholding - withJovem.irsWithholding,
      10,
    );
  });

  it("counts the duodécimos' own exemption in the relief", () => {
    const input = {
      ...base,
      grossMonthly: 1500,
      twelfths: { holiday: 1, christmas: 1 },
    };
    const withJovem = netWage({ ...input, irsJovem: { yearOfIncome: 2 } });
    const withoutJovem = computeNetWage(input, CONTINENTE_2026);

    expect(withJovem.irsJovem?.withholdingWithoutExemption).toBeCloseTo(
      withoutJovem.irsWithholding,
      10,
    );
    expect(withJovem.irsJovem?.relief).toBeCloseTo(
      withoutJovem.irsWithholding - withJovem.irsWithholding,
      10,
    );
    // The duodécimo relief is a real part of it: 28,03 − 7,01 € (see above).
    expect(withJovem.irsJovem!.relief).toBeGreaterThan(
      netWage({ ...base, grossMonthly: 1500, irsJovem: { yearOfIncome: 2 } })
        .irsJovem!.relief,
    );
  });

  it("surfaces the exempt part of the duodécimo", () => {
    const result = netWage({
      ...base,
      grossMonthly: 1500,
      twelfths: { holiday: 1, christmas: 1 },
      irsJovem: { yearOfIncome: 2 },
    });
    // 250 € paid, 75 % of it exempt in the second year.
    expect(result.twelfths?.exempt).toBeCloseTo(187.5, 2);
  });

  it("leaves the exempt field off the duodécimos without IRS Jovem", () => {
    const result = computeNetWage(
      { ...base, grossMonthly: 1500, twelfths: { holiday: 1, christmas: 1 } },
      CONTINENTE_2026,
    );
    expect(result.twelfths?.exempt).toBeUndefined();
    expect(result.irsJovem).toBeUndefined();
  });

  it("reports no relief once the schedule has run out", () => {
    const result = netWage({
      ...base,
      grossMonthly: 1500,
      irsJovem: { yearOfIncome: 11 },
    });
    expect(result.irsJovem?.relief).toBeCloseTo(0, 10);
  });

  it("throws when IRS Jovem is requested without a regime dataset", () => {
    expect(() =>
      computeNetWage(
        { ...base, grossMonthly: 1500, irsJovem: { yearOfIncome: 2 } },
        CONTINENTE_2026,
      ),
    ).toThrow(/no IrsJovemRegime/);
  });
});
