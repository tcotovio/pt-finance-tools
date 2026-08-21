// Subsídio de alimentação — 2026 exemption limits.
//
// The daily amount is exempt from IRS and from Segurança Social up to a
// per-day ceiling that differs by payment method; only the excess is taxed
// (and contributed on). Legal basis: CIRS art. 2.º n.º 3 al. b) 2) and the
// Código Contributivo, with the annual values set for 2026.
//
// VERIFICATION: both ceilings were confirmed to the cent against the Doutor
// Finanças 2026 simulator — paying exactly the ceiling leaves the Segurança
// Social base untouched, and paying above it moves the base by precisely the
// excess (see wage/external-crosscheck.test.ts). Note this pins the *values*
// empirically; unlike CONTINENTE_2026, they have not been read from the
// primary legal text.

import type { MealAllowanceLimits } from "../types.js";

export const MEAL_ALLOWANCE_2026: MealAllowanceLimits = {
  year: 2026,
  effectiveFrom: "2026-01-01",
  perDay: {
    /** Paid by meal card / vouchers (cartão ou vales de refeição). */
    card: 10.46,
    /** Paid in cash as part of the salary (em dinheiro). */
    cash: 6.15,
  },
  // Leads with the instrument that sets the exemption, not the simulator the
  // values were cross-checked against — a reader following the link wants the
  // rule, and the cross-check is named after it.
  source:
    "CIRS art. 2.º n.º 3 b) 2), valores de 2026 — https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2014-70048167 " +
    "· confrontado com o simulador do Doutor Finanças 2026",
  verified: true,
};
