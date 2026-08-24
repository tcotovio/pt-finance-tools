// The composed monthly answer.

import { describe, expect, it } from "vitest";
import type { SelfEmployedInput } from "../types.js";
import { selfEmployedNet } from "./net.js";

const BASE: SelfEmployedInput = {
  monthlyInvoicing: 2000,
  activity: "services",
  retentionCategory: "professional",
  referenceDate: "2026-08-23",
};

describe("selfEmployedNet", () => {
  it("itemizes an ordinary month", () => {
    const r = selfEmployedNet(BASE);

    expect(r.invoiced).toBe(2000);
    expect(r.retention.amount).toBeCloseTo(460, 2); // 23 %
    // 2 000 × 3 × 70 % = 4 200; ÷ 3 = 1 400; × 21,4 %
    expect(r.contribution.base).toBeCloseTo(1400, 2);
    expect(r.contribution.amount).toBeCloseTo(299.6, 2);
    expect(r.net).toBeCloseTo(2000 - 460 - 299.6, 2);
    expect(r.effectiveRate).toBeCloseTo(1240.4 / 2000, 6);
  });

  it("flags that the quarter was assumed when only a month was given", () => {
    expect(selfEmployedNet(BASE).contribution.quarterAssumed).toBe(true);
  });

  it("does not flag it when the quarter was supplied", () => {
    const r = selfEmployedNet({ ...BASE, quarter: [3500, 800, 1200] });
    expect(r.contribution.quarterAssumed).toBe(false);
    // 5 500 × 70 % = 3 850; ÷ 3 = 1 283,33
    expect(r.contribution.base).toBeCloseTo(1283.33, 2);
  });

  // How the quarter is distributed does NOT matter — the base is a third of
  // the period total, so 5 000/500/500 and 2 000/2 000/2 000 owe the same.
  // Worth pinning because "lumpy income changes the contribution" is the
  // intuitive belief, and acting on it would send the UI asking for a shape
  // that changes nothing.
  it("depends on the quarter's total, not on how it was distributed", () => {
    const steady = selfEmployedNet({ ...BASE, quarter: [2000, 2000, 2000] });
    const lumpy = selfEmployedNet({ ...BASE, quarter: [5000, 500, 500] });
    expect(lumpy.contribution.periodInvoicing).toBe(
      steady.contribution.periodInvoicing,
    );
    expect(lumpy.contribution.amount).toBeCloseTo(steady.contribution.amount, 2);
  });

  // What the override is actually FOR: a quarter whose total is not three
  // times this month's invoice. That is the case the monthly stand-in cannot
  // express, and it is the common one — a good quarter followed by a quiet
  // month still owes on the good quarter.
  it("diverges from the monthly stand-in when the quarter is not 3 × this month", () => {
    const assumed = selfEmployedNet({ ...BASE, monthlyInvoicing: 500 });
    const afterAGoodQuarter = selfEmployedNet({
      ...BASE,
      monthlyInvoicing: 500,
      quarter: [4000, 4000, 4000],
    });

    // Same invoice this month, same retention on it...
    expect(afterAGoodQuarter.retention.amount).toBeCloseTo(
      assumed.retention.amount,
      2,
    );
    // ...but the contribution is owed on the quarter that has already gone.
    // 500 × 3 × 70 % ÷ 3 = 350 of base → 74,90 €.
    expect(assumed.contribution.amount).toBeCloseTo(74.9, 2);
    // 12 000 × 70 % ÷ 3 = 2 800 of base → 599,20 €.
    expect(afterAGoodQuarter.contribution.amount).toBeCloseTo(599.2, 2);

    // And the month goes negative: 500 − 115 of retention − 599,20 owed. This
    // is the cash-flow trap the tool exists to show, not an error state.
    expect(afterAGoodQuarter.net).toBeCloseTo(-214.2, 2);
  });

  describe("IVA", () => {
    it("is absent under the art. 53.º exemption", () => {
      const r = selfEmployedNet(BASE);
      expect(r.vat.exempt).toBe(true);
      expect(r.vat.amount).toBe(0);
      expect(r.vat.invoiceTotal).toBe(2000);
    });

    it("is charged on top and excluded from the take-home", () => {
      const r = selfEmployedNet({ ...BASE, chargesVat: true });
      expect(r.vat.amount).toBeCloseTo(460, 2);
      expect(r.vat.invoiceTotal).toBeCloseTo(2460, 2);
      // The client pays 2 460 €, and none of the extra 460 € is the worker's.
      expect(r.net).toBeCloseTo(selfEmployedNet(BASE).net, 2);
    });

    // Art. 101.º withholds on the "rendimentos ilíquidos", and IVA is not
    // income. Withholding on the invoice total would take 23 % of the IVA too.
    it("does not enter the retention base", () => {
      const withVat = selfEmployedNet({ ...BASE, chargesVat: true });
      expect(withVat.retention.amount).toBeCloseTo(460, 2);
      expect(withVat.retention.amount).not.toBeCloseTo(2460 * 0.23, 2);
    });

    it("does not enter the contribution base either", () => {
      const withVat = selfEmployedNet({ ...BASE, chargesVat: true });
      expect(withVat.contribution.base).toBeCloseTo(1400, 2);
    });
  });

  describe("the rules that zero a line", () => {
    it("owes the 20 € floor in a month with no invoicing", () => {
      const r = selfEmployedNet({ ...BASE, monthlyInvoicing: 0 });
      expect(r.contribution.amount).toBe(20);
      expect(r.contribution.atMinimum).toBe(true);
      // Negative take-home is the correct answer, not an error: the
      // contribution is owed whether or not anything was invoiced.
      expect(r.net).toBe(-20);
      // No denominator, so no rate — rather than a rate of zero.
      expect(r.effectiveRate).toBe(0);
    });

    it("owes nothing in the first 12 months of a first activity", () => {
      const r = selfEmployedNet({ ...BASE, firstActivityDeferral: true });
      expect(r.contribution.amount).toBe(0);
      expect(r.contribution.deferred).toBe(true);
      // The deferral does not reach the IRS side: retention is still withheld.
      expect(r.retention.amount).toBeCloseTo(460, 2);
      expect(r.net).toBeCloseTo(1540, 2);
    });

    it("beats the 20 € floor with the deferral", () => {
      const r = selfEmployedNet({
        ...BASE,
        monthlyInvoicing: 0,
        firstActivityDeferral: true,
      });
      expect(r.contribution.amount).toBe(0);
    });
  });

  it("reports every dataset it leaned on", () => {
    const r = selfEmployedNet(BASE);
    expect(r.sources.map((s) => s.key)).toEqual([
      "cirs-101",
      "civa-53",
      "cc-independentes",
      "ias",
    ]);
    expect(r.isWithholdingEstimate).toBe(true);
  });

  describe("verified", () => {
    it("is true under the IVA exemption, where no CIVA figure is applied", () => {
      expect(selfEmployedNet(BASE).verified).toBe(true);
    });

    // Turning IVA on brings an unverified rate into the arithmetic, and the
    // badge has to follow the numbers rather than the tool. The CIVA dataset
    // is listed as a source either way — only its weight on the composed
    // answer is conditional.
    it("goes false once IVA is charged, because that rate is unverified", () => {
      expect(selfEmployedNet({ ...BASE, chargesVat: true }).verified).toBe(
        false,
      );
      expect(
        selfEmployedNet({ ...BASE, chargesVat: true }).sources.map((s) => s.key),
      ).toContain("civa-53");
    });
  });

  describe("propriedade intelectual", () => {
    const IP: SelfEmployedInput = {
      ...BASE,
      activity: "intellectual-property",
      retentionCategory: "intellectual-property",
    };

    it("withholds 16,5 % and leaves the income outside the base", () => {
      const r = selfEmployedNet(IP);
      expect(r.retention.amount).toBeCloseTo(330, 2); // 16,5 % of 2 000
      expect(r.contribution.relevantIncome).toBe(0);
      expect(r.contribution.excludedFromBase).toBe(true);
      // Excluded income still leaves an open activity, and an open activity
      // with no relevant income is the "inexistência de rendimentos" case —
      // so the 20 € floor is what remains, not nothing.
      expect(r.contribution.amount).toBe(20);
    });

    it("reports the coefficient actually applied, so the panel reconciles", () => {
      // Printing the table's 70 % beside a base of zero would show a sum that
      // does not add up.
      expect(selfEmployedNet(IP).contribution.coefficient).toBe(0);
    });

    it("contributes like ordinary services once opted in", () => {
      const optedIn = selfEmployedNet({
        ...IP,
        includeIntellectualProperty: true,
      });
      expect(optedIn.contribution.excludedFromBase).toBe(false);
      expect(optedIn.contribution.base).toBeCloseTo(1400, 2);
      expect(optedIn.contribution.amount).toBeCloseTo(299.6, 2);
      // The retention is unchanged: the opt-in is a Segurança Social choice
      // and has nothing to do with the CIRS rate.
      expect(optedIn.retention.amount).toBeCloseTo(330, 2);
    });

    it("costs money to opt in, which is the point of asking", () => {
      expect(
        selfEmployedNet({ ...IP, includeIntellectualProperty: true }).net,
      ).toBeLessThan(selfEmployedNet(IP).net);
    });

    it("ignores the opt-in on a services input", () => {
      const r = selfEmployedNet({ ...BASE, includeIntellectualProperty: true });
      expect(r.contribution.amount).toBeCloseTo(299.6, 2);
      expect(r.contribution.excludedFromBase).toBe(false);
    });
  });

  describe("IVA by region", () => {
    it("charges the Continente taxa normal by default", () => {
      const r = selfEmployedNet({ ...BASE, chargesVat: true });
      expect(r.vat.rate).toBe(0.23);
      expect(r.vat.amount).toBeCloseTo(460, 2);
    });

    // The bug this shipped with: a flat 23 % everywhere. The Regiões
    // Autónomas set their own taxas normais under CIVA art. 18.º n.º 3.
    it("charges 22 % in Madeira and 16 % nos Açores", () => {
      const madeira = selfEmployedNet({
        ...BASE,
        chargesVat: true,
        region: "madeira",
      });
      expect(madeira.vat.rate).toBe(0.22);
      expect(madeira.vat.invoiceTotal).toBeCloseTo(2440, 2);

      const acores = selfEmployedNet({
        ...BASE,
        chargesVat: true,
        region: "acores",
      });
      expect(acores.vat.rate).toBe(0.16);
      expect(acores.vat.invoiceTotal).toBeCloseTo(2320, 2);
    });

    // IVA is the State's money wherever it is collected, so the region moves
    // the invoice total and nothing else. Pinned because the take-home is the
    // headline, and a region control that appeared to change it would be read
    // as a tax break.
    it("leaves the take-home untouched wherever the work is done", () => {
      const net = (region: "continente" | "madeira" | "acores") =>
        selfEmployedNet({ ...BASE, chargesVat: true, region }).net;
      expect(net("madeira")).toBeCloseTo(net("continente"), 2);
      expect(net("acores")).toBeCloseTo(net("continente"), 2);
    });
  });

  it("rejects a negative or non-finite invoice rather than computing on it", () => {
    expect(() => selfEmployedNet({ ...BASE, monthlyInvoicing: -1 })).toThrow();
    expect(() =>
      selfEmployedNet({ ...BASE, monthlyInvoicing: Number.NaN }),
    ).toThrow();
  });

  it("throws for a date before any dataset is in effect", () => {
    expect(() =>
      selfEmployedNet({ ...BASE, referenceDate: "2015-01-01" }),
    ).toThrow(/effective on 2015-01-01/);
  });
});
