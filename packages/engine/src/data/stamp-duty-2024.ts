// Imposto do Selo — the verbas of the Tabela Geral that a house purchase and
// its mortgage touch, plus the young-buyer deduction of CIS art. 7.º-A.
//
// Dated 1 August 2024 rather than to a tax year, because that is when the last
// thing here changed: DL n.º 48-A/2024, de 25 de julho, inserted art. 7.º-A.
// The rates themselves are older still. This is exactly why the selo does not
// share a file with the IMT brackets, which re-index every January — a dataset
// whose effective date is a fiction cannot be reasoned about.
//
// On the interest verba: 17.3.1 charges 4 % on juros, and for the mortgage
// this calculator computes it is not payable at all. CIS art. 7.º n.º 1 al. l)
// exempts the interest on credit for aquisição, construção, reconstrução ou
// melhoramento de habitação própria. That is a derivation, not an omission,
// which is why the rate is carried here rather than left out: the engine has
// to be able to say *why* the line is zero, and to charge it in the cases
// where the exemption does not reach.

import type { StampDuty } from "../types.js";

export const STAMP_DUTY_2024: StampDuty = {
  effectiveFrom: "2024-08-01",

  /**
   * Verba 1.1: "Aquisição onerosa ou por doação do direito de propriedade ou
   * de figuras parcelares desse direito sobre imóveis — sobre o valor: 0,8 %".
   *
   * The base is the same as IMT's — CIMT art. 12.º, so the greater of the
   * price and the VPT.
   */
  transfer: 0.008,

  /** Verba 17.1 — "Utilização de crédito", by the contract's term. */
  credit: {
    /** 17.1.1 — prazo inferior a um ano, por cada mês ou fração. */
    underOneYearPerMonth: 0.0004,
    /** 17.1.2 — prazo igual ou superior a um ano. */
    oneYearOrMore: 0.005,
    /** 17.1.3 — prazo igual ou superior a cinco anos. */
    fiveYearsOrMore: 0.006,
  },

  /**
   * Verba 17.3.1 — juros. Charged on the interest of credit that is not for
   * own housing; exempt under art. 7.º n.º 1 al. l) when it is.
   */
  interest: 0.04,

  source:
    "Código do Imposto do Selo, Tabela Geral (verbas 1.1 e 17), art. 7.º n.º 1 " +
    "al. l) e art. 7.º-A (aditado pelo Decreto-Lei n.º 48-A/2024, de 25 de julho) " +
    "(https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/selo/Pages/ccod-selo-tabgiselo.aspx)",
  /**
   * Neither axis, and the reason is worth stating rather than leaving to be
   * inferred: there is nothing here to cross-check. Three flat rates and one
   * deduction defined by reference to a bracket that lives in `IMT_2026` —
   * Axis A has no table to diff and Axis B has no independent implementation
   * that publishes the selo separately from the IMT. It rides on the IMT
   * dataset's verification when the AT simulator lands, since that source
   * returns both.
   */
  verified: false,
};
