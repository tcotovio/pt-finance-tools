// Cross-check: the hand-transcribed Madeira dataset vs an INDEPENDENT
// mechanical extraction of the same official PDF.
//
// Same purpose as continente-2026.source.test.ts: the dataset was typed out by
// reading the despacho, the fixture was produced by parsing the PDF's text
// runs, and this diffs the two. A transposed digit fails here.

import { describe, expect, it } from "vitest";
import despacho from "./fixtures/madeira-2026-despacho.json" with { type: "json" };
import { MADEIRA_2026 } from "./madeira-2026.js";
import type { TaxpayerCategory } from "../types.js";

const CATEGORIES: TaxpayerCategory[] = [
  "unmarried",
  "married-dual-earner",
  "married-single-earner",
];

describe("MADEIRA_2026 vs independent extraction of Despacho 19/2026", () => {
  it("fixture provenance points at the same despacho as the dataset", () => {
    expect(MADEIRA_2026.source).toContain("19/2026");
    expect(MADEIRA_2026.source).toContain(despacho.sourceUrl);
  });

  for (const category of CATEGORIES) {
    describe(category, () => {
      const expectedRows = despacho.tables[category];
      const actualRows = MADEIRA_2026.tables.find(
        (t) => t.category === category,
      )!.brackets;

      it("has the same number of brackets as the PDF", () => {
        expect(actualRows).toHaveLength(expectedRows.length);
      });

      expectedRows.forEach((expectedRow, i) => {
        it(`bracket ${i} (up to ${expectedRow.upTo ?? "∞"}) matches the PDF`, () => {
          const actual = actualRows[i];
          expect(actual.upTo).toBe(expectedRow.upTo);
          expect(actual.marginalRate).toBeCloseTo(expectedRow.marginalRate, 10);
          expect(actual.dependentDeduction).toBeCloseTo(
            expectedRow.dependentDeduction,
            10,
          );
          expect(actual.deduction.kind).toBe(expectedRow.deduction.kind);
          if (
            actual.deduction.kind === "fixed" &&
            expectedRow.deduction.kind === "fixed"
          ) {
            expect(actual.deduction.amount).toBeCloseTo(
              expectedRow.deduction.amount!,
              10,
            );
          } else if (
            actual.deduction.kind === "formula" &&
            expectedRow.deduction.kind === "formula"
          ) {
            expect(actual.deduction.multiplier).toBeCloseTo(
              expectedRow.deduction.multiplier!,
              10,
            );
            expect(actual.deduction.base).toBeCloseTo(
              expectedRow.deduction.base!,
              10,
            );
          }
        });
      });
    });
  }
});
