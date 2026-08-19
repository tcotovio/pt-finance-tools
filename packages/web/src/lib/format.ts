// Formatting and parsing of the numbers the user sees and types.
// Pure functions, no React — so they can be unit-tested on their own.

const EURO = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const PERCENT = new Intl.NumberFormat("pt-PT", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const PERCENT_WHOLE = new Intl.NumberFormat("pt-PT", {
  style: "percent",
  maximumFractionDigits: 0,
});

/** `1234.5` → `"1234,50 €"`. */
export function formatEuro(value: number): string {
  // -0 formats as "-0,00 €", which is never what a payslip line means.
  return EURO.format(value === 0 ? 0 : value);
}

/**
 * A deduction line: `126` → `"−126,00 €"` with a real minus sign. A nil
 * deduction is written plainly — "−0,00 €" reads as an error, not a zero.
 */
export function formatNegativeEuro(value: number): string {
  const amount = Math.abs(value);
  return amount === 0 ? formatEuro(0) : `−${formatEuro(amount)}`;
}

/** A credit line: `385.94` → `"+385,94 €"`. */
export function formatPositiveEuro(value: number): string {
  const amount = Math.abs(value);
  return amount === 0 ? formatEuro(0) : `+${formatEuro(amount)}`;
}

/** `0.0843` → `"8,4 %"`. */
export function formatPercent(fraction: number): string {
  return PERCENT.format(fraction);
}

/** `0.75` → `"75 %"` — for rates that are round by construction. */
export function formatWholePercent(fraction: number): string {
  return PERCENT_WHOLE.format(fraction);
}

const RATE = new Intl.NumberFormat("pt-PT", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/**
 * A statutory rate, shown to the precision the law states it: `0.2375` →
 * `"23,75 %"`, `0.11` → `"11 %"`. Rounding 23,75 % to 23,8 % would misquote
 * the Código Contributivo, so computed rates and legal rates get different
 * formatters.
 */
export function formatRate(fraction: number): string {
  return RATE.format(fraction);
}

/**
 * Parse an amount the way a Portuguese user types it, accepting both the
 * local `1.234,56` and the keyboard-convenient `1234.56`.
 *
 * The last separator is the decimal one, except for a lone `.` followed by
 * exactly three digits with no comma anywhere (`1.234`), which is the
 * thousands grouping. That heuristic reads `0.500` as 500 rather than 0,5 —
 * an acceptable trade for amounts that are salaries and daily allowances.
 *
 * Returns `null` for anything that is not a plain positive number, so the
 * caller can tell "empty/invalid" from a legitimate `0`.
 */
export function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[\s €]/g, "");
  if (cleaned === "") return null;
  if (!/^\d+([.,]\d+)*$/.test(cleaned)) return null;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const sep = Math.max(lastComma, lastDot);
  if (sep === -1) return Number(cleaned);

  const fraction = cleaned.slice(sep + 1);
  const grouping =
    cleaned[sep] === "." && lastComma === -1 && fraction.length === 3;

  const integer = grouping
    ? cleaned.replace(/[.,]/g, "")
    : cleaned.slice(0, sep).replace(/[.,]/g, "");

  const value = grouping ? Number(integer) : Number(`${integer}.${fraction}`);
  return Number.isFinite(value) ? value : null;
}

/** Today, as the ISO `YYYY-MM-DD` the engine keys its datasets by. */
export function todayIso(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  // Local date on purpose: `toISOString()` is UTC and would shift the day.
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** A piece of a provenance string: prose, or a URL to link. */
export interface TextSegment {
  text: string;
  isUrl: boolean;
}

/**
 * Split provenance text so its URL can be rendered as a link. Dataset
 * `source` strings are human-readable sentences with the official URL inside
 * them; printing that URL as inert text wastes the one thing a reader might
 * want to click.
 */
export function splitOnUrls(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const pattern = /https?:\/\/[^\s)]+/g;
  let index = 0;

  for (const match of text.matchAll(pattern)) {
    const start = match.index;
    if (start > index) {
      segments.push({ text: text.slice(index, start), isUrl: false });
    }
    segments.push({ text: match[0], isUrl: true });
    index = start + match[0].length;
  }
  if (index < text.length) {
    segments.push({ text: text.slice(index), isUrl: false });
  }
  return segments;
}
