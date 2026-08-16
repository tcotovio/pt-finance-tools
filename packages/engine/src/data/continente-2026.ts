// 2026 IRS withholding tables for Continente — trabalho dependente,
// titulares sem deficiência (Tabelas I, II, III).
//
// SOURCE: Despacho n.º 233-A/2026, de 6 de janeiro (Diário da República,
// 2.ª série, N.º 3, Suplemento), transcribed from the official PDF:
// https://files.diariodarepublica.pt/2s/2026/01/003000001/0000200010.pdf
//
// Scope note: pensions (Tabelas VIII-IX) and pessoa-com-deficiência tables
// (IV-VII, X-XI) are out of Phase 1 scope and intentionally omitted.
//
// Category mapping:
//   unmarried            -> Tabela I/II brackets, parcela por dependente 34,29 €
//                           (Tabela I and II share the rate/parcela columns;
//                            they differ only in the per-dependent amount, and
//                            for 0 dependents the term is 0 either way).
//   married-dual-earner  -> Tabela I/II brackets, parcela por dependente 21,43 €
//   married-single-earner-> Tabela III,          parcela por dependente 42,86 €

import type { WithholdingBracket, WithholdingDataset } from "../types.js";

/**
 * Rate + parcela-a-abater columns shared by Tabela I ("não casado sem
 * dependentes ou casado dois titulares") and Tabela II ("não casado com um ou
 * mais dependentes"). Only the per-dependent deduction differs between them.
 */
function tabelaI_II(dependentDeduction: number): WithholdingBracket[] {
  return [
    { upTo: 920, marginalRate: 0, deduction: { kind: "fixed", amount: 0 }, dependentDeduction },
    { upTo: 1042, marginalRate: 0.125, deduction: { kind: "formula", multiplier: 2.6, base: 1273.85 }, dependentDeduction },
    { upTo: 1108, marginalRate: 0.157, deduction: { kind: "formula", multiplier: 1.35, base: 1554.83 }, dependentDeduction },
    { upTo: 1154, marginalRate: 0.157, deduction: { kind: "fixed", amount: 94.71 }, dependentDeduction },
    { upTo: 1212, marginalRate: 0.212, deduction: { kind: "fixed", amount: 158.18 }, dependentDeduction },
    { upTo: 1819, marginalRate: 0.241, deduction: { kind: "fixed", amount: 193.33 }, dependentDeduction },
    { upTo: 2119, marginalRate: 0.311, deduction: { kind: "fixed", amount: 320.66 }, dependentDeduction },
    { upTo: 2499, marginalRate: 0.349, deduction: { kind: "fixed", amount: 401.19 }, dependentDeduction },
    { upTo: 3305, marginalRate: 0.3836, deduction: { kind: "fixed", amount: 487.66 }, dependentDeduction },
    { upTo: 5547, marginalRate: 0.3969, deduction: { kind: "fixed", amount: 531.62 }, dependentDeduction },
    { upTo: 20221, marginalRate: 0.4495, deduction: { kind: "fixed", amount: 823.4 }, dependentDeduction },
    { upTo: null, marginalRate: 0.4717, deduction: { kind: "fixed", amount: 1272.31 }, dependentDeduction },
  ];
}

/** Tabela III — casado, único titular. */
const tabelaIII: WithholdingBracket[] = [
  { upTo: 991, marginalRate: 0, deduction: { kind: "fixed", amount: 0 }, dependentDeduction: 42.86 },
  { upTo: 1042, marginalRate: 0.125, deduction: { kind: "formula", multiplier: 2.6, base: 1372.15 }, dependentDeduction: 42.86 },
  { upTo: 1108, marginalRate: 0.125, deduction: { kind: "formula", multiplier: 1.35, base: 1677.85 }, dependentDeduction: 42.86 },
  { upTo: 1119, marginalRate: 0.125, deduction: { kind: "fixed", amount: 96.17 }, dependentDeduction: 42.86 },
  { upTo: 1432, marginalRate: 0.1272, deduction: { kind: "fixed", amount: 98.64 }, dependentDeduction: 42.86 },
  { upTo: 1962, marginalRate: 0.157, deduction: { kind: "fixed", amount: 141.32 }, dependentDeduction: 42.86 },
  { upTo: 2240, marginalRate: 0.1938, deduction: { kind: "fixed", amount: 213.53 }, dependentDeduction: 42.86 },
  { upTo: 2773, marginalRate: 0.2277, deduction: { kind: "fixed", amount: 289.47 }, dependentDeduction: 42.86 },
  { upTo: 3389, marginalRate: 0.257, deduction: { kind: "fixed", amount: 370.72 }, dependentDeduction: 42.86 },
  { upTo: 5965, marginalRate: 0.2881, deduction: { kind: "fixed", amount: 476.12 }, dependentDeduction: 42.86 },
  { upTo: 20265, marginalRate: 0.3843, deduction: { kind: "fixed", amount: 1049.96 }, dependentDeduction: 42.86 },
  { upTo: null, marginalRate: 0.4717, deduction: { kind: "fixed", amount: 2821.13 }, dependentDeduction: 42.86 },
];

export const CONTINENTE_2026: WithholdingDataset = {
  year: 2026,
  region: "continente",
  effectiveFrom: "2026-01-01",
  source:
    "Despacho n.º 233-A/2026 (DR 2.ª série, N.º 3, Suplemento, 06-01-2026) — " +
    "https://files.diariodarepublica.pt/2s/2026/01/003000001/0000200010.pdf",
  // Transcribed directly from the official despacho PDF and golden-tested
  // against its formula. Kept `false` until independently cross-checked
  // against a public simulator (e.g. Finanças / Doutor Finanças); results
  // computed from it are flagged via WageResult.datasetVerified.
  verified: false,
  tables: [
    { category: "unmarried", brackets: tabelaI_II(34.29) },
    { category: "married-dual-earner", brackets: tabelaI_II(21.43) },
    { category: "married-single-earner", brackets: tabelaIII },
  ],
};
