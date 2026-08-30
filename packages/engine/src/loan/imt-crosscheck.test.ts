// Axis B for the IMT tables: end-to-end against two INDEPENDENT simulators.
//
// data/imt-2026.source.test.ts proves the tables were transcribed correctly
// from the ofício circulado. That is necessary and not sufficient: it cannot
// catch a correct table applied the wrong way — the wrong table for a purpose
// or a territory, an exemption ceiling read as a marginal bracket, the art.
// 7.º-A cap missed. These scenarios come from other people's implementations
// of the same statute, so they fail on exactly that class of error.
//
// See fixtures/imt-2026-crosscheck.json for provenance, for how the readings
// were policed, and for why one source carries a tolerance and the other does
// not.

import { describe, expect, it } from "vitest";
import fixture from "../data/fixtures/imt-2026-crosscheck.json" with { type: "json" };
import { purchaseCostsForDate } from "./purchase-costs.js";
import { getImtTables } from "../data/index.js";
import type { PropertyPurpose, Region } from "../types.js";

const DATE = fixture.assessmentDate;
const tol = (source: string) =>
  fixture.sources[source as keyof typeof fixture.sources].tolerance;

describe("IMT and verba 1.1 vs independent simulators", () => {
  for (const s of fixture.scenarios) {
    const label =
      `${s.source}: ${s.region}, ${s.purpose}${s.young ? " (jovem)" : ""}, ` +
      `${s.price} € — ${s.note}`;

    it(label, () => {
      const costs = purchaseCostsForDate({
        price: s.price,
        // Zero loan: these simulators cost the ACQUISITION only, so the verba
        // 17.1 selo must be kept out of the comparison rather than silently
        // inflating our side of it.
        loanAmount: 0,
        termYears: 30,
        annualRate: 0.03,
        purpose: s.purpose as PropertyPurpose,
        region: s.region as Region,
        youngFirstHome: s.young,
        assessmentDate: DATE,
      });

      // Rounded to the cent before comparing: these are euro amounts, and a
      // raw subtraction lands at 0.09000000000014552 against a 0,09 tolerance.
      const gap = (a: number, b: number) => Math.round(Math.abs(a - b) * 100) / 100;

      const t = tol(s.source);
      expect(gap(costs.imt.amount, s.imt)).toBeLessThanOrEqual(t);
      expect(
        gap(costs.stampDutyTransfer.amount, s.stampDutyTransfer),
      ).toBeLessThanOrEqual(Math.max(t, 0.01));
    });
  }

  it("matches the notaries to the cent, with no tolerance at all", () => {
    // Stated as its own assertion because it is the strongest single claim
    // here and a tolerance in the loop above could otherwise hide its loss.
    const exact = fixture.scenarios.filter((s) => s.source === "notarios");
    expect(exact.length).toBeGreaterThanOrEqual(9);
    expect(tol("notarios")).toBe(0);
  });
});

describe("the flat-rate acquisitions, al. d) and al. e)", () => {
  for (const s of fixture.flatRateScenarios) {
    it(`${s.kind}, ${s.price} € — ${s.note}`, () => {
      const tables = getImtTables(DATE);
      const rate = s.kind === "rustic" ? tables.rusticRate : tables.otherUrbanRate;
      expect(s.price * rate).toBeCloseTo(s.imt, 2);
    });
  }
});

describe("the property the disputed cents turn on", () => {
  // CIMT art. 17.º n.º 3 taxes "a primeira parte à taxa média, o excedente à
  // taxa marginal", which forces the tax to be continuous where one bracket
  // hands over to the next. That decides between this engine's parcelas and
  // CalculaPT's without either simulator having to be trusted — and it is why
  // that source carries a tolerance instead of this engine moving to meet it.
  it("is continuous at every bracket boundary of every table", () => {
    const tables = getImtTables(DATE);
    let worst = 0;
    for (const byPurpose of Object.values(tables.tables)) {
      for (const table of Object.values(byPurpose)) {
        for (let i = 1; i < table.length; i++) {
          const below = table[i - 1]!;
          const above = table[i]!;
          if (below.upTo === null || above.single || below.single) continue;
          const at = below.upTo;
          const gap =
            (at * above.rate - above.deduct) - (at * below.rate - below.deduct);
          worst = Math.max(worst, Math.abs(gap));
        }
      }
    }
    expect(worst).toBeLessThan(1e-6);
  });

  it("would not be continuous with the parcela CalculaPT uses", () => {
    // The concrete counter-example, so the test above cannot pass vacuously.
    const at = 198_347;
    const fromBelow = at * 0.05 - 6_491.02;
    const theirs = at * 0.07 - 10_458.04;
    expect(Math.abs(theirs - fromBelow)).toBeCloseTo(0.08, 2);
  });
});
