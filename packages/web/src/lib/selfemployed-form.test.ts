import { describe, expect, it } from "vitest";
import {
  ACTIVITY_PRESETS,
  DEFAULT_SELF_EMPLOYED_FORM as DEFAULTS,
  toSelfEmployedInput,
  validateSelfEmployedForm,
  type SelfEmployedForm,
} from "./selfemployed-form.js";

const DATE = "2026-08-23";
const form = (over: Partial<SelfEmployedForm> = {}): SelfEmployedForm => ({
  ...DEFAULTS,
  ...over,
});

describe("ACTIVITY_PRESETS", () => {
  // The whole reason the presets exist: one question the user can answer,
  // mapping onto two statutes that ask different things. Pinned so a later
  // tidy-up cannot collapse them into one field.
  it("maps a preset onto both the retention rate and the coefficient", () => {
    expect(ACTIVITY_PRESETS["professional-services"]).toMatchObject({
      activity: "services",
      retentionCategory: "professional",
    });
    expect(ACTIVITY_PRESETS["other-services"]).toMatchObject({
      activity: "services",
      retentionCategory: "other-services",
    });
  });

  // Hospitality and goods share a coefficient but are not the same preset:
  // they are different activities and the label has to say which, because a
  // restaurant reading "produção e venda de bens" would reasonably not pick it.
  it("keeps hospitality distinct from goods despite the shared coefficient", () => {
    expect(ACTIVITY_PRESETS.hospitality.activity).toBe("hospitality");
    expect(ACTIVITY_PRESETS.goods.activity).toBe("goods");
  });
});

describe("validateSelfEmployedForm", () => {
  it("accepts an empty form — nothing typed yet is not an error", () => {
    expect(validateSelfEmployedForm(DEFAULTS)).toEqual({});
  });

  it("rejects an unparseable amount", () => {
    expect(validateSelfEmployedForm(form({ invoicing: "abc" })).invoicing)
      .toBeTruthy();
  });

  it("rejects a negative amount", () => {
    expect(validateSelfEmployedForm(form({ invoicing: "-5" })).invoicing)
      .toBeTruthy();
  });

  it("accepts zero — a month with no invoicing still owes the floor", () => {
    expect(validateSelfEmployedForm(form({ invoicing: "0" }))).toEqual({});
  });

  it("ignores the quarter fields while the irregular toggle is off", () => {
    const errors = validateSelfEmployedForm(
      form({ invoicing: "2000", quarter1: "nonsense" }),
    );
    expect(errors.quarter1).toBeUndefined();
  });

  it("validates them once it is on", () => {
    const errors = validateSelfEmployedForm(
      form({ invoicing: "2000", irregularQuarter: true, quarter1: "nonsense" }),
    );
    expect(errors.quarter1).toBeTruthy();
  });
});

describe("toSelfEmployedInput", () => {
  it("returns null until something is typed", () => {
    expect(toSelfEmployedInput(DEFAULTS, DATE)).toBeNull();
  });

  it("builds the minimal input from the two surface fields", () => {
    expect(toSelfEmployedInput(form({ invoicing: "2 000" }), DATE)).toEqual({
      monthlyInvoicing: 2000,
      activity: "services",
      retentionCategory: "professional",
      referenceDate: DATE,
    });
  });

  it("builds an input for a zero invoice rather than returning null", () => {
    const input = toSelfEmployedInput(form({ invoicing: "0" }), DATE);
    expect(input?.monthlyInvoicing).toBe(0);
  });

  it("omits every optional flag that is off", () => {
    const input = toSelfEmployedInput(form({ invoicing: "2000" }), DATE);
    expect(Object.keys(input ?? {})).not.toContain("chargesVat");
    expect(Object.keys(input ?? {})).not.toContain("quarter");
  });

  it("passes the quarter through when all three months are filled", () => {
    const input = toSelfEmployedInput(
      form({
        invoicing: "2000",
        irregularQuarter: true,
        quarter1: "3 500",
        quarter2: "800",
        quarter3: "1 200",
      }),
      DATE,
    );
    expect(input?.quarter).toEqual([3500, 800, 1200]);
  });

  // A blank month is a month the user has not answered for, not a month of no
  // income. Sending [3500, 0, 0] would understate the base by two thirds and
  // do it silently, so the input falls back to the stated assumption instead —
  // which the result panel then labels.
  it("falls back to the monthly stand-in when the quarter is half-filled", () => {
    const input = toSelfEmployedInput(
      form({ invoicing: "2000", irregularQuarter: true, quarter1: "3 500" }),
      DATE,
    );
    expect(input?.quarter).toBeUndefined();
  });

  // The distinction the fallback rests on: blank is "not answered", 0 is the
  // user saying the month had no invoicing. Both are legitimate and they mean
  // opposite things, so the form must not conflate them.
  it("keeps an explicit zero month, unlike a blank one", () => {
    const input = toSelfEmployedInput(
      form({
        invoicing: "2000",
        irregularQuarter: true,
        quarter1: "3 500",
        quarter2: "0",
        quarter3: "0",
      }),
      DATE,
    );
    expect(input?.quarter).toEqual([3500, 0, 0]);
  });

  it("drops the quarter entirely when the toggle is turned back off", () => {
    const input = toSelfEmployedInput(
      form({
        invoicing: "2000",
        irregularQuarter: false,
        quarter1: "3 500",
        quarter2: "800",
        quarter3: "1 200",
      }),
      DATE,
    );
    expect(input?.quarter).toBeUndefined();
  });

  describe("region", () => {
    // The region only means anything alongside IVA — it selects the taxa
    // normal. Sending it while exempt would put a field in the input that
    // nothing reads, which is how a later reader concludes it does something.
    it("is omitted entirely while the IVA exemption applies", () => {
      const input = toSelfEmployedInput(
        form({ invoicing: "2000", region: "madeira" }),
        DATE,
      );
      expect(input?.region).toBeUndefined();
      expect(input?.chargesVat).toBeUndefined();
    });

    it("is sent once IVA is charged", () => {
      const input = toSelfEmployedInput(
        form({ invoicing: "2000", chargesVat: true, region: "acores" }),
        DATE,
      );
      expect(input).toMatchObject({ chargesVat: true, region: "acores" });
    });

    it("is left implicit for the Continente, which is the engine's default", () => {
      const input = toSelfEmployedInput(
        form({ invoicing: "2000", chargesVat: true, region: "continente" }),
        DATE,
      );
      expect(input?.chargesVat).toBe(true);
      expect(input?.region).toBeUndefined();
    });
  });

  it("carries each situation toggle through", () => {
    const input = toSelfEmployedInput(
      form({
        invoicing: "2000",
        chargesVat: true,
        retentionDispensed: true,
        clientDoesNotWithhold: true,
        soleTrader: true,
        accumulatesEmployment: true,
        firstActivityDeferral: true,
      }),
      DATE,
    );
    expect(input).toMatchObject({
      chargesVat: true,
      retentionDispensed: true,
      clientDoesNotWithhold: true,
      soleTrader: true,
      accumulatesEmployment: true,
      firstActivityDeferral: true,
    });
  });
});
