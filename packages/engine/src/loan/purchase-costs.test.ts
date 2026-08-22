import { describe, expect, it } from "vitest";
import { purchaseCostsForDate, imtFor } from "./purchase-costs.js";
import { IMT_2026, REGISTRATION_FEES_2024, STAMP_DUTY_2024 } from "../data/index.js";
import type { PurchaseCostsInput } from "../types.js";

const base: PurchaseCostsInput = {
  price: 250_000,
  loanAmount: 200_000,
  purpose: "own-permanent-residence",
  region: "continente",
  termYears: 40,
  annualRate: 0.032,
  assessmentDate: "2026-09-01",
};

const costs = (extra: Partial<PurchaseCostsInput> = {}) =>
  purchaseCostsForDate({ ...base, ...extra });

const CONTINENTE_HPP = IMT_2026.tables.continente["own-permanent-residence"];
const CONTINENTE_JOVEM =
  IMT_2026.tables.continente["young-own-permanent-residence"];

describe("IMT", () => {
  it("charges nothing inside the first bracket", () => {
    expect(imtFor(100_000, CONTINENTE_HPP).amount).toBe(0);
  });

  it("applies valor × taxa − parcela in the marginal bands", () => {
    // 250 000 sits in the 7 % band: 17 500 − 10 457,96.
    expect(imtFor(250_000, CONTINENTE_HPP).amount).toBeCloseTo(7_042.04, 2);
  });

  it("meets the statute's own split-bracket formula at a bracket boundary", () => {
    // Art. 17.º n.º 3 says the value is split: the first part at the average
    // rate of the bracket below, the excess at the next marginal rate. At a
    // boundary the whole value IS the first part, so the average rate falls
    // straight out — and it must agree with the parcela-a-abater form.
    const upper = CONTINENTE_HPP[2].upTo as number; // 198 347
    const { amount } = imtFor(upper, CONTINENTE_HPP);
    const averageRate = amount / upper;
    // AT publishes 1,7274 % as the taxa média of that bracket.
    expect(averageRate * 100).toBeCloseTo(1.7274, 4);
  });

  it("jumps UPWARD into the taxa única band, as the statute intends", () => {
    // The single most counter-intuitive thing in the table: one euro more
    // house at 660 982 costs 543,71 € more tax, because the 6 % is charged on
    // the whole value rather than on the excess. Anyone "fixing" this later
    // should have to delete this test first.
    const below = imtFor(660_982, CONTINENTE_HPP).amount;
    const above = imtFor(660_983, CONTINENTE_HPP).amount;
    expect(below).toBeCloseTo(39_115.21, 2);
    expect(above).toBeCloseTo(39_658.98, 2);
    expect(above - below).toBeGreaterThan(500);
  });

  it("never decreases as the value rises", () => {
    // The property the reverse solver leans on. Swept coarsely across every
    // boundary in the table plus a euro either side of each.
    const edges = CONTINENTE_HPP.flatMap((b) =>
      b.upTo === null ? [] : [b.upTo - 1, b.upTo, b.upTo + 1],
    );
    const points = [...edges, 50_000, 300_000, 800_000, 2_000_000].sort(
      (a, b) => a - b,
    );
    let previous = -1;
    for (const value of points) {
      const amount = imtFor(value, CONTINENTE_HPP).amount;
      expect(amount, `IMT at ${value}`).toBeGreaterThanOrEqual(previous);
      previous = amount;
    }
  });
});

describe("IMT Jovem", () => {
  it("exempts up to the first bracket entirely", () => {
    const result = costs({ price: 300_000, youngFirstHome: true });
    expect(result.imt.amount).toBe(0);
    expect(result.imt.exempt).toBe(true);
    expect(result.imt.table).toBe("young-own-permanent-residence");
  });

  it("charges 8 % of the excess above it", () => {
    const ceiling = CONTINENTE_JOVEM[0].upTo as number; // 330 539
    const result = costs({ price: 400_000, youngFirstHome: true });
    expect(result.imt.amount).toBeCloseTo(0.08 * (400_000 - ceiling), 2);
  });

  it("ends at a cliff rather than tapering", () => {
    // Above the taxa única boundary the young table and the general one are
    // the same table, so the benefit does not shrink — it stops.
    const young = costs({ price: 660_983, youngFirstHome: true }).imt.amount;
    const general = costs({ price: 660_983 }).imt.amount;
    expect(young).toBe(general);

    const belowYoung = costs({ price: 660_982, youngFirstHome: true }).imt.amount;
    expect(young - belowYoung).toBeGreaterThan(13_000);
  });

  it("is unavailable for a purpose other than own permanent residence", () => {
    const result = costs({ purpose: "other", youngFirstHome: true });
    expect(result.imt.table).toBe("housing");
    expect(result.stampDutyTransfer.youngDeduction).toBe(0);
  });
});

