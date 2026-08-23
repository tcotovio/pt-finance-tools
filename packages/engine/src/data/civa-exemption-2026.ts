// Regime especial de isenção — CIVA art. 53.º.
//
// Its own dataset because two unrelated rules read it. It decides whether the
// worker charges IVA at all, and — through the reference in CIRS art. 101.º-B
// n.º 1 al. a) — whether their invoices suffer retenção na fonte. One
// threshold, two consequences, and the CIRS deliberately does not restate the
// figure, so this is the single place it exists.

import type { VatExemption } from "../types.js";

export const CIVA_EXEMPTION_2026: VatExemption = {
  effectiveFrom: "2026-01-01",
  /**
   * Art. 53.º n.º 1: exempt are those who have not reached, in the previous
   * calendar year, "um volume de negócios anual em território nacional
   * superior a 15 000 €".
   */
  turnoverThreshold: 15000,
  /**
   * The taxa normal of verba 18.ª — what an invoice carries once the exemption
   * is lost. Continente only: the Regiões Autónomas have lower taxas normais
   * (22 % Madeira, 16 % Açores), which this calculator does not yet select
   * between, so a non-exempt worker outside the Continente is over-charged
   * here and the UI says so.
   */
  standardRate: 0.23,
  source:
    "CIVA art. 53.º n.º 1 (DL n.º 35/2025) — https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/civa_rep/Pages/artigo-53-o-do-civa.aspx",
  // Axis A: the threshold was read from AT's own publication of the code, and
  // is quoted in the doc comment above. Axis B not done.
  verified: false,
};
