// Garantia pessoal do Estado para a primeira habitação de jovens — Decreto-Lei
// n.º 44/2024, de 10 de julho, regulamentado pela Portaria n.º 236-A/2024/1,
// de 27 de setembro.
//
// The important modelling point, and the reason this is its own dataset rather
// than a field on BDP_2026: the guarantee is NOT a carve-out inside the
// Recomendação. Art. 5.º n.º 1 caps LTV at 90 % flat, with no proviso for a
// guaranteed loan — the extracted fixture text says so. Lending at 100 % is a
// justified DEVIATION from the recommendation, which institutions take one
// contract at a time and which Banco de Portugal counts as non-observance in
// its own monitoring. Writing `ltvLimit: 1.0` into the BdP dataset would erase
// that distinction and, worse, would put an unsourced number inside a dataset
// whose `verified: true` is a claim about the Recomendação's text.
//
// So the engine composes the two and reports which one produced the ceiling,
// and the UI can say "this exceeds what the Banco de Portugal recommends; it
// is possible because the State guarantees 15 %, and it is the bank's call".
//
// This is also the first dataset with an END date. The regime is time-limited,
// which the newest-effectiveFrom lookup used everywhere else cannot express —
// hence `effectiveOn` in ./index.ts.

import type { StateGuarantee } from "../types.js";

export const STATE_GUARANTEE_2024: StateGuarantee = {
  effectiveFrom: "2024-09-28",
  /**
   * The regime runs to the end of 2026. An assessment after that gets no
   * guarantee rather than a silently expired one.
   */
  effectiveTo: "2026-12-31",

  /** 18 to 35, inclusive. With two borrowers, both must qualify. */
  maxAge: 35,
  /** Portaria art. 3.º: the transaction value may not exceed this. */
  maxTransactionValue: 450_000,
  /** The guarantee is a fiança over capital, capped at 15 % of the transaction. */
  guaranteeShare: 0.15,
  /**
   * What the guarantee is designed to make possible — the bank financing the
   * whole transaction value. Note this is the *purpose* of the measure, not a
   * limit the measure itself sets: the State guarantees 15 % and the remaining
   * 85 % is ordinary secured lending.
   */
  maxLtv: 1.0,
  /** Portaria art. 6.º: the fiança lasts at most 10 years from the contract. */
  guaranteeYears: 10,

  source:
    "Decreto-Lei n.º 44/2024, de 10 de julho, e Portaria n.º 236-A/2024/1, de " +
    "27 de setembro (garantia pessoal do Estado na aquisição de primeira " +
    "habitação própria e permanente por jovens)",
  /**
   * `false` on Axis A alone, and it is the only axis this dataset can ever
   * have. Axis B cannot exist: the quantity modelled is a departure from the
   * Recomendação, so there is no independent implementation of "the rule" to
   * reproduce — only banks' individual credit decisions, which are not a
   * source. So when the Axis A fixture lands this becomes `"not-applicable"`,
   * NOT `true`: there will be nothing outstanding, and nothing further to do.
   *
   * Until then a result leaning on this dataset shows as unverified, which is
   * the correct reading — the numbers below have not been diffed against the
   * instrument, only read from it by hand.
   *
   * AMENDMENT CHECKED: Decreto-Lei n.º 24/2025, de 19 de março, amends DL
   * 44/2024 to extend the guarantee to sociedades financeiras alongside credit
   * institutions. It widens who may lend and touches none of the parameters
   * here — age, transaction ceiling, share, term. Recorded because the search
   * that finds this regime surfaces it prominently, and the next reader should
   * not have to re-establish that it is irrelevant to these fields. Noted from
   * the summary of the instrument, not from a diff of its text: it is part of
   * what the Axis A fixture should cover, not a substitute for it.
   */
  verified: false,
};
