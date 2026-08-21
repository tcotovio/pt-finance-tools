// IRS Jovem — 2026 parameters (CIRS art. 12.º-B, as amended by Lei n.º
// 45-A/2024).
//
// The regime exempts a share of employment income for the first 10 years of
// earning, tapering by year, capped at 55 × IAS of exempt income per year.
//
// At source the exemption is applied per payment: despacho 233-A/2026 §5.g
// caps the year's accumulated monthly exemptions at the annual limit
// "dividido por 14" — 12 salaries plus the two subsídios.

import type { IrsJovemRegime } from "../types.js";

export const IRS_JOVEM_2026: IrsJovemRegime = {
  year: 2026,
  effectiveFrom: "2026-01-01",
  /** Indexante dos Apoios Sociais, Portaria n.º 480-A/2025/1 de 30-12. */
  ias: 537.13,
  /** Annual exempt-income ceiling: 55 × IAS = 29 542,15 € for 2026. */
  capMultiplier: 55,
  /** Payments the annual ceiling is spread over at source (§5.g). */
  paymentsPerYear: 14,
  /**
   * Exempt share by year of earning, index 0 = first year (art. 12.º-B n.º 5):
   * 100 % year 1 · 75 % years 2–4 · 50 % years 5–7 · 25 % years 8–10.
   */
  exemptionByYear: [1, 0.75, 0.75, 0.75, 0.5, 0.5, 0.5, 0.25, 0.25, 0.25],
  // The URL leads with the consolidated CIRS because art. 12.º-B is what sets
  // the schedule and the cap; the despacho only says how they are applied at
  // source. Verified by rendering the page — dre.pt answers 200 for URLs that
  // then route to an error, so a status code proves nothing there.
  source:
    "CIRS art. 12.º-B (Lei n.º 45-A/2024) — https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2014-70048167 " +
    "· despacho 233-A/2026 §5.g · IAS 2026 = 537,13 € (Portaria n.º 480-A/2025/1)",
  verified: true,
};
