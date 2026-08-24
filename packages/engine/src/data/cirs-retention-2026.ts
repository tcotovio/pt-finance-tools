// Retenção na fonte on categoria B — CIRS art. 101.º and the dispensa of
// art. 101.º-B.
//
// Nothing like the categoria A tables: there is no bracket, no parcela a
// abater and no dependent deduction. A flat rate applies to the rendimento
// ilíquido of the invoice, chosen by what the activity IS rather than by who
// the taxpayer is.
//
// Kept apart from the contribution parameters even though the UI shows them on
// one line. They are two instruments — the CIRS and the Código dos Regimes
// Contributivos — amended by different laws on different cycles: art. 101.º
// was last touched by DL n.º 97/2026 and the contribution rates have not moved
// since 2018.

import type { CategoryBRetention } from "../types.js";

export const CIRS_RETENTION_2026: CategoryBRetention = {
  effectiveFrom: "2026-01-01",
  /**
   * Art. 101.º n.º 1, verbatim in the alínea each rate comes from:
   *
   * - al. b) "23 %, tratando-se de rendimentos decorrentes das atividades
   *   profissionais especificamente previstas na tabela a que se refere o
   *   artigo 151.º"
   * - al. c) "11,5 %, tratando-se de rendimentos da categoria B referidos na
   *   alínea b) do n.º 1 e nas alíneas g) e i) do n.º 2 do artigo 3.º, não
   *   compreendidos na alínea anterior"
   * - al. a) "16,5 %, tratando-se de rendimentos da categoria B referidos na
   *   alínea c) do n.º 1 do artigo 3.º" — propriedade intelectual e industrial
   *
   * The professional rate is **23 %, not 25 %**. It was 25 % until the OE 2024
   * lowered it, and every secondary source consulted while scoping this still
   * said 25 %. The 25 % in art. 101.º today is the categoria F rate (al. e),
   * which is not this calculator's business — which is exactly how a stale
   * figure survives being "checked".
   */
  rates: {
    professional: 0.23,
    "other-services": 0.115,
    "intellectual-property": 0.165,
  },
  /**
   * Art. 101.º-B n.º 1 al. d), added by DL n.º 49/2025 with effect from
   * 1 July 2025: no retention "sempre que o montante de cada retenção seja
   * inferior a € 25". A per-invoice floor, so it can dispense one invoice and
   * not the next.
   */
  minimumRetention: 25,
  /**
   * Art. 101.º-B n.º 1 al. a) dispenses retention when the holder expects to
   * earn, in the year, less than "o fixado no n.º 1 do artigo 53.º do Código
   * do IVA".
   *
   * A **reference**, not a number — which is why the threshold lives in the
   * CIVA dataset and is read from there. The CIRS does not restate the figure,
   * so neither does this: when the CIVA ceiling moves, the dispensa moves with
   * it and nothing here has to be edited. Copying it would have created a
   * second place for it to be wrong.
   */
  dispensaFollowsVatThreshold: true,
  source:
    "CIRS arts. 101.º e 101.º-B — https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cirs_rep/Pages/irs101.aspx " +
    "· al. b) na redação da Lei n.º 82/2023 (OE 2024) · al. d) do art. 101.º-B aditada pelo DL n.º 49/2025",
  // Verified on both axes (2026-08-24):
  //
  // Axis A — each rate is recorded beside the verbatim alínea it came from, in
  // AT's own publication of the code.
  //
  // Axis B — three independent public simulators reproduce the 23 % rate to
  // the cent across six scenarios, including one where the retention is due
  // while the contribution is not (first year of activity), which is what
  // proves the two are computed separately rather than from a shared base.
  //
  // WHAT AXIS B DID NOT REACH: the 11,5 % and 16,5 % rates, the 25 € minimum
  // of art. 101.º-B n.º 1 al. d), and the annual dispensa. Every external
  // source found models the professional rate and nothing else — CalculaPT
  // states 11,5 % and 20 % in prose without computing either. Those three
  // rules are Axis A alone, and the 23 % correction is exactly the reminder
  // that a rate stated in prose can be a rate nobody has checked.
  verified: true,
};
