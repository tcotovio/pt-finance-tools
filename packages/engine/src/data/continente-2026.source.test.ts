// Cross-check: the hand-transcribed dataset vs an INDEPENDENT mechanical
// extraction of the same official PDF.
//
// The golden tests in wage/withholding.test.ts verify that the engine applies
// the despacho *formula* correctly — but they compute their expectations from
// the very numbers in continente-2026.ts, so they cannot catch a transcription
// error. This file closes that gap: the fixture was produced by parsing the
// despacho PDF's text runs (see fixtures/continente-2026-despacho.json for
// provenance), never by reading the TypeScript.
//
// If a future tax-year edit fat-fingers a rate, this fails.

import { describe, expect, it } from "vitest";
import despacho from "./fixtures/continente-2026-despacho.json" with { type: "json" };
import { CONTINENTE_2026 } from "./continente-2026.js";
import type { TaxpayerCategory } from "../types.js";

const CATEGORIES: TaxpayerCategory[] = [
  "unmarried",
  "married-dual-earner",
  "married-single-earner",
];

describe("CONTINENTE_2026 vs independent extraction of Despacho 233-A/2026", () => {
  it("fixture provenance points at the same despacho as the dataset", () => {
    expect(CONTINENTE_2026.source).toContain("233-A/2026");
    expect(CONTINENTE_2026.source).toContain(despacho.sourceUrl);
  });

  for (const category of CATEGORIES) {
    describe(category, () => {
      const expectedRows = despacho.tables[category];
      const actualRows = CONTINENTE_2026.tables.find(
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
