// Retenção na fonte on a categoria B invoice.

import { describe, expect, it } from "vitest";
import { CIRS_RETENTION_2026 as PARAMS } from "../data/cirs-retention-2026.js";
import { retentionOnInvoice } from "./retention.js";

describe("retentionOnInvoice", () => {
  it("withholds 23 % on the professional activities of the tabela do art. 151.º", () => {
    const r = retentionOnInvoice(2000, "professional", PARAMS);
    expect(r.rate).toBe(0.23);
    expect(r.amount).toBeCloseTo(460, 2);
    expect(r.dispensed).toBe(false);
  });

  // The correction the statute forced during scoping: this rate was 25 % until
  // the OE 2024 lowered it, every secondary source consulted still said 25 %,
  // and 25 % does still appear in art. 101.º — as the categoria F rate. A test
  // rather than a comment, because the wrong figure is the plausible one.
  it("is 23 %, not the 25 % that art. 101.º charges on categoria F", () => {
    expect(PARAMS.rates.professional).toBe(0.23);
    expect(PARAMS.rates.professional).not.toBe(0.25);
  });

  it("withholds 11,5 % on the residual categoria B", () => {
    const r = retentionOnInvoice(2000, "other-services", PARAMS);
    expect(r.amount).toBeCloseTo(230, 2);
  });

  it("withholds 16,5 % on propriedade intelectual", () => {
    const r = retentionOnInvoice(2000, "intellectual-property", PARAMS);
    expect(r.amount).toBeCloseTo(330, 2);
  });

  describe("the three routes to zero, which are not interchangeable", () => {
    it("names the annual threshold when the worker invoked the dispensa", () => {
      const r = retentionOnInvoice(2000, "professional", PARAMS, {
        dispensed: true,
      });
      expect(r.amount).toBe(0);
      expect(r.dispensaReason).toBe("annual-threshold");
      // The rate is still reported: the UI has to be able to say what would
      // have been withheld, and a zeroed rate would make the dispensa
      // invisible rather than explained.
      expect(r.rate).toBe(0.23);
    });

    it("names the client when the payer has no contabilidade organizada", () => {
      const r = retentionOnInvoice(2000, "professional", PARAMS, {
        clientDoesNotWithhold: true,
      });
      expect(r.dispensaReason).toBe("client");
    });

    // Art. 101.º n.º 1 only ever binds an entity with organised accounts, so
    // for anyone else there is no obligation left for art. 101.º-B to
    // dispense. Observable: both flags set must report the client, not the
    // threshold.
    it("reports the client first when both would apply", () => {
      const r = retentionOnInvoice(2000, "professional", PARAMS, {
        dispensed: true,
        clientDoesNotWithhold: true,
      });
      expect(r.dispensaReason).toBe("client");
    });

    it("names the minimum below 25 € of tax (art. 101.º-B n.º 1 al. d)", () => {
      // 100 € at 23 % is 23 €, under the floor.
      const r = retentionOnInvoice(100, "professional", PARAMS);
      expect(r.amount).toBe(0);
      expect(r.dispensaReason).toBe("below-minimum");
    });

    it("withholds once the tax reaches the minimum", () => {
      // 108,70 € at 23 % is 25,00 €, exactly at the floor, so it is due.
      const r = retentionOnInvoice(108.7, "professional", PARAMS);
      expect(r.amount).toBeCloseTo(25.0, 2);
      expect(r.dispensed).toBe(false);
    });

    // The floor is per invoice and applies to the tax, not the invoice, so
    // where it bites depends on the rate. Pinned because it is the kind of
    // detail a later "simplification" to a single income threshold would lose.
    it("bites at a different invoice value for each rate", () => {
      const atProfessional = retentionOnInvoice(150, "professional", PARAMS);
      const atResidual = retentionOnInvoice(150, "other-services", PARAMS);
      expect(atProfessional.dispensed).toBe(false); // 34,50 €
      expect(atResidual.dispensed).toBe(true); // 17,25 €
    });
  });
});
