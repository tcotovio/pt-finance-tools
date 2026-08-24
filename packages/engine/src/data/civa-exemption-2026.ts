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
   * The taxa normal, by region — CIVA art. 18.º.
   *
   * N.º 1 al. c) sets 23 % for "as restantes importações, transmissões de bens
   * e prestações de serviços". N.º 3 then lets the Assembleias Legislativas of
   * the Açores and Madeira "fixar taxas diminuídas do IVA aplicáveis às
   * transmissões de bens e prestações de serviços que se considerem efetuadas
   * nas regiões autónomas", which they have: 22 % and 16 %.
   *
   * A record rather than a single rate because the flat 23 % this shipped with
   * was simply wrong outside the Continente. It moves only the invoice total
   * and never the take-home — IVA is the State's money either way — but a
   * wrong number is a wrong number.
   */
  standardRate: {
    continente: 0.23,
    madeira: 0.22,
    acores: 0.16,
  },
  source:
    "CIVA art. 53.º n.º 1 (DL n.º 35/2025) e art. 18.º — https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/civa_rep/Pages/artigo-53-o-do-civa.aspx",
  // Axis A: both the threshold and all three taxas normais were read from AT's
  // own publication of the code and are quoted in the doc comments above.
  //
  // Axis B: PARTIAL, and not enough. Independent simulators do apply 23 % as a
  // pass-through exactly as this engine does, which the crosscheck records —
  // but every one of them is Continente-only, so the two Regiões Autónomas
  // rates are Axis A alone. The threshold fares worse: the third-party sources
  // *state* 15 000 €, none of them computes anything from it, and agreement on
  // a quoted number is not an independent implementation. So this stays false,
  // and `selfEmployedNet` only lets it reach the answer's `verified` flag when
  // IVA is actually charged.
  verified: false,
};
