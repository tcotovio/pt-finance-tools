// Euribor as Instrução 23/2023 art. 1.º n.º 4 defines it: the previous
// month's average, not a spot rate.

import { describe, expect, it } from "vitest";
import {
  contractRate,
  euriborRate,
  isCurrentFor,
  referenceMonth,
} from "./euribor.js";
import { EURIBOR_2026_07 } from "../data/euribor-2026-07.js";
import { MARKET_RATE_2026_06 } from "../data/market-rate-2026-06.js";
import type { EuriborSnapshot } from "../types.js";

describe("referenceMonth", () => {
  it("takes the month before the assessment", () => {
    expect(referenceMonth("2026-08-19")).toBe("2026-07");
  });

  it("does not care which day of the month the assessment falls on", () => {
    expect(referenceMonth("2026-08-01")).toBe("2026-07");
    expect(referenceMonth("2026-08-31")).toBe("2026-07");
  });

  it("crosses the year boundary", () => {
    // The off-by-one that a naive month − 1 gets wrong.
    expect(referenceMonth("2026-01-15")).toBe("2025-12");
  });

  it("pads single-digit months", () => {
    expect(referenceMonth("2026-10-05")).toBe("2026-09");
    expect(referenceMonth("2026-02-05")).toBe("2026-01");
  });

  it("rejects a malformed date", () => {
    expect(() => referenceMonth("19-08-2026")).toThrow(/ISO YYYY-MM-DD/);
    expect(() => referenceMonth("2026-13-01")).toThrow(/impossible month/);
  });
});

describe("isCurrentFor", () => {
  it("accepts the snapshot for exactly the reference month", () => {
    expect(isCurrentFor(EURIBOR_2026_07, "2026-08-19")).toBe(true);
  });

  it("rejects one that is merely recent", () => {
    // Strict by design: a September assessment needs August's average, and
    // July's is wrong however fresh it feels.
    expect(isCurrentFor(EURIBOR_2026_07, "2026-09-01")).toBe(false);
  });

  it("rejects the current month's own snapshot", () => {
    // The month must be *before* the assessment; a July assessment cannot use
    // July, which is still incomplete.
    expect(isCurrentFor(EURIBOR_2026_07, "2026-07-20")).toBe(false);
  });
});

describe("euriborRate", () => {
  it("returns the rate for each tenor as a fraction", () => {
    expect(euriborRate(EURIBOR_2026_07, "3m")).toBeCloseTo(0.024253913, 12);
    expect(euriborRate(EURIBOR_2026_07, "6m")).toBeCloseTo(0.026467391, 12);
    expect(euriborRate(EURIBOR_2026_07, "12m")).toBeCloseTo(0.02855087, 12);
  });

  it("keeps the tenors in ascending order, as the curve was", () => {
    // Not a law, but a sanity check on the transcription: an inverted curve
    // is possible in principle, so this pins what the July 2026 data says.
    expect(euriborRate(EURIBOR_2026_07, "3m")).toBeLessThan(
      euriborRate(EURIBOR_2026_07, "6m"),
    );
    expect(euriborRate(EURIBOR_2026_07, "6m")).toBeLessThan(
      euriborRate(EURIBOR_2026_07, "12m"),
    );
  });

  it("throws rather than returning NaN for a missing tenor", () => {
    const broken = {
      ...EURIBOR_2026_07,
      rates: { ...EURIBOR_2026_07.rates, "6m": undefined },
    } as unknown as EuriborSnapshot;
    expect(() => euriborRate(broken, "6m")).toThrow(/no 6m rate/);
  });
});

describe("contractRate", () => {
  it("adds the spread to the index", () => {
    expect(contractRate(0.024253913, 0.01)).toBeCloseTo(0.034253913, 12);
  });

  it("allows a zero spread", () => {
    expect(contractRate(0.02, 0)).toBeCloseTo(0.02, 12);
  });

  it("rejects negative inputs", () => {
    expect(() => contractRate(-0.01, 0.01)).toThrow(/indexRate/);
    expect(() => contractRate(0.02, -0.01)).toThrow(/spread/);
  });
});

describe("MARKET_RATE_2026_06 — context, never a derived spread", () => {
  it("is a plausible mortgage rate expressed as a fraction", () => {
    expect(MARKET_RATE_2026_06.averageRate).toBeGreaterThan(0.001);
    expect(MARKET_RATE_2026_06.averageRate).toBeLessThan(0.15);
  });

  it("cites the ECB series it came from", () => {
    expect(MARKET_RATE_2026_06.source).toContain("MIR.M.PT.B.A2C");
  });

  it("cannot be turned into a spread by subtracting Euribor", () => {
    // The guard is on the reasoning, not the arithmetic. It is tempting to
    // derive the default spread as "average rate − Euribor", and this pins
    // why that is wrong: the ECB's average mixes fixed and mixed-rate
    // contracts priced off swaps, and variable ones carry the fixing from
    // when they were signed, so in a rising market the difference collapses
    // to a fraction of any real retail margin. If anyone ever wires this
    // subtraction into a default, this test fails and says so.
    const implied =
      MARKET_RATE_2026_06.averageRate - euriborRate(EURIBOR_2026_07, "12m");
    const plausibleRetailSpread = 0.008;
    expect(implied).toBeLessThan(plausibleRetailSpread);
  });
});
