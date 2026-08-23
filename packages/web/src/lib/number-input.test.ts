// The caret is the whole risk here. Grouping digits is trivial; keeping the
// cursor where the user left it while the string grows underneath it is not,
// and every one of these cases is a way a self-formatting field misbehaves in
// the wild.

import { describe, expect, it } from "vitest";
import { parseAmount } from "./format.js";
import {
  deleteAcrossSeparator,
  groupAmount,
  GROUP_SEPARATOR as S,
} from "./number-input.js";

/** Typing one character at `caret`, the way the browser reports it. */
const type = (value: string, caret: number, key: string) =>
  groupAmount(value.slice(0, caret) + key + value.slice(caret), caret + 1);

describe("groupAmount — the grouping itself", () => {
  it("groups from the right, in threes", () => {
    expect(groupAmount("250000", 6).value).toBe(`250${S}000`);
    expect(groupAmount("1234567", 7).value).toBe(`1${S}234${S}567`);
    expect(groupAmount("999", 3).value).toBe("999");
  });

  it("leaves the decimal part alone", () => {
    expect(groupAmount("250000,50", 9).value).toBe(`250${S}000,50`);
    // Four decimals must not pick up a separator of their own.
    expect(groupAmount("1000,1234", 9).value).toBe(`1${S}000,1234`);
  });

  it("splits on the first decimal separator, not the last", () => {
    // A half-typed "1234," must not be re-read as grouping when the user is
    // still on their way to "1234,5".
    expect(groupAmount("1234,", 5).value).toBe(`1${S}234,`);
  });

  it("is idempotent, since the field re-formats its own output", () => {
    const once = groupAmount("250000", 6).value;
    expect(groupAmount(once, once.length).value).toBe(once);
  });

  it("passes anything that is not an amount through untouched", () => {
    // The field's error message is what should point at a typo — not a
    // formatter that quietly deletes the offending character.
    expect(groupAmount("abc", 3)).toEqual({ value: "abc", caret: 3 });
    expect(groupAmount("25o000", 6).value).toBe("25o000");
  });

  it("handles an empty field", () => {
    expect(groupAmount("", 0)).toEqual({ value: "", caret: 0 });
  });
});

describe("groupAmount — where the caret lands", () => {
  it("keeps the caret at the end while typing a number out", () => {
    let state = { value: "", caret: 0 };
    for (const key of "250000") {
      state = type(state.value, state.caret, key);
    }
    expect(state.value).toBe(`250${S}000`);
    expect(state.caret).toBe(state.value.length);
  });

  it("keeps the caret against the digit typed into the middle", () => {
    // "250 000" with the caret after "250"; typing 1 must give "2 501 000"
    // with the caret still immediately after the 1, not at the end.
    const next = type(`250${S}000`, 3, "1");
    expect(next.value).toBe(`2${S}501${S}000`);
    expect(next.value.slice(0, next.caret)).toBe(`2${S}501`);
  });

  it("does not drift when a separator is inserted to the left of the caret", () => {
    // Going from 999 to 1 999 inserts a separator BEFORE the caret. Tracking
    // the offset rather than the digit count is what loses the cursor here.
    const next = type("999", 0, "1");
    expect(next.value).toBe(`1${S}999`);
    expect(next.value.slice(0, next.caret)).toBe("1");
  });

  it("normalises a caret parked on a separator to the digit before it", () => {
    // Offsets 3 and 4 straddle the separator and are the same place on
    // screen, so both have to resolve to the same caret — otherwise the
    // cursor appears to jump by one for no reason the user can see.
    for (const offset of [3, 4]) {
      const next = groupAmount(`250${S}000`, offset);
      expect(next.value).toBe(`250${S}000`);
      expect(next.caret).toBe(3);
    }
  });
});

describe("deleteAcrossSeparator", () => {
  it("takes the digit with the separator on backspace", () => {
    // Without this the separator is deleted, the formatter restores it, and
    // the key looks broken.
    const next = deleteAcrossSeparator(`250${S}000`, 4, "backward");
    expect(next?.value).toBe(`25${S}000`);
    expect(next?.value.slice(0, next.caret)).toBe("25");
  });

  it("takes the digit after the separator on delete", () => {
    const next = deleteAcrossSeparator(`250${S}000`, 3, "forward");
    expect(next?.value).toBe(`25${S}000`);
    expect(next?.value.slice(0, next?.caret).replace(/\s/g, "")).toBe("250");
  });

  it("stands aside when the caret is not against a separator", () => {
    // Returning null matters: it is what lets the browser do the ordinary
    // thing, which is already correct for an ordinary character.
    expect(deleteAcrossSeparator(`250${S}000`, 6, "backward")).toBeNull();
    expect(deleteAcrossSeparator("250", 3, "backward")).toBeNull();
  });

  it("stands aside at the edges rather than slicing past them", () => {
    expect(deleteAcrossSeparator(`${S}250`, 1, "backward")).toBeNull();
    expect(deleteAcrossSeparator(`250${S}`, 3, "forward")).toBeNull();
  });
});

describe("what the grouped text parses back to", () => {
  it("round-trips through parseAmount, which is the point of all this", () => {
    // The form stores what the field shows, so every grouped string has to
    // survive the parser the engine is fed from.
    expect(parseAmount(groupAmount("250000", 6).value)).toBe(250_000);
    expect(parseAmount(groupAmount("1234567,89", 10).value)).toBe(1_234_567.89);
    expect(parseAmount(groupAmount("0", 1).value)).toBe(0);
  });

  it("does not change the value the user meant, only how it reads", () => {
    for (const raw of ["1", "999", "1000", "250000", "1234567", "12,5"]) {
      expect(parseAmount(groupAmount(raw, raw.length).value)).toBe(
        parseAmount(raw),
      );
    }
  });
});
