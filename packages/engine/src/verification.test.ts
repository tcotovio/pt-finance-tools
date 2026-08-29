// The rule that "nothing to check" and "not checked yet" are different things.
//
// Worth its own file because the distinction is invisible at the call sites
// that consume it — they just see a boolean — and getting it wrong is silent:
// the old `&&` chain produced a perfectly plausible `false` that no test
// caught for as long as it existed.

import { describe, expect, it } from "vitest";
import { allCrossChecked, isOutstanding } from "./verification.js";

describe("allCrossChecked", () => {
  it("passes when every applicable dataset has been checked", () => {
    expect(allCrossChecked([true, true])).toBe(true);
  });

  it("fails on a single outstanding dataset", () => {
    expect(allCrossChecked([true, false, true])).toBe(false);
  });

  it("lets a non-applicable source drop out rather than vote", () => {
    // The regression. A price list must not be able to hold down an answer
    // whose every computed figure comes from a verified dataset.
    expect(allCrossChecked([true, "not-applicable"])).toBe(true);
  });

  it("does not let a non-applicable source rescue an outstanding one", () => {
    // The converse error, and the reason "not-applicable" is excluded rather
    // than coerced to true: it must be inert in both directions.
    expect(allCrossChecked([false, "not-applicable"])).toBe(false);
  });

  it("treats an answer resting only on uncheckable sources as clear", () => {
    // Vacuous truth, and correct: there is no outstanding work to report.
    expect(allCrossChecked(["not-applicable", "not-applicable"])).toBe(true);
    expect(allCrossChecked([])).toBe(true);
  });
});

describe("isOutstanding", () => {
  it("flags only a literal false", () => {
    expect(isOutstanding(false)).toBe(true);
    expect(isOutstanding(true)).toBe(false);
    // The whole point: this is not a caveat, so it must not render as one.
    expect(isOutstanding("not-applicable")).toBe(false);
  });
});
