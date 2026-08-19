// What Portuguese borrowers actually agreed to — the distribution of rates on
// new housing loans, restricted to VARIABLE-rate contracts.
//
// Source: Banco de Portugal, BPstat domain 186 "Crédito à habitação", the
// percentile series for "Taxa de juro de novas operações de empréstimos à
// habitação própria permanente contratada a taxa variável". These are compiled
// from what the banks themselves report to Banco de Portugal, so this is the
// authoritative channel rather than a market survey.
//
// WHY VARIABLE ONLY, AND WHY NOT A DERIVED SPREAD.
//
// The tempting move is to reverse-engineer the default spread as "observed
// rate − Euribor". Against an ALL-PRODUCTS average that is unsound: mid-2026
// lending is ~85 % taxa mista and ~2 % taxa fixa, both priced off swaps rather
// than Euribor, so the subtraction measures the product mix. Restricting to
// variable contracts removes that contamination — but not the second problem:
// a contract signed in June carries the Euribor fixing from when it was
// agreed, which in a rising market is lower than June's. So the implied spread
// still reads low (roughly 0,4 p.p. against 12M in June 2026, against retail
// spreads nearer 1 p.p.).
//
// So the distribution is shown BESIDE the user's own composed rate for them to
// judge, and no spread is derived from it. What the UI can say honestly is
// "half of variable-rate contracts came in below 3,19 %", which is a fact
// about the market rather than an inference about margins.
//
// Bundled rather than fetched live: this is context, not an input to any
// calculation, so it does not need to be current to the month the way the
// Euribor index legally does. Refresh it when the tax-year datasets are
// refreshed.

import type { MarketRateReference } from "../types.js";

export const MARKET_RATE_2026_06: MarketRateReference = {
  month: "2026-06",
  /** Annualised agreed rate (TAA), variable-rate new business, as fractions. */
  variableRate: {
    p10: 0.0265,
    median: 0.0319,
    p75: 0.0343,
    p90: 0.0366,
  },
  /**
   * Share of new lending by rate type, as fractions. Recorded because it is
   * the reason taxa mista is modelled at all — it is the market, not an edge
   * case.
   */
  shareOfNewLending: {
    mixed: 0.8539,
    variable: 0.1259,
    fixed: 0.0202,
  },
  source:
    "Banco de Portugal, BPstat domínio 186 (Crédito à habitação), percentis " +
    "da taxa de juro de novas operações a taxa variável " +
    "(https://bpstat.bportugal.pt/dominios/186)",
  retrievedAt: "2026-08-19",
};
