// Euribor as the DSTI rules want it.
//
// The index is not "today's Euribor": Instrução 23/2023 art. 1.º n.º 4 fixes
// it as the simple arithmetic mean of the daily quotes in the month *before*
// the solvency assessment. So the engine works in whole months, and a
// snapshot is only usable for assessments in the month after the one it
// covers.
//
// Fetching lives outside the engine — this file is pure, and the web app
// hands it whatever snapshot it managed to obtain.

import type { EuriborSnapshot, EuriborTenor } from "../types.js";

/** The `YYYY-MM` the Instrução points at for an assessment on `date`. */
export function referenceMonth(assessmentDate: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(assessmentDate);
  if (!match) {
    throw new Error(`assessmentDate must be ISO YYYY-MM-DD, got "${assessmentDate}".`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    throw new Error(`assessmentDate has an impossible month: "${assessmentDate}".`);
  }
  // January's previous month is December of the year before.
  const previous = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  return `${previousYear}-${String(previous).padStart(2, "0")}`;
}

/**
 * Whether a snapshot is the one the Instrução requires for this assessment.
 *
 * Deliberately strict — not "recent enough" but "the right month". A stale
 * snapshot still produces a usable estimate, which is why the engine reports
 * this rather than refusing; the UI says so instead of quietly pretending.
 */
export function isCurrentFor(
  snapshot: EuriborSnapshot,
  assessmentDate: string,
): boolean {
  return snapshot.month === referenceMonth(assessmentDate);
}

/** The rate for a tenor, as a fraction. */
export function euriborRate(
  snapshot: EuriborSnapshot,
  tenor: EuriborTenor,
): number {
  const rate = snapshot.rates[tenor];
  if (typeof rate !== "number" || !Number.isFinite(rate)) {
    throw new Error(`Snapshot for ${snapshot.month} has no ${tenor} rate.`);
  }
  return rate;
}

/**
 * The contract's nominal annual rate: indexante + spread.
 *
 * Banks quote the spread as a margin over the index, and the TAN is simply
 * their sum — no compounding, no conversion.
 */
export function contractRate(indexRate: number, spread: number): number {
  if (!Number.isFinite(indexRate) || indexRate < 0) {
    throw new Error("indexRate must not be negative.");
  }
  if (!Number.isFinite(spread) || spread < 0) {
    throw new Error("spread must not be negative.");
  }
  return indexRate + spread;
}
