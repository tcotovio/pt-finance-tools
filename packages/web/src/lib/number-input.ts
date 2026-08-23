// Grouping an amount while it is being typed.
//
// This form is mostly six- and seven-figure numbers, and an ungrouped 250000
// is genuinely hard to read back: the difference between 250 000 and 25 000 is
// one glyph in a run of identical ones, and the field gives no help finding it.
//
// Everything here is a pure string transform, deliberately. The caret
// arithmetic is the part of a self-formatting field that goes wrong — the
// cursor jumping to the end on every keystroke, backspace appearing to do
// nothing — and it is far easier to pin in a unit test than to catch by hand
// in a browser.

/**
 * A plain space, rather than the separator `toLocaleString("pt-PT")` returns.
 *
 * pt-PT groups with a non-breaking space, but *which* one — U+00A0 or the
 * narrow U+202F — depends on the ICU version the runtime was built against.
 * The arithmetic below counts characters, so a separator whose identity
 * changed between Node and the browser would let these tests pass against a
 * behaviour the user never sees.
 *
 * A plain space costs nothing here: an `<input>` does not wrap, so the reason
 * to reach for a non-breaking one does not apply, `parseAmount` already strips
 * it, and it matches the grouping the placeholders have always shown.
 * Formatted *output* still goes through `Intl` — this is for typing only.
 */
export const GROUP_SEPARATOR = " ";

/** What we are willing to reformat: digits, decimal separators, whitespace. */
const NUMERIC = /^[\d.,\s]*$/;

const SEPARATORS = /[\s]/g;

export interface CaretString {
  value: string;
  caret: number;
}

/**
 * Regroup `raw` and say where the caret should land.
 *
 * The caret is tracked by *counting the significant characters before it*
 * rather than by its offset: inserting a separator earlier in the string
 * shifts every offset after it, and following the count instead is what makes
 * typing into the middle of a number work.
 */
export function groupAmount(raw: string, caret: number): CaretString {
  // Anything that is not a plain amount is left exactly as typed. Silently
  // eating characters would hide the typo from the very field whose error
  // message exists to point at it.
  if (!NUMERIC.test(raw)) return { value: raw, caret };

  const significantBefore = strip(raw.slice(0, caret)).length;
  const bare = strip(raw);

  // Only the integer part groups. Splitting on the *first* separator, not the
  // last, keeps a half-typed "1 234," from being re-read as grouping.
  const decimal = bare.search(/[.,]/);
  const integer = decimal === -1 ? bare : bare.slice(0, decimal);
  const rest = decimal === -1 ? "" : bare.slice(decimal);

  const value = group(integer) + rest;
  return { value, caret: offsetAfter(value, significantBefore) };
}

/**
 * Backspace or Delete landing on a group separator.
 *
 * Left to the browser, the key deletes the separator, the formatter puts it
 * straight back, and the keystroke appears to have done nothing — the classic
 * annoyance of a self-formatting field. So the separator and the digit the key
 * was actually aiming at go together.
 *
 * Returns `null` when the caret is not against a separator, meaning the
 * browser's own handling is already right and must not be intercepted.
 */
export function deleteAcrossSeparator(
  value: string,
  caret: number,
  direction: "backward" | "forward",
): CaretString | null {
  const index = direction === "backward" ? caret - 1 : caret;
  if (value[index] !== GROUP_SEPARATOR) return null;

  const [from, to] =
    direction === "backward" ? [index - 1, index + 1] : [index, index + 2];
  if (from < 0 || to > value.length) return null;

  return groupAmount(value.slice(0, from) + value.slice(to), from);
}

function strip(text: string): string {
  return text.replace(SEPARATORS, "");
}

/** Three digits at a time, anchored on the right where the grouping is. */
function group(integer: string): string {
  let out = "";
  for (let end = integer.length; end > 0; end -= 3) {
    const chunk = integer.slice(Math.max(0, end - 3), end);
    out = out === "" ? chunk : `${chunk}${GROUP_SEPARATOR}${out}`;
  }
  return out;
}

/** The offset in `value` that sits just after `count` significant characters. */
function offsetAfter(value: string, count: number): number {
  let seen = 0;
  for (let index = 0; index < value.length; index++) {
    if (seen === count) return index;
    if (!/\s/.test(value.charAt(index))) seen++;
  }
  return value.length;
}
