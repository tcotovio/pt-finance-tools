// Segurança Social for trabalhadores independentes — Código dos Regimes
// Contributivos, in the shape DL n.º 2/2018 gave it.
//
// Dated 2018, not 2026, and deliberately: unlike a tax table none of these
// parameters re-indexes in January. The rates, the coefficients, the 1/3 and
// the multiples of IAS have all stood since the 2018 reform; what moves every
// year is the IAS the multiples are applied to, and that lives in its own
// dataset. Stamping this 2026 would have invented an annual revision cycle
// that does not exist and quietly implied last year's answers were different.
//
// Sourced from the ISS's own Guia Prático "Novo Regime dos Trabalhadores
// Independentes" (1009), which is the administering institution publishing its
// own parameters — the same standing as AT's ofício circulado on the IMT side.
// The consolidated Código itself has no URL that renders; PLAN.md §9 records
// that dead end, and `cc-53` on the wage side already carries no link for it.

import type { SelfEmployedContributions } from "../types.js";

export const SELF_EMPLOYED_CONTRIBUTIONS_2018: SelfEmployedContributions = {
  effectiveFrom: "2019-01-01",
  /**
   * Guia prático, "Taxas contributivas": 21,4 % for "Trabalhadores
   * Independentes e respetivos cônjuges" and for produtores agrícolas.
   */
  rate: 0.214,
  /**
   * 25,2 % for "Empresários em Nome Individual e dos Titulares de
   * Estabelecimento Individual de Responsabilidade Limitada, e respetivos
   * cônjuges". Carried because the difference is 3,8 pp of everything, and a
   * calculator that silently assumed the lower one would understate an ENI's
   * contribution all year.
   */
  soleTraderRate: 0.252,
  /**
   * "O rendimento relevante do Trabalhador Independente é determinado com base
   * nos rendimentos obtidos nos três meses imediatamente anteriores ao mês da
   * declaração trimestral, nos seguintes termos: ▪ 70% do valor total de
   * prestação de serviços; ▪ 20% dos rendimentos associados à produção e venda
   * de bens; ▪ 20% sobre a prestação de serviços no âmbito de atividades
   * hoteleiras e similares, restauração e bebidas, e que o declarem
   * fiscalmente como tal."
   *
   * A **three-way** split. Hospitality is a prestação de serviços that takes
   * the goods coefficient, so treating the split as "services vs goods" — the
   * obvious two-way reading — charges a restaurant 3,5 times the contribution
   * it owes.
   */
  coefficient: {
    services: 0.7,
    goods: 0.2,
    hospitality: 0.2,
  },
  /**
   * "A base de incidência contributiva mensal corresponde a 1/3 do rendimento
   * relevante apurado em cada período declarativo, produzindo efeitos no
   * próprio mês e nos dois meses seguintes."
   */
  monthsPerPeriod: 3,
  /**
   * "A base de incidência contributiva considerada em cada mês tem como limite
   * máximo 12 vezes o valor do IAS."
   */
  ceilingMultiplier: 12,
  /**
   * "Quando se verifique a inexistência de rendimentos ou o valor das
   * contribuições devidas [...] seja inferior a 20,00 €, é fixada a base de
   * incidência que corresponda ao montante de contribuições naquele valor."
   *
   * A floor on the **contribution**, not on the base — so it is 20,00 € owed,
   * not 20,00 € × 21,4 %. Reading it as a base floor understates it by a
   * factor of five, and the guide's own worked example ("a Marta pagará
   * 20,00 € por mês") is what settles it.
   */
  minimumContribution: 20,
  /**
   * Partial exemption when the worker also holds a salaried job: contributions
   * are owed only on the part of the average monthly relevant income above
   * 4 × IAS ("corresponde ao valor que ultrapasse aquele limite
   * (remanescente)").
   *
   * The guide's example attaches a second condition this engine cannot check —
   * the salaried job must itself pay more than 1 × IAS — so the caller asserts
   * the exemption applies rather than the engine deriving it.
   */
  accumulationThresholdMultiplier: 4,
  /**
   * "Trabalhar como independente pela primeira vez → No primeiro dia do 12.º
   * mês posterior ao do início de atividade."
   *
   * Not an exemption but a deferred start of the contributory obligation, and
   * the distinction shows: it applies once, to a first activity, and a
   * reinício starts contributing in the month it restarts.
   */
  firstActivityDeferralMonths: 12,
  source:
    "Código dos Regimes Contributivos (DL n.º 2/2018) via Guia Prático ISS n.º 1009, Novo Regime dos Trabalhadores Independentes — " +
    "https://www.seg-social.pt/documents/10152/14965/1009+Trabalhador+independente+-+novo+regime",
  // Axis A: every parameter above is recorded beside the verbatim sentence of
  // the guia prático it was read from, mechanically extracted from the PDF
  // (pdf2json) and checked in as a fixture — see
  // `selfemployed-contributions-2018.source.test.ts`.
  //
  // Axis B: NOT done. The candidate is Segurança Social Direta's own
  // simulator, and when it lands it is not a peer — the ISS administers this
  // regime, so a mismatch is a bug here rather than a divergence to record.
  verified: false,
};