describe("Imposto do Selo", () => {
  it("charges verba 1.1 on the taxable value and 17.1.3 on the capital", () => {
    const result = costs();
    expect(result.stampDutyTransfer.amount).toBeCloseTo(250_000 * 0.008, 2);
    expect(result.stampDutyCredit.amount).toBeCloseTo(200_000 * 0.006, 2);
    expect(result.stampDutyCredit.verba).toBe("17.1.3");
  });

  it("drops to verba 17.1.2 below five years", () => {
    const result = costs({ termYears: 3 });
    expect(result.stampDutyCredit.verba).toBe("17.1.2");
    expect(result.stampDutyCredit.rate).toBe(STAMP_DUTY_2024.credit.oneYearOrMore);
  });

  it("deducts verba 1.1 for a young buyer, capped by art. 7.º-A", () => {
    const cap = 330_539 * 0.008; // 2 644,312
    const small = costs({ price: 300_000, youngFirstHome: true });
    expect(small.stampDutyTransfer.amount).toBe(0);
    expect(small.stampDutyTransfer.youngDeduction).toBeCloseTo(300_000 * 0.008, 2);

    const large = costs({ price: 400_000, youngFirstHome: true });
    expect(large.stampDutyTransfer.youngDeduction).toBeCloseTo(cap, 1);
    expect(large.stampDutyTransfer.amount).toBeCloseTo(400_000 * 0.008 - cap, 1);
  });

  it("does not charge the 4 % on interest for own housing", () => {
    const result = costs();
    expect(result.stampDutyInterest.amount).toBe(0);
    expect(result.stampDutyInterest.exempt).toBe(true);
    expect(result.stampDutyInterest.reason).toContain("art. 7.º n.º 1 al. l)");
  });

  it("does charge it for another purpose, and says the exemption may still reach", () => {
    const result = costs({ purpose: "other" });
    expect(result.stampDutyInterest.amount).toBeGreaterThan(0);
    expect(result.stampDutyInterest.exempt).toBe(false);
    expect(result.stampDutyInterest.reason).toContain("habitação própria");
  });
});

describe("the taxable value", () => {
  it("is the price when no VPT is given", () => {
    expect(costs().taxableValue).toBe(250_000);
  });

  it("is the VPT when the VPT is higher — the opposite of the LTV rule", () => {
    const result = costs({ vpt: 280_000 });
    expect(result.taxableValue).toBe(280_000);
    expect(result.stampDutyTransfer.amount).toBeCloseTo(280_000 * 0.008, 2);
  });

  it("ignores a VPT below the price", () => {
    expect(costs({ vpt: 120_000 }).taxableValue).toBe(250_000);
  });
});

describe("registration", () => {
  it("charges the multiple-act tariff, because there is always a mortgage", () => {
    expect(costs().registration.amount).toBe(REGISTRATION_FEES_2024.multipleActs);
  });

  it("is reduced — not waived — for a young buyer below the 4.º escalão", () => {
    // The press calls this an isenção. RERN art. 28.º n.º 40 makes it a fixed
    // 450 € reduction when the purchase goes through Casa Pronta, so the
    // difference between the two readings is 250 € of real money.
    const result = costs({ price: 300_000, youngFirstHome: true });
    expect(result.registration.youngReduction).toBe(
      REGISTRATION_FEES_2024.youngReduction.multipleActs,
    );
    expect(result.registration.amount).toBe(
      REGISTRATION_FEES_2024.multipleActs -
        REGISTRATION_FEES_2024.youngReduction.multipleActs,
    );
    expect(result.registration.amount).toBeGreaterThan(0);
  });

  it("is charged in full again above that ceiling", () => {
    const ceiling = CONTINENTE_HPP[3].upTo as number; // 330 539
    const result = costs({ price: ceiling + 1, youngFirstHome: true });
    expect(result.registration.youngReduction).toBe(0);
    expect(result.registration.amount).toBe(REGISTRATION_FEES_2024.multipleActs);
  });
});

describe("the total", () => {
  it("adds up the upfront lines and excludes the monthly interest selo", () => {
    const result = costs({ purpose: "other", bankFees: 600 });
    const sum =
      result.imt.amount +
      result.stampDutyTransfer.amount +
      result.stampDutyCredit.amount +
      result.registration.amount +
      result.bankFees;
    expect(result.upfrontTotal).toBeCloseTo(sum, 2);
    expect(result.stampDutyInterest.amount).toBeGreaterThan(0);
  });

  it("carries the provenance of every dataset it leaned on", () => {
    const result = costs();
    expect(result.source.map((s) => s.key)).toEqual([
      "imt",
      "stamp-duty",
      "registration",
    ]);
    // None of the three has an Axis B yet, so a costed answer is unverified —
    // and says so rather than borrowing the loan side's badge.
    expect(result.verified).toBe(false);
  });
});

describe("the Regiões Autónomas", () => {
  it("uses the islands' own tables for Madeira and the Açores alike", () => {
    const madeira = costs({ region: "madeira" });
    const acores = costs({ region: "acores" });
    const continente = costs();
    expect(madeira.imt.territory).toBe("regioes-autonomas");
    expect(madeira.imt.amount).toBe(acores.imt.amount);
    // 250 000 lands in the 5 % band on the islands and the 7 % band on the
    // mainland, so the islands are cheaper.
    expect(madeira.imt.amount).toBeLessThan(continente.imt.amount);
  });
});
