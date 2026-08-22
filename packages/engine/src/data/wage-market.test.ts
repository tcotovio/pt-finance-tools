// The wage reference: three means, and the reasons the wrong one would
// mislead. These are properties of the dataset, not of any calculation — but
// picking the wrong figure here would be a presentation bug with real
// consequences, so they are pinned.

import { describe, expect, it } from "vitest";
import { WAGE_MARKET_2026_Q2 } from "./wage-market-2026-q2.js";

describe("WAGE_MARKET_2026_Q2", () => {
  const m = WAGE_MARKET_2026_Q2;

  it("orders the three means as their definitions require", () => {
    // base ⊂ regular ⊂ total: each adds components to the one before, so the
    // ordering is definitional, not empirical. A dataset that violated it
    // would mean the figures had been transcribed into the wrong fields.
    expect(m.baseMean).toBeLessThan(m.regularMean);
    expect(m.regularMean).toBeLessThan(m.totalMean);
  });

  it("compares base against base, which is what the calculator asks for", () => {
    // The number in the headlines is the total. Against someone's base salary
    // it would flatter every reader — here the gap is nearly 500 €.
    expect(m.totalMean - m.baseMean).toBeGreaterThan(400);
  });

  it("carries a plausible Portuguese base salary", () => {
    // Above the minimum wage, below any plausible average.
    expect(m.baseMean).toBeGreaterThan(900);
    expect(m.baseMean).toBeLessThan(2500);
  });

  it("cites INE, with a link", () => {
    expect(m.source).toContain("INE");
    expect(m.source).toContain("ine.pt");
  });

  it("names the quarter it describes", () => {
    // The total is seasonal — the Christmas subsidy lifts Q4 far above the
    // rest — so a figure without its period is not interpretable.
    expect(m.period).toMatch(/^\d{4}-Q[1-4]$/);
  });
});
