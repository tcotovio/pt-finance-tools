// When the publisher is expected to have something newer than what we ship.
//
// This is the part that needs no network. Every source we lean on publishes on
// a knowable rhythm — the ECB posts a month's Euribor average in the first days
// of the next month, INE releases a quarter's wage statistics about six weeks
// after it ends, the Orçamento do Estado's tax tables appear in the second half
// of December for the year starting in January — so "should something newer
// exist by now?" is answerable from a calendar and the vintage in the bundle.
//
// A probe (see `probes/`) can then confirm the calendar's guess against the
// publisher, and for the sources with a machine-readable feed it also brings
// back the values. But the calendar alone catches the failure that matters:
// nobody looked, for months, and nobody noticed.

import {
  addPeriods,
  daysBetween,
  periodEnd,
  periodOf,
  periodsBetween,
  type Period,
  type PeriodKind,
} from "./period.js";

/**
 * How a source publishes.
 *
 * `on-change` is the honest description of a legal instrument: a new one
 * arrives when the legislator decides, not on a cadence, so the only rule that
 * can be written down is how often a human should go and look.
 */
export type Schedule =
  | { kind: "periodic"; unit: PeriodKind; lagDays: number }
  | { kind: "annual"; nextEditionFrom: string }
  | { kind: "on-change"; reviewEveryDays: number };

/**
 * The newest edition the publisher should have out by `today`, or `null` for a
 * source with no calendar at all.
 *
 * `periodic` walks back from the period containing `today` until it finds one
 * whose publication lag has elapsed: in September, with a 45-day lag, the
 * second quarter is out and the third is not.
 *
 * `annual` is dated differently, because the edition is named for the year it
 * applies to rather than the one it is published in. `nextEditionFrom` is the
 * `MM-DD` in the *preceding* year from which the next edition should be
 * findable — mid-December for the OE tax tables — so this returns next year's
 * edition during that window, and it does so before January rather than after,
 * which is the whole point of the window.
 */
export function expectedLatest(schedule: Schedule, today: string): Period | null {
  if (schedule.kind === "on-change") return null;

  if (schedule.kind === "annual") {
    const year = Number(today.slice(0, 4));
    const window = `${year}-${schedule.nextEditionFrom}`;
    return String(today >= window ? year + 1 : year);
  }

  let candidate = periodOf(schedule.unit, today);
  // A dozen steps is far more than any real lag; the bound just stops a
  // malformed schedule from spinning.
  for (let i = 0; i < 12; i += 1) {
    if (daysBetween(periodEnd(candidate), today) >= schedule.lagDays) return candidate;
    candidate = addPeriods(candidate, -1);
  }
  return candidate;
}

/**
 * What the report says about one source.
 *
 *   * `current` — the edition we ship is the newest one that should exist.
 *   * `due` — something newer should be out there; go and get it.
 *   * `overdue` — we are past the point where shipping this is a defect
 *     rather than a lag: last year's tax tables in the new year, or a
 *     periodic dataset more than one edition behind.
 *   * `review-due` — a source with no calendar that nobody has looked at
 *     within its review interval.
 *   * `probe-failed` — the machine check errored. Reported, never silent, and
 *     never grounds for writing data.
 */
export type Status = "current" | "due" | "overdue" | "review-due" | "probe-failed";

/**
 * Compare what we ship against what should exist.
 *
 * `checkedOn` is when a human (or a green probe run) last confirmed this
 * source against its publisher, and it only decides the verdict for
 * `on-change` sources — for everything else the calendar is a stronger signal
 * than anyone's memory of having looked.
 */
export function statusFor(
  schedule: Schedule,
  shipped: Period,
  today: string,
  checkedOn: string,
): Status {
  if (schedule.kind === "on-change") {
    return daysBetween(checkedOn, today) > schedule.reviewEveryDays
      ? "review-due"
      : "current";
  }
  return compareEditions(schedule, shipped, expectedLatest(schedule, today), today);
}

/**
 * The verdict, given what we ship and what is believed to exist.
 *
 * Split out from {@link statusFor} because a probe answers the same question
 * from a stronger position — it asked the publisher — and its answer has to be
 * graded on the same scale rather than on a softened one.
 */
export function compareEditions(
  schedule: Schedule,
  shipped: Period,
  expected: Period | null,
  today: string,
): Status {
  if (expected === null || shipped >= expected) return "current";

  if (schedule.kind === "annual") {
    // Shipping a table the year after it stopped being the one in force is a
    // correctness bug, not a lag. Inside the December window it is only a
    // prompt: what we ship is still the law until the 1st of January.
    return shipped < today.slice(0, 4) ? "overdue" : "due";
  }

  return periodsBetween(shipped, expected) > 1 ? "overdue" : "due";
}

/** Whether a status should fail the scheduled run rather than just be listed. */
export function isActionable(status: Status): boolean {
  return status !== "current";
}
