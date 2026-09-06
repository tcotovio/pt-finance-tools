// Periods, and arithmetic on them.
//
// Datasets are versioned in three different units — a month for the Euribor
// snapshot and the market statistics, a quarter for the wage reference, a
// calendar year for everything the Orçamento do Estado re-indexes — and the
// freshness question is the same in all three: is the edition we ship still
// the newest one that exists?
//
// Every period label sorts correctly as a string ("2026-07" < "2026-08",
// "2026-Q1" < "2026-Q2", "2025" < "2026"), which is the same property
// `data/index.ts` leans on for effective dates. So comparison here is string
// comparison, and the only real work is stepping between periods and knowing
// when one ends.

/** The unit a dataset is versioned in. */
export type PeriodKind = "month" | "quarter" | "year";

/** `YYYY-MM`, `YYYY-Qn` or `YYYY` — see {@link PeriodKind}. */
export type Period = string;

const MONTH = /^(\d{4})-(\d{2})$/;
const QUARTER = /^(\d{4})-Q([1-4])$/;
const YEAR = /^(\d{4})$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Which unit a label is in, or `null` if it is not a period at all. */
export function periodKind(period: Period): PeriodKind | null {
  if (MONTH.test(period)) return "month";
  if (QUARTER.test(period)) return "quarter";
  if (YEAR.test(period)) return "year";
  return null;
}

/**
 * A UTC date, built from parts.
 *
 * UTC throughout: a runner in America/Los_Angeles and one in Europe/Lisbon
 * must reach the same verdict about whether July's average has been published,
 * and a local-time `Date` would not guarantee that.
 */
function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

/** `YYYY-MM-DD` for a date. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Parse `YYYY-MM-DD`. Throws rather than silently producing an Invalid Date. */
export function parseIso(date: string): Date {
  const match = ISO_DATE.exec(date);
  if (!match) throw new Error(`Expected an ISO YYYY-MM-DD date, got "${date}".`);
  return utc(Number(match[1]), Number(match[2]), Number(match[3]));
}

/** `date` shifted by `days`, which may be negative. */
export function addDays(date: string, days: number): string {
  const shifted = parseIso(date);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return isoDate(shifted);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const ms = parseIso(to).getTime() - parseIso(from).getTime();
  return Math.round(ms / 86_400_000);
}

/** The month a date falls in: `2026-09-06` → `2026-09`. */
export function monthOf(date: string): Period {
  return date.slice(0, 7);
}

/** The quarter a date falls in: `2026-09-06` → `2026-Q3`. */
export function quarterOf(date: string): Period {
  const parsed = parseIso(date);
  const quarter = Math.floor(parsed.getUTCMonth() / 3) + 1;
  return `${parsed.getUTCFullYear()}-Q${quarter}`;
}

/** The year a date falls in: `2026-09-06` → `2026`. */
export function yearOf(date: string): Period {
  return date.slice(0, 4);
}

/** The period of the given kind that `date` falls in. */
export function periodOf(kind: PeriodKind, date: string): Period {
  if (kind === "month") return monthOf(date);
  if (kind === "quarter") return quarterOf(date);
  return yearOf(date);
}

/** `period` stepped by `count` units, which may be negative. */
export function addPeriods(period: Period, count: number): Period {
  const month = MONTH.exec(period);
  if (month) {
    const total = Number(month[1]) * 12 + (Number(month[2]) - 1) + count;
    const year = Math.floor(total / 12);
    return `${year}-${String((total % 12) + 1).padStart(2, "0")}`;
  }

  const quarter = QUARTER.exec(period);
  if (quarter) {
    const total = Number(quarter[1]) * 4 + (Number(quarter[2]) - 1) + count;
    return `${Math.floor(total / 4)}-Q${(total % 4) + 1}`;
  }

  const year = YEAR.exec(period);
  if (year) return String(Number(year[1]) + count);

  throw new Error(`Not a period: "${period}".`);
}

/** The last day of `period`, as `YYYY-MM-DD`. */
export function periodEnd(period: Period): string {
  const month = MONTH.exec(period);
  if (month) {
    // Day 0 of the next month is the last day of this one, leap years included.
    return isoDate(utc(Number(month[1]), Number(month[2]) + 1, 0));
  }

  const quarter = QUARTER.exec(period);
  if (quarter) {
    return isoDate(utc(Number(quarter[1]), Number(quarter[2]) * 3 + 1, 0));
  }

  const year = YEAR.exec(period);
  if (year) return `${year[1]}-12-31`;

  throw new Error(`Not a period: "${period}".`);
}

/**
 * How many periods separate two labels of the same kind — `2026-09` is 2 ahead
 * of `2026-07`. Throws when the kinds differ, since the answer would be
 * meaningless.
 */
export function periodsBetween(from: Period, to: Period): number {
  const kind = periodKind(from);
  if (kind === null || kind !== periodKind(to)) {
    throw new Error(`Cannot measure "${from}" against "${to}".`);
  }
  // Small ranges only (a dataset is never centuries behind), so stepping is
  // clearer than three unit-specific formulas.
  let steps = 0;
  let cursor = from;
  const forward = from < to;
  while (cursor !== to && Math.abs(steps) < 1200) {
    cursor = addPeriods(cursor, forward ? 1 : -1);
    steps += forward ? 1 : -1;
  }
  return steps;
}
