// Axis A for the IMT tables: is the transcription faithful to the ofício?
//
// The fixture is a mechanical `pdf2json` extraction of the official PDF, not a
// second pass by hand, so this is a genuine diff between two independent
// readings of the same document rather than a restatement of one of them.
//
// The test also pulls each number back out of the verbatim row text the
// extraction kept, which is the trick `bdp-2026.source.test.ts` uses: editing
// a threshold in the dataset without the law changing fails here, and the
// failure prints the official Portuguese line beside the changed value.

import { describe, expect, it } from "vitest";
import { IMT_2026 } from "./imt-2026.js";
import fixture from "./fixtures/imt-2026-oficio-circulado.json" with { type: "json" };
import type { ImtTableId, ImtTerritory } from "../types.js";

/**
 * The figures in a row, in the order they appear: "1 150 853" → 1150853.
 *
 * The thousands separator is a space, so the pattern has to know that a group
 * following one is exactly three digits. A looser `\d[\d ]*` reads
 * "792 414 8%" as the single number 7 924 148 and the row quietly stops being
 * checked — which is the failure mode this whole test exists to prevent.
 */
function numbersIn(row: string): number[] {
  return [...row.matchAll(/\d{1,3}(?: \d{3})*(?:,\d+)?/g)]
    .map((m) => Number(m[0].replace(/ /g, "").replace(",", ".")))
    .filter((n) => Number.isFinite(n));
}

/** A rate as the ofício prints it: 0.075 → 7.5, without binary-float dust. */
function asPercent(rate: number): number {
  return Math.round(rate * 100_000) / 1000;
}

describe("IMT 2026 — transcription against the official ofício circulado", () => {
  it("cites the document the fixture was extracted from", () => {
    expect(IMT_2026.source).toContain(fixture.sourceUrl);
    expect(IMT_2026.source).toContain("40129/2026");
  });

  it("covers all six tables, and nothing else", () => {
    const seen = Object.values(fixture.tables).map(
      (t) => `${t.territory}/${t.table}`,
    );
    const declared = Object.entries(IMT_2026.tables).flatMap(
      ([territory, tables]) =>
        Object.keys(tables).map((table) => `${territory}/${table}`),
    );
    expect(new Set(seen)).toEqual(new Set(declared));
    expect(seen).toHaveLength(6);
  });

  for (const [id, table] of Object.entries(fixture.tables)) {
    describe(`Tabela ${id} — ${table.heading}`, () => {
      const mine =
        IMT_2026.tables[table.territory as ImtTerritory][
          table.table as ImtTableId
        ];

      it("has the same number of rows", () => {
        expect(mine).toHaveLength(table.brackets.length);
      });

      table.brackets.forEach((extracted, i) => {
        it(`row ${i + 1}: ${extracted.row}`, () => {
          const row = mine[i];
          expect(row.upTo, extracted.row).toBe(extracted.upTo);
          expect(row.rate, extracted.row).toBeCloseTo(extracted.rate, 10);
          expect(row.deduct, extracted.row).toBeCloseTo(extracted.deduct, 10);
          expect(Boolean(row.single), extracted.row).toBe(extracted.single);

          // And again from the verbatim line, so the extraction's own parse is
          // not the only thing standing between the dataset and the PDF.
          const numbers = numbersIn(extracted.row);
          if (extracted.upTo !== null) {
            expect(numbers, extracted.row).toContain(row.upTo);
          }
          if (row.deduct > 0) {
            expect(numbers, extracted.row).toContain(row.deduct);
          }
          expect(numbers, extracted.row).toContain(asPercent(row.rate));
        });
      });
    });
  }

  it("keeps the Regiões Autónomas thresholds 25 % above the Continente's", () => {
    // Artigo único da Lei n.º 21/90. NOT how the dataset is built — both sets
    // are transcribed from their own tables — but a relationship the ofício
    // still satisfies in 2026, and a cheap second opinion on six of the rows.
    const pairs: ImtTableId[] = [
      "own-permanent-residence",
      "young-own-permanent-residence",
      "housing",
    ];
    for (const table of pairs) {
      const mainland = IMT_2026.tables.continente[table];
      const islands = IMT_2026.tables["regioes-autonomas"][table];
      mainland.forEach((row, i) => {
        if (row.upTo === null) {
          expect(islands[i].upTo).toBeNull();
          return;
        }
        expect(islands[i].upTo, `${table} row ${i + 1}`).toBe(
          Math.round(row.upTo * 1.25),
        );
      });
    }
  });
});
