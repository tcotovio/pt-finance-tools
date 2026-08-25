// Axis B: the engine end to end against three INDEPENDENT implementations.
//
// external-crosscheck.test.ts reproduces the ISS's own worked examples, which
// is strong on the rules but shares a document with the parameters it
// exercises. These are other people's code. See the fixture for what they do
// and do not reach — the coverage gaps are the reason several rules remain
// Axis A only, and the reason the datasets say so in their own comments.

import { describe, expect, it } from "vitest";
import fixture from "./fixtures/third-party-2026.json" with { type: "json" };
import { selfEmployedNet } from "./net.js";
import type { SelfEmployedInput } from "../types.js";

const REFERENCE_DATE = "2026-08-24";

const BASE: SelfEmployedInput = {
  monthlyInvoicing: 0,
  activity: "services",
  retentionCategory: "professional",
  referenceDate: REFERENCE_DATE,
};

const sourceName = (id: string) =>
  fixture.sources.find((s) => s.id === id)?.name ?? id;

describe("engine vs independent categoria B simulators", () => {
  for (const s of fixture.scenarios) {
    it(`${sourceName(s.source)} — ${s.note}`, () => {
      const result = selfEmployedNet({
        ...BASE,
        monthlyInvoicing: s.monthlyInvoicing,
        ...(s.quarter
          ? { quarter: s.quarter as [number, number, number] }
          : {}),
        ...(s.chargesVat ? { chargesVat: true } : {}),
        ...(s.firstActivityDeferral ? { firstActivityDeferral: true } : {}),
      });

      if (s.quarterlyContribution !== undefined) {
        // The one source that reasons about the whole period. Its figures are
        // the quarter's, so they are compared against three months of this
        // engine's monthly answer — which is exactly what the 1/3 means.
        expect(result.retention.amount * 3).toBeCloseTo(
          s.quarterlyRetention as number,
          1,
        );
        expect(result.contribution.amount * 3).toBeCloseTo(
          s.quarterlyContribution,
          1,
        );
        expect(result.net * 3).toBeCloseTo(s.quarterlyNet as number, 1);
        return;
      }

      expect(result.retention.amount).toBeCloseTo(s.retention as number, 2);
      expect(result.contribution.amount).toBeCloseTo(s.contribution as number, 2);
      expect(result.net).toBeCloseTo(s.net as number, 2);

      if (s.vat !== undefined) {
        expect(result.vat.amount).toBeCloseTo(s.vat, 2);
        // Every source treats IVA as a pass-through: collected and remitted,
        // never part of the take-home. Asserted rather than assumed, because
        // the whole IVA section of the panel is built on it.
        expect(result.net).toBeCloseTo(s.net as number, 2);
        expect(result.vat.invoiceTotal).toBeCloseTo(
          s.monthlyInvoicing + s.vat,
          2,
        );
      }
    });
  }

  // Three implementations, one scenario, same answer. Worth its own assertion:
  // the fixture's provenance is weaker than the wage and loan sides', and
  // mutual agreement is what compensates for that.
  it("has two sources agreeing independently on the 1 000 € case", () => {
    const agreeing = fixture.scenarios.filter(
      (s) => s.monthlyInvoicing === 1000,
    );
    expect(agreeing).toHaveLength(2);
    expect(new Set(agreeing.map((s) => s.source)).size).toBe(2);
    expect(new Set(agreeing.map((s) => s.net)).size).toBe(1);
  });
});
