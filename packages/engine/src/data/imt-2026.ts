// IMT rate tables — CIMT art. 17.º n.º 1, in the wording given by the Lei do
// Orçamento do Estado para 2026, in force from 1 January 2026.
//
// The brackets are re-indexed every January by the OE law, which is why these
// live in a dated dataset. Nothing else about IMT moves on that cycle, so the
// Imposto do Selo rates and the registration emoluments are separate files:
// verba 1.1 has been 0,8 % for years and the Casa Pronta tariff is emolumental
// rather than fiscal. Bundling them would stamp a fictitious effective date on
// two of the three and re-assert `verified` over them on an IMT-only check.
//
// Two features of these tables that look like transcription errors and are not:
//
//   * The top rows are *taxas únicas* applied to the whole value, not marginal
//     rates on the excess. Crossing into one therefore makes the tax JUMP: at
//     660 982 € the Continente HPP table goes from 39 115,21 € (8 % − 13 763,35)
//     to 39 658,92 € (6 % of the lot), so 1 € more house costs 543,71 € more
//     tax. That is what the statute says; `imt-2026.test.ts` pins it.
//   * The young table (al. b) and the general one converge above 660 982 €,
//     both running the same taxas únicas. The under-35 benefit does not taper —
//     it ends, and the cliff is worth 13 223,45 € at that exact value.
//
// The Regiões Autónomas tables are not derived from the Continente ones here.
// They run 25 % above under the artigo único da Lei n.º 21/90, but they are
// transcribed from their own tables (IV–VI) in the same ofício circulado, so a
// future year in which the relationship stops holding is a data change rather
// than a silently wrong answer.

import type { ImtTables } from "../types.js";

