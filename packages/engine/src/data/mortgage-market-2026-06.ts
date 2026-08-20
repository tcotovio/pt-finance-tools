// The Portuguese mortgage market as Banco de Portugal's own statistics
// describe it — compiled from what the banks report to BdP, which is the
// authoritative channel rather than a survey or a comparison site.
//
// Source: BPstat domain 186, "Crédito à habitação". Every figure below is the
// June 2026 observation of a published series.
//
// NOT an input to any calculation. Everything here is context shown beside the
// user's own number, so that "920 € a month" or "3,86 %" can be read against
// what other people actually have. The engine never computes with it.
//
// WHY NOT DERIVE A SPREAD FROM IT. The obvious move is "observed rate minus
// Euribor". Against an all-products average that is unsound, because ~85 % of
// lending is taxa mista and ~2 % taxa fixa, both priced off swaps rather than
// Euribor — the subtraction would measure the product mix. Restricting to
// variable contracts removes that, but not the signature lag: a June contract
// carries the Euribor fixing from when it was agreed, below June's in a rising
// market. The implied margin still reads ~0,4 p.p. against retail spreads
// nearer 1 p.p. So no spread is derived; the distribution is shown and the
// judgement is left to the reader.
//
// Bundled rather than fetched: context, not an input, so unlike the Euribor
// index nothing legally requires it to be current. Refresh it with the
// tax-year datasets.

import type { MortgageMarket } from "../types.js";

export const MORTGAGE_MARKET_2026_06: MortgageMarket = {
  month: "2026-06",

  /**
   * Annualised agreed rate (TAA) on NEW business, by rate type, as fractions.
   *
   * Taxa mista has no published percentiles — only its share — which is why
   * the UI says so rather than substituting a neighbouring series. It is also
   * the awkward gap in this data: the dominant product is the one whose price
   * distribution BdP does not publish.
   */
  newBusinessRate: {
    variable: { p10: 0.0265, median: 0.0319, p75: 0.0343, p90: 0.0366 },
    fixed: {
      p10: 0.0293,
      p25: 0.0348,
      median: 0.0397,
      p75: 0.0418,
      p90: 0.0442,
    },
  },

  /**
   * Monthly instalment on the STOCK of outstanding loans for habitação própria
   * permanente, in euros.
   *
   * The stock, not new lending — every vintage still being repaid, most agreed
   * years ago at smaller amounts. A loan signed today sits high against it by
   * construction, and the UI has to say so or the comparison misleads.
   */
  instalmentStock: {
    p10: 156,
    p25: 242,
    median: 351,
    p75: 540,
    p90: 789,
  },

  /** Share of new lending by rate type, as fractions. */
  shareOfNewLending: {
    mixed: 0.8539,
    variable: 0.1259,
    fixed: 0.0202,
  },

  /**
   * Share of new variable-rate lending by index, as fractions. Euribor 6M is
   * the market's usual choice — worth knowing when picking a tenor, since the
   * shortest index is not the most common one.
   */
  indexShareOfNewBusiness: {
    "3m": 0.1077,
    "6m": 0.4942,
    "12m": 0.3338,
    other: 0.0644,
  },

  source:
    "Banco de Portugal, BPstat domínio 186 (Crédito à habitação) — séries de " +
    "percentis da taxa de juro de novas operações, prestação mensal do stock e " +
    "repartição por indexante (https://bpstat.bportugal.pt/dominios/186)",
  retrievedAt: "2026-08-20",
};
