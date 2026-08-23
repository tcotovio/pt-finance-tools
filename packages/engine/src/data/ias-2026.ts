// Indexante dos Apoios Sociais — 2026.
//
// Its own dataset rather than a field on a regime, because it is its own
// instrument on its own cycle: a portaria fixes it each December, and three
// unrelated regimes then read it. IRS Jovem caps exempt income at 55 × IAS
// (CIRS art. 12.º-B); the self-employed contribution base is capped at 12 × IAS
// and the accumulation threshold sits at 4 × IAS (Código Contributivo).
//
// IRS_JOVEM_2026 still carries its own `ias` field, which predates this file.
// `ias-2026.test.ts` pins the two equal so they cannot drift apart; folding
// that field into a reference here is a follow-up, and would touch a dataset
// that is currently `verified: true`.

import type { IasValue } from "../types.js";

export const IAS_2026: IasValue = {
  year: 2026,
  effectiveFrom: "2026-01-01",
  value: 537.13,
  source:
    "Portaria n.º 480-A/2025/1, de 30-12 — https://diariodarepublica.pt/dr/detalhe/portaria/480-a-2025-1",
  // Axis A is a single figure from a single portaria. Axis B is met at one
  // remove and genuinely: this same value sits in IRS_JOVEM_2026, whose
  // 55 × IAS cap was exercised end to end against the IRS Jovem simulator in
  // two scenarios where the cap actually bit — an independent implementation
  // could not have matched to the cent on a different IAS.
  verified: true,
};
