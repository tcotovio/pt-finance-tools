// Banco de Portugal macroprudential limits — Recomendação Macroprudencial
// n.º 1/2026, applicable to new contracts whose solvency assessment happens
// on or after 1 August 2026 (art. 11.º n.º 1). The 2018 Recomendação governs
// assessments up to 31 July 2026 (art. 11.º n.º 3), which is why these live
// in a dated dataset rather than in the solver.
//
// What changed in 2026, and it is worth recording because material written
// against the old regime is still everywhere:
//
//   * the DSTI ceiling fell from 50 % to 45 %, and the exception allowance
//     from 15 % to 10 % of each semester's volume;
//   * the average-maturity recommendation (30 years) was ELIMINATED, and the
//     age-based maturity ceilings simplified to just two bands;
//   * the 100 % LTV allowance for property acquired by the institution itself
//     was dropped.
//
// The interest-rate shock is deliberately NOT here: art. 6.º n.º 2 defers it
// to Instrução n.º 23/2023, a separate instrument on its own revision cycle.
// See ./interest-rate-shock-2023.ts.

import type { MacroprudentialParameters } from "../types.js";

export const BDP_2026: MacroprudentialParameters = {
  year: 2026,
  effectiveFrom: "2026-08-01",

  /**
   * Art. 6.º n.º 1: "É recomendado que as instituições não concedam crédito
   * que resulte num DSTI superior a 45%."
   */
  dstiLimit: 0.45,
  /**
   * Art. 6.º n.º 2: up to 10 % of each semester's total lending may exceed
   * the ceiling. A per-institution allowance, not a per-borrower one — the
   * calculator reports the limit as binding and leaves the exception to the
   * bank, which is the honest presentation for a consumer-facing tool.
   */
  dstiExceptionShare: 0.10,

  /**
   * Art. 5.º n.ºs 1–2. The denominator is the *lower* of purchase price and
   * appraisal value (art. 4.º), which the solver applies.
   */
  ltvLimit: {
    /** Acquisition, construction or works on habitação própria e permanente. */
    "own-permanent-residence": 0.90,
    /** Any other purpose. */
    other: 0.80,
  },

  /**
   * Art. 7.º n.º 1. With more than one borrower, n.º 2 takes the age of the
   * one with the earlier date of birth — i.e. the oldest.
   */
  maturity: {
    ageThreshold: 35,
    /** Years, for borrowers aged 35 or under (al. a). */
    yearsAtOrBelowThreshold: 40,
    /** Years, above 35 (al. b). */
    yearsAboveThreshold: 35,
  },

  /**
   * Art. 4.º n.º 5 al. b): "quando a idade do mutuário no termo previsto do
   * contrato for superior a 70 anos deve ser considerada uma redução do
   * rendimento de, pelo menos, 20% ponderada pelo rácio entre o número de
   * anos de vigência do contrato em que a idade do(s) mutuário(s) é superior
   * a 70 anos e a maturidade total do contrato."
   *
   * Two details the wording carries and a naive reading drops: the reduction
   * is *weighted* by the share of the contract lived past 70 (not applied
   * flat), and it does not apply at all if the borrower is already retired
   * at the time of assessment.
   */
  incomeReduction: {
    age: 70,
    fraction: 0.20,
  },

  source:
    "Recomendação Macroprudencial n.º 1/2026, Banco de Portugal " +
    "(https://www.bportugal.pt/sites/default/files/documents/2026-07/Recomendacao_Macroprudencial_n.1-2026.pdf)",
  /**
   * Transcribed from the primary PDF and re-diffed in CI against a mechanical
   * extraction of it (bdp-2026.source.test.ts) — Axis A of the §6 strategy.
   * Axis B (end-to-end against bank simulators) is still open, so this stays
   * false; see PLAN.md Phase 2.
   */
  verified: false,
};
