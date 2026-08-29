// Combining the cross-check status of the datasets an answer leaned on.
//
// One function, because the rule it encodes was previously written out by hand
// at each call site as a chain of `&&` — and one of those chains was wrong in
// a way nobody could see. `purchaseCosts` ANDed in the Casa Pronta price list,
// which structurally can never be cross-checked, so every costed answer
// reported itself unverified no matter how much verification the tax datasets
// received. The bug was not the boolean; it was that "nothing to check" and
// "not checked yet" had the same representation.

import type { Verification } from "./types.js";

/**
 * Whether every dataset that *can* be cross-checked has been.
 *
 * Non-applicable entries drop out rather than voting, so an uncheckable source
 * can neither raise nor lower the claim. The empty case is `true` by vacuous
 * truth, which is the right reading: an answer resting only on published
 * tariffs has nothing outstanding against it.
 */
export function allCrossChecked(statuses: readonly Verification[]): boolean {
  return statuses.every((status) => status === "not-applicable" || status);
}

/**
 * Whether a status should be shown to the reader as a caveat.
 *
 * Only a literal `false` is. This is the predicate the UI wants: it asks "is
 * something outstanding here", not "is this verified", and those differ
 * precisely on the non-applicable case.
 */
export function isOutstanding(status: Verification): boolean {
  return status === false;
}
