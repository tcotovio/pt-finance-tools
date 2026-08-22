// What Portuguese consumer credit actually costs.
//
// Source: ECB MFI Interest Rate Statistics, series MIR.M.PT.B.A2B.A.R.A.2250
// .EUR.N — the annualised agreed rate on new consumer loans to households in
// Portugal, compiled from what the banks report to Banco de Portugal.
//
// UNLIKE THE MORTGAGE SPREAD, THIS ONE IS USABLE DIRECTLY. The spread could
// not be derived because a mortgage rate is an index plus a margin, and the
// published average mixed products priced off different things. Consumer
// credit is quoted and agreed as a single fixed rate, so the observed average
// IS the quantity the form needs — no subtraction, no inference, nothing to
// go wrong in the derivation.
//
// It seeds the form's default rate and is shown as context beside the user's
// own. It is not an input to any limit: the ceilings come from the
// Recomendação, not from what the market charges.

import type { ConsumerCreditMarket } from "../types.js";

export const CONSUMER_MARKET_2026_06: ConsumerCreditMarket = {
  month: "2026-06",
  /** Annualised agreed rate on new consumer credit, as a fraction. */
  averageRate: 0.0881,
  source:
    "European Central Bank, MFI Interest Rate Statistics, série " +
    "MIR.M.PT.B.A2B.A.R.A.2250.EUR.N — crédito aos consumidores, novas " +
    "operações, Portugal (https://data-api.ecb.europa.eu)",
  retrievedAt: "2026-08-22",
};
