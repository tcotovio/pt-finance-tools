// Bundled Euribor fallback — July 2026 monthly averages.
//
// The app fetches live values from the ECB, but it is an offline-capable PWA
// with no backend, so it also has to work when the feed is unreachable: this
// snapshot ships in the bundle and is used when the network fails and nothing
// is cached. It is a *fallback*, not the source of truth — the UI always says
// which of the three it used and whether the month is the right one.
//
// Values are the ECB's own monthly averages for the three tenors Portuguese
// mortgages index to (series FM.M.U2.EUR.RT.MM.EURIBOR{3M,6M,1Y}D_.HSTA).
//
// A note on the equivalence, since the whole point is legal compliance:
// Instrução 23/2023 art. 1.º n.º 4 asks for the simple arithmetic mean of the
// month's daily quotes, and the ECB publishes exactly a monthly average of
// the daily series. They are taken to be the same figure. If the ECB ever
// switched to a weighted or business-day-adjusted average, this assumption
// would need re-checking — which is why it is written down here rather than
// left implicit.

import type { EuriborSnapshot } from "../types.js";

export const EURIBOR_2026_07: EuriborSnapshot = {
  month: "2026-07",
  rates: {
    "3m": 0.024253913,
    "6m": 0.026467391,
    "12m": 0.02855087,
  },
  source:
    "European Central Bank Data Portal, series FM.M.U2.EUR.RT.MM.EURIBOR*.HSTA " +
    "(https://data-api.ecb.europa.eu/service/data/FM/M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA)",
  retrievedAt: "2026-08-19",
};
