// Average rate on new Portuguese mortgages — the reference figure shown
// beside the user's own composed rate.
//
// ECB MFI Interest Rate Statistics, series MIR.M.PT.B.A2C.A.R.A.2250.EUR.N:
// "annualised agreed rate" on new loans to households for house purchase in
// Portugal. Bundled as a fallback for the same reason as the Euribor
// snapshot — the app has to work offline — and superseded by a live fetch
// whenever one succeeds.
//
// NOT an input to any calculation. See MarketRateReference for why this is
// context rather than a derived spread.

import type { MarketRateReference } from "../types.js";

export const MARKET_RATE_2026_06: MarketRateReference = {
  month: "2026-06",
  averageRate: 0.0293,
  source:
    "European Central Bank, MFI Interest Rate Statistics, series " +
    "MIR.M.PT.B.A2C.A.R.A.2250.EUR.N (https://data-api.ecb.europa.eu)",
  retrievedAt: "2026-08-19",
};
