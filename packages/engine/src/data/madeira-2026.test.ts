// Golden tests for the 2026 Madeira dataset, computed from the despacho
// 19/2026 formula:
//
//   Remuneração × Taxa − Parcela a abater − Parcela por dependente × nº
//
// Like the Continente golden tests these derive from the same transcribed
// numbers, so they cannot catch a transcription error — that is what
// madeira-2026.source.test.ts is for. What they do catch is the wiring:
// wrong table for a category, a bracket boundary off by one, or the §5.h
// reduction being applied where it should not be.

import { describe, expect, it } from "vitest";
import type { TaxpayerCategory, WageInput } from "../types.js";
import { computeNetWage } from "../wage/index.js";
import { CONTINENTE_2026 } from "./continente-2026.js";
import { MADEIRA_2026 } from "./madeira-2026.js";

function wage(
  category: TaxpayerCategory,
  grossMonthly: number,
  dependents: number,
): WageInput {
  return {
    grossMonthly,
    region: "madeira",
    category,
    dependents,
    referenceDate: "2026-06-01",
  };
}

interface Golden {
  name: string;
  input: WageInput;
  withholding: number;
  net: number;
}

const GOLDEN: Golden[] = [
  {
    // Tabela I/II, escalão "Até 1 623": 17,63 %, PA 164,31.
    name: "unmarried, 0 dep, 1500",
    input: wage("unmarried", 1500, 0),
    withholding: 100.14, // 1500*0.1763 - 164.31
    net: 1234.86, // 1500 - 100.14 - 165
  },
  {
    // Escalão "Até 980": 0 % — Madeira's exemption reaches higher than the
    // Continente's 920 €.
    name: "unmarried, 0 dep, 980",
    input: wage("unmarried", 980, 0),
    withholding: 0,
    net: 872.2, // 980 - 0 - 107.80
  },
  {
    // Escalão "Até 1 028": 8,72 %, PA = 8,72 % × 2,60 × (1 356,92 − R).
    name: "unmarried, 0 dep, 1000 (formula bracket)",
    input: wage("unmarried", 1000, 0),
    withholding: 6.2790976, // 1000*0.0872 - 0.0872*2.6*(1356.92-1000)
    net: 883.7209024, // 1000 - 6.2790976 - 110
  },
  {
    // Escalão "Até 2 332": nominal 22,30 %, −1pp for 3+ deps -> 21,30 %,
    // PA 240,11, parcela por dependente 34,29. Madeira's despacho carries the
    // same alínea h) as the Continente's.
    name: "unmarried, 3 dep, 2000 (§5.h -1pp)",
    input: wage("unmarried", 2000, 3),
    withholding: 83.02, // 2000*0.213 - 240.11 - 34.29*3
    net: 1696.98, // 2000 - 83.02 - 220
  },
  {
    // Tabela I (casado dois titulares): same rates, parcela por dependente
    // 21,43 — the only difference between Tabelas I and II.
    name: "married-dual-earner, 2 dep, 2000",
    input: wage("married-dual-earner", 2000, 2),
    withholding: 163.03, // 2000*0.223 - 240.11 - 21.43*2
    net: 1616.97, // 2000 - 163.03 - 220
  },
  {
    // Tabela III, escalão "Até 2 485": 10,91 %, PA 114,00.
    name: "married-single-earner, 0 dep, 2000",
    input: wage("married-single-earner", 2000, 0),
    withholding: 104.2, // 2000*0.1091 - 114.00
    net: 1675.8, // 2000 - 104.20 - 220
  },
  {
    // Tabela III, escalão "Até 997": 0 %.
    name: "married-single-earner, 0 dep, 997",
    input: wage("married-single-earner", 997, 0),
    withholding: 0,
    net: 887.33, // 997 - 0 - 109.67
  },
];

describe("Madeira 2026 golden tests (vs despacho 19/2026)", () => {
  it.each(GOLDEN)("$name", ({ input, withholding, net }) => {
    const r = computeNetWage(input, MADEIRA_2026);
    expect(r.irsWithholding).toBeCloseTo(withholding, 4);
    expect(r.netMonthly).toBeCloseTo(net, 4);
    expect(r.socialSecurity).toBeCloseTo(input.grossMonthly * 0.11, 10);
  });

  it("withholds less than the Continente on the same salary", () => {
    // The whole reason the region matters: Madeira's rates are lower. If the
    // two datasets were ever crossed, this is the cheapest way to notice.
    const madeira = computeNetWage(wage("unmarried", 1500, 0), MADEIRA_2026);
    const continente = computeNetWage(
      { ...wage("unmarried", 1500, 0), region: "continente" },
      CONTINENTE_2026,
    );
    expect(madeira.irsWithholding).toBeLessThan(continente.irsWithholding);
    expect(madeira.netMonthly).toBeGreaterThan(continente.netMonthly);
  });

  it("refuses to compute a Madeira input against the Continente tables", () => {
    expect(() =>
      computeNetWage(wage("unmarried", 1500, 0), CONTINENTE_2026),
    ).toThrow(/does not match input region/);
  });

  it("is honest that only the transcription has been cross-checked", () => {
    // Axis A passes (madeira-2026.source.test.ts); Axis B has no independent
    // simulator covering Madeira, so the dataset must not claim verified.
    expect(MADEIRA_2026.verified).toBe(false);
    const r = computeNetWage(wage("unmarried", 1500, 0), MADEIRA_2026);
    expect(r.datasetVerified).toBe(false);
    expect(r.datasetSource).toMatch(/19\/2026/);
  });
});