export const IMT_2026: ImtTables = {
  year: 2026,
  effectiveFrom: "2026-01-01",

  tables: {
    continente: {
      /**
       * Tabela I — al. a): "Aquisição de prédio urbano ou de fração autónoma
       * de prédio urbano destinado exclusivamente a habitação própria e
       * permanente".
       */
      "own-permanent-residence": [
        { upTo: 106_346, rate: 0, deduct: 0 },
        { upTo: 145_470, rate: 0.02, deduct: 2_126.92 },
        { upTo: 198_347, rate: 0.05, deduct: 6_491.02 },
        { upTo: 330_539, rate: 0.07, deduct: 10_457.96 },
        { upTo: 660_982, rate: 0.08, deduct: 13_763.35 },
        { upTo: 1_150_853, rate: 0.06, deduct: 0, single: true },
        { upTo: null, rate: 0.075, deduct: 0, single: true },
      ],
      /**
       * Tabela II — al. b), HPP "por jovens com idade igual ou inferior a 35
       * anos". The 0 % row is the isenção of art. 9.º n.º 2, whose ceiling the
       * statute defines as "o valor máximo do 1.º escalão a que se refere a
       * alínea b) do n.º 1 do artigo 17.º" — this row, by self-reference.
       *
       * Above it the row is exactly 8 % of the excess over 330 539 €
       * (0,08 × 330 539 = 26 443,12), which is the "só paga sobre o que passa
       * do escalão" the popular guides describe.
       */
      "young-own-permanent-residence": [
        { upTo: 330_539, rate: 0, deduct: 0 },
        { upTo: 660_982, rate: 0.08, deduct: 26_443.12 },
        { upTo: 1_150_853, rate: 0.06, deduct: 0, single: true },
        { upTo: null, rate: 0.075, deduct: 0, single: true },
      ],
      /**
       * Tabela III — al. c): "Aquisição de prédio urbano ou de fração autónoma
       * de prédio urbano destinado exclusivamente a habitação, não abrangidas
       * pelas alíneas anteriores". Note its 8 % band ends at 633 931 €, not at
       * 660 982 € — the two tables do not share that boundary.
       */
      housing: [
        { upTo: 106_346, rate: 0.01, deduct: 0 },
        { upTo: 145_470, rate: 0.02, deduct: 1_063.46 },
        { upTo: 198_347, rate: 0.05, deduct: 5_427.56 },
        { upTo: 330_539, rate: 0.07, deduct: 9_394.50 },
        { upTo: 633_931, rate: 0.08, deduct: 12_699.89 },
        { upTo: 1_150_853, rate: 0.06, deduct: 0, single: true },
        { upTo: null, rate: 0.075, deduct: 0, single: true },
      ],
    },

    "regioes-autonomas": {
      /** Tabela IV. */
      "own-permanent-residence": [
        { upTo: 132_933, rate: 0, deduct: 0 },
        { upTo: 181_838, rate: 0.02, deduct: 2_658.66 },
        { upTo: 247_934, rate: 0.05, deduct: 8_113.80 },
        { upTo: 413_174, rate: 0.07, deduct: 13_072.48 },
        { upTo: 826_228, rate: 0.08, deduct: 17_204.22 },
        { upTo: 1_438_566, rate: 0.06, deduct: 0, single: true },
        { upTo: null, rate: 0.075, deduct: 0, single: true },
      ],
      /** Tabela V. */
      "young-own-permanent-residence": [
        { upTo: 413_174, rate: 0, deduct: 0 },
        { upTo: 826_228, rate: 0.08, deduct: 33_053.92 },
        { upTo: 1_438_566, rate: 0.06, deduct: 0, single: true },
        { upTo: null, rate: 0.075, deduct: 0, single: true },
      ],
      /** Tabela VI. */
      housing: [
        { upTo: 132_933, rate: 0.01, deduct: 0 },
        { upTo: 181_838, rate: 0.02, deduct: 1_329.33 },
        { upTo: 247_934, rate: 0.05, deduct: 6_784.47 },
        { upTo: 413_174, rate: 0.07, deduct: 11_743.15 },
        { upTo: 792_414, rate: 0.08, deduct: 15_874.89 },
        { upTo: 1_438_566, rate: 0.06, deduct: 0, single: true },
        { upTo: null, rate: 0.075, deduct: 0, single: true },
      ],
    },
  },

  /** Al. d): "Aquisição de prédios rústicos — 5 %". */
  rusticRate: 0.05,
  /**
   * Al. e): "Aquisição de outros prédios urbanos e outras aquisições onerosas
   * — 6,5 %". Neither rate is reachable from the mortgage calculator, which
   * only ever buys housing; they are here so the dataset is the whole article
   * rather than the part one caller happens to need.
   */
  otherUrbanRate: 0.065,

  source:
    "CIMT art. 17.º n.º 1, na redação da Lei n.º 73-A/2025, de 30 de dezembro " +
    "(Orçamento do Estado para 2026); tabelas práticas do Ofício Circulado " +
    "n.º 40129/2026, de 06-01, da Autoridade Tributária " +
    "(https://info.portaldasfinancas.gov.pt/pt/atualidades/instrucoesadmin/Paginas/Oficio-circulado-40129-2026.aspx)",
  /**
   * Both axes.
   *
   * Axis A: every bracket, rate and parcela a abater in all six tables is
   * re-diffed in CI against a mechanical `pdf2json` extraction of the official
   * ofício circulado (`imt-2026.source.test.ts`), the same discipline the
   * withholding tables get.
   *
   * Axis B: `loan/imt-crosscheck.test.ts` replays scenarios captured from two
   * independent public simulators — the Ordem dos Notários' and CalculaPT's.
   * The notaries agree to the cent across the general Continente table,
   * including the taxa-única jump at 660 982 €. CalculaPT covers what they do
   * not expose cleanly (the young table, rústicos, outros, and the Regiões
   * Autónomas) and agrees exactly on all of those.
   *
   * There is no public AT simulator to check against, incidentally: IMT
   * declarations sit behind Portal das Finanças authentication. So Axis B here
   * is peer implementations rather than an authoritative one, and a
   * disagreement has to be adjudicated rather than simply deferred to — which
   * is what happened. CalculaPT differs by up to 0,09 € on the tables carrying
   * a parcela a abater, using 10 458,04 where this dataset uses 10 457,96.
   * Art. 17.º n.º 3's "taxa média / taxa marginal" construction forces the tax
   * to be continuous at each boundary, and only these values are: the worst
   * discontinuity across all six tables is 7e-12 €, against a 0,08 € step from
   * theirs. The crosscheck therefore carries a per-source tolerance, pinned
   * alongside the continuity property so the tolerance can never quietly
   * become licence for this dataset to drift.
   */
  verified: true,
};
