import { describe, expect, it } from "vitest";
import type { TaxpayerCategory, WageInput } from "../types.js";
import { computeNetWage } from "../wage/index.js";
import { CONTINENTE_2026, getWithholdingDataset } from "./index.js";

// Golden tests for the 2026 Continente dataset. Expected withholding values
// are computed directly from the official despacho 233-A/2026 formula
// (Remuneração × Taxa − Parcela a abater − Parcela por dependente × nº),
// which is itself the authoritative calculation method. Social Security is
// 11% of gross; net = gross − withholding − Social Security.
//
// (A follow-up may additionally cross-check these against a public simulator
// such as the Finanças or Doutor Finanças simulator.)

function wage(
  category: TaxpayerCategory,
  grossMonthly: number,
  dependents: number,
): WageInput {
  return { grossMonthly, region: "continente", category, dependents, referenceDate: "2026-06-01" };
}

interface Golden {
  name: string;
  input: WageInput;
  withholding: number;
  net: number;
}

const GOLDEN: Golden[] = [
  {
    // Tabela I, escalão "Até 1 819": 24,10 %, PA 193,33.
    name: "unmarried, 0 dep, 1500",
    input: wage("unmarried", 1500, 0),
    withholding: 168.17, // 1500*0.241 - 193.33
    net: 1166.83, // 1500 - 168.17 - 165
  },
  {
    // Tabela I, escalão "Até 920": 0 % — no withholding (RMMG protection).
    name: "unmarried, 0 dep, 920",
    input: wage("unmarried", 920, 0),
    withholding: 0,
    net: 818.8, // 920 - 0 - 101.20
  },
  {
    // Tabela I, escalão "Até 1 042": 12,50 %, PA = 12,50 % × 2,60 × (1273,85 − R).
    name: "unmarried, 0 dep, 1000 (formula bracket)",
    input: wage("unmarried", 1000, 0),
    withholding: 35.99875, // 1000*0.125 - 0.125*2.6*(1273.85-1000)
    net: 854.00125, // 1000 - 35.99875 - 110
  },
  {
    // Tabela II, escalão "Até 1 819": nominal 24,10 %, −1pp for 3+ deps -> 23,10 %,
    // PA 193,33, parcela por dependente 34,29.
    name: "unmarried, 3 dep, 1500 (§5.h -1pp)",
    input: wage("unmarried", 1500, 3),
    withholding: 50.3, // 1500*0.231 - 193.33 - 34.29*3
    net: 1284.7, // 1500 - 50.30 - 165
  },
  {
    // Tabela I (casado dois titulares), escalão "Até 2 119": 31,10 %, PA 320,66,
    // parcela por dependente 21,43.
    name: "married-dual-earner, 2 dep, 2000",
    input: wage("married-dual-earner", 2000, 2),
    withholding: 258.48, // 2000*0.311 - 320.66 - 21.43*2
    net: 1521.52, // 2000 - 258.48 - 220
  },
  {
    // Tabela III, escalão "Até 2 240": 19,38 %, PA 213,53.
    name: "married-single-earner, 0 dep, 2000",
    input: wage("married-single-earner", 2000, 0),
    withholding: 174.07, // 2000*0.1938 - 213.53
    net: 1605.93, // 2000 - 174.07 - 220
  },
  {
    // Tabela III, escalão "Até 991": 0 %.
    name: "married-single-earner, 0 dep, 991",
    input: wage("married-single-earner", 991, 0),
    withholding: 0,
    net: 881.99, // 991 - 0 - 109.01
  },
  {
    // Tabela III, escalão "Até 1 108": 12,50 %, PA = 12,50 % × 1,35 × (1677,85 − R).
    name: "married-single-earner, 0 dep, 1050 (formula bracket)",
    input: wage("married-single-earner", 1050, 0),
    withholding: 25.3003125, // 1050*0.125 - 0.125*1.35*(1677.85-1050)
    net: 909.1996875, // 1050 - 25.3003125 - 115.5
  },
];

describe("Continente 2026 golden tests (vs despacho 233-A/2026)", () => {
  it.each(GOLDEN)("$name", ({ input, withholding, net }) => {
    const r = computeNetWage(input, CONTINENTE_2026);
    expect(r.irsWithholding).toBeCloseTo(withholding, 4);
    expect(r.netMonthly).toBeCloseTo(net, 4);
    expect(r.socialSecurity).toBeCloseTo(input.grossMonthly * 0.11, 10);
  });

  it("cites the official source and surfaces its verification status", () => {
    // `verified` stays false until an independent cross-check is done; the
    // result propagates it so the UI can caveat.
    expect(CONTINENTE_2026.source).toMatch(/233-A\/2026/);
    const r = computeNetWage(wage("unmarried", 1500, 0), CONTINENTE_2026);
    expect(r.datasetVerified).toBe(CONTINENTE_2026.verified);
    expect(r.datasetSource).toMatch(/233-A\/2026/);
  });
});

describe("getWithholdingDataset", () => {
  it("resolves the 2026 dataset for a 2026 reference date", () => {
    expect(getWithholdingDataset("continente", "2026-06-01")).toBe(CONTINENTE_2026);
  });

  it("throws when no dataset is effective yet for the date", () => {
    expect(() => getWithholdingDataset("continente", "2025-12-31")).toThrow(
      /No withholding dataset/,
    );
  });

  it("resolves Madeira to its own regional dataset", () => {
    const dataset = getWithholdingDataset("madeira", "2026-06-01");
    expect(dataset.region).toBe("madeira");
    // Madeira sets its own rates: the exemption starts higher than the
    // Continente's 920 €, which is the cheapest proof the two are not mixed up.
    expect(dataset.tables[0]?.brackets[0]?.upTo).toBe(980);
  });

  it("throws for a region with no dataset (Açores not yet transcribed)", () => {
    expect(() => getWithholdingDataset("acores", "2026-06-01")).toThrow(
      /No withholding dataset/,
    );
  });
});
