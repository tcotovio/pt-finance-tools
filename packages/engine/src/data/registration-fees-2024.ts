// Registration and deed costs, via Casa Pronta — the single-desk service that
// does the escritura and the registos in one act.
//
// Emolumental, not fiscal: set by the Regulamento Emolumentar dos Registos e
// Notariado (DL n.º 322-A/2001), on its own revision cycle, which is why this
// is a third dataset rather than a field on one of the tax ones.
//
// The price this calculator wants is `multipleActs`. Every case it computes is
// a purchase WITH a mortgage, so there are at least two registrations — the
// acquisition and the hipoteca in the bank's favour — and `singleAct` is the
// cash-purchase price. It is also a FLOOR rather than the cost: Casa Pronta is
// optional, and a notary with separate registos costs more.
//
// DL n.º 48-D/2024, de 31 de julho, helps the young first-time buyer here —
// but by a REDUCTION rather than the exemption the press coverage describes.
// RERN art. 28.º n.º 37 does exempt the registos de aquisição e de hipoteca;
// n.º 40 then says that when the purchase goes through the procedimento
// especial — which is exactly what Casa Pronta is — the procedure's emoluments
// are instead reduced by 225 € for one fact or 450 € for more than one. So a
// qualifying buyer with a mortgage pays 250 €, not nothing.
//
// The value ceiling is defined by reference to the CIMT — "o valor máximo do
// 4.º escalão da tabela prevista na alínea a) do n.º 1 do artigo 17.º" — so it
// is read off `IMT_2026` rather than copied here, and re-indexes with the IMT
// brackets automatically.

import type { RegistrationFees } from "../types.js";

export const REGISTRATION_FEES_2024: RegistrationFees = {
  effectiveFrom: "2024-08-01",

  /** One act — an acquisition paid in full, or a mortgage on its own. */
  singleAct: 375,
  /** More than one act — compra e venda com mútuo, i.e. every case here. */
  multipleActs: 700,
  /** Per additional prédio in the same process. */
  extraProperty: 50,

  /**
   * RERN art. 28.º n.º 40, as added by DL n.º 48-D/2024: "os emolumentos
   * devidos pelo procedimento são reduzidos em: a) € 225, se apenas for
   * registado um facto; b) € 450, se for registado mais do que um facto."
   *
   * N.º 41 halves both when only some of several buyers qualify. Not modelled:
   * the engine takes one household as a single borrower and has no per-buyer
   * breakdown to apply it to, so it would be inventing the input.
   */
  youngReduction: {
    singleAct: 225,
    multipleActs: 450,
  },

  source:
    "Casa Pronta — preçário do balcão único (Regulamento Emolumentar dos " +
    "Registos e Notariado, DL n.º 322-A/2001, art. 28.º); redução para jovens " +
    "até aos 35 anos nos termos do Decreto-Lei n.º 48-D/2024, de 31 de julho " +
    "(https://justica.gov.pt/Servicos/Casa-Pronta)",
  /**
   * A single published tariff has no second implementation to be checked
   * against, so Axis B does not exist here and this will not become `true`.
   * Said plainly rather than left as an unexplained `false`: the number is a
   * price list, not a computation, and the honest claim is "this is what the
   * service says it charges", which the citation already makes.
   */
  verified: false,
};
