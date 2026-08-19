// 2026 IRS withholding tables for the Região Autónoma da Madeira —
// trabalho dependente, titulares sem deficiência (Tabelas I, II, III).
//
// SOURCE: Despacho n.º 19/2026 da Secretaria Regional das Finanças (JORAM,
// II Série, N.º 13, Suplemento 4, de 20 de janeiro de 2026), transcribed from
// the official PDF:
// https://at.madeira.gov.pt/ficheiros/IISerie-013-2026-01-20Supl4.pdf
//
// Madeira sets its own rates rather than mirroring the Continente: the
// withholding exemption starts at 980,00 € (997,00 € for casado único
// titular) against the Continente's 920,00 €, and the rates below the top
// bracket are lower throughout. The shape of the table is identical, so no
// engine change is needed — this is a data addition.
//
// Scope note: pensions and pessoa-com-deficiência tables (IV–XI) are out of
// Phase 1 scope and intentionally omitted, exactly as for the Continente.
//
// Category mapping, as on the Continente tables:
//   unmarried            -> Tabela I/II brackets, parcela por dependente 34,29 €
//   married-dual-earner  -> Tabela I/II brackets, parcela por dependente 21,43 €
//   married-single-earner-> Tabela III,          parcela por dependente 42,86 €
//
// The first row of every table prints a 0,00 parcela adicional por dependente
// in the source and is transcribed as such. On a 0 % row with a 0,00 parcela a
// abater the withholding is zero regardless, since it is clamped at zero.

import type { WithholdingBracket, WithholdingDataset } from "../types.js";

/**
 * Rate + parcela-a-abater columns shared by Tabela I ("não casado sem
 * dependentes ou casado 2 titulares") and Tabela II ("não casado com um ou
 * mais dependentes"). Only the per-dependent deduction differs.
 */
function tabelaI_II(dependentDeduction: number): WithholdingBracket[] {
  return [
    { upTo: 980, marginalRate: 0, deduction: { kind: "fixed", amount: 0 }, dependentDeduction: 0 },
    { upTo: 1028, marginalRate: 0.0872, deduction: { kind: "formula", multiplier: 2.6, base: 1356.92 }, dependentDeduction },
    { upTo: 1099, marginalRate: 0.1204, deduction: { kind: "formula", multiplier: 1.35, base: 1696.78 }, dependentDeduction },
    { upTo: 1201, marginalRate: 0.1204, deduction: { kind: "fixed", amount: 97.17 }, dependentDeduction },
    { upTo: 1623, marginalRate: 0.1763, deduction: { kind: "fixed", amount: 164.31 }, dependentDeduction },
    { upTo: 2332, marginalRate: 0.223, deduction: { kind: "fixed", amount: 240.11 }, dependentDeduction },
    { upTo: 3203, marginalRate: 0.2242, deduction: { kind: "fixed", amount: 242.91 }, dependentDeduction },
    { upTo: 3614, marginalRate: 0.237, deduction: { kind: "fixed", amount: 283.91 }, dependentDeduction },
    { upTo: 6585, marginalRate: 0.3028, deduction: { kind: "fixed", amount: 521.72 }, dependentDeduction },
    { upTo: 6954, marginalRate: 0.2802, deduction: { kind: "fixed", amount: 372.9 }, dependentDeduction },
    { upTo: 21411, marginalRate: 0.2924, deduction: { kind: "fixed", amount: 457.74 }, dependentDeduction },
    { upTo: null, marginalRate: 0.3278, deduction: { kind: "fixed", amount: 1215.69 }, dependentDeduction },
  ];
}

/** Tabela III — trabalho dependente, casado único titular. */
const TABELA_III: WithholdingBracket[] = [
  { upTo: 997, marginalRate: 0, deduction: { kind: "fixed", amount: 0 }, dependentDeduction: 0 },
  { upTo: 1099, marginalRate: 0.0872, deduction: { kind: "formula", multiplier: 1.35, base: 1819.64 }, dependentDeduction: 42.86 },
  { upTo: 1141, marginalRate: 0.0872, deduction: { kind: "fixed", amount: 84.84 }, dependentDeduction: 42.86 },
  { upTo: 1857, marginalRate: 0.1033, deduction: { kind: "fixed", amount: 103.22 }, dependentDeduction: 42.86 },
  { upTo: 2485, marginalRate: 0.1091, deduction: { kind: "fixed", amount: 114 }, dependentDeduction: 42.86 },
  { upTo: 3331, marginalRate: 0.1236, deduction: { kind: "fixed", amount: 150.04 }, dependentDeduction: 42.86 },
  { upTo: 3895, marginalRate: 0.1404, deduction: { kind: "fixed", amount: 206.01 }, dependentDeduction: 42.86 },
  { upTo: 6673, marginalRate: 0.1595, deduction: { kind: "fixed", amount: 280.41 }, dependentDeduction: 42.86 },
  { upTo: 6878, marginalRate: 0.2213, deduction: { kind: "fixed", amount: 692.81 }, dependentDeduction: 42.86 },
  { upTo: 21411, marginalRate: 0.2493, deduction: { kind: "fixed", amount: 885.4 }, dependentDeduction: 42.86 },
  { upTo: null, marginalRate: 0.3278, deduction: { kind: "fixed", amount: 2566.17 }, dependentDeduction: 42.86 },
];

export const MADEIRA_2026: WithholdingDataset = {
  year: 2026,
  region: "madeira",
  effectiveFrom: "2026-01-01",
  source:
    "Despacho n.º 19/2026, Secretaria Regional das Finanças (JORAM, II Série, " +
    "N.º 13, Suplemento 4, 20-01-2026) — " +
    "https://at.madeira.gov.pt/ficheiros/IISerie-013-2026-01-20Supl4.pdf",
  /**
   * Axis A (transcription) passes: every bracket is diffed against an
   * independent mechanical extraction of the same PDF in
   * madeira-2026.source.test.ts.
   *
   * Axis B (model and mapping) has NOT been done — no public simulator found
   * that covers Madeira, so nothing independent confirms the engine applies
   * these tables the way regional payroll does. Per PLAN.md §6 both axes are
   * required, so this stays false and the UI shows "Dados por verificar".
   */
  verified: false,
  tables: [
    { category: "unmarried", brackets: tabelaI_II(34.29) },
    { category: "married-dual-earner", brackets: tabelaI_II(21.43) },
    { category: "married-single-earner", brackets: TABELA_III },
  ],
};
