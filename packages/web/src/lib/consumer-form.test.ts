import { describe, expect, it } from "vitest";
import { CONSUMER_MARKET } from "@pt-finance-tools/engine";
import {
  DEFAULT_CONSUMER_FORM,
  DEFAULT_CONSUMER_RATE,
  toConsumerLoanInput,
  validateConsumerForm,
  type ConsumerForm,
} from "./consumer-form.js";

const DATE = "2026-09-01";
const form = (overrides: Partial<ConsumerForm> = {}): ConsumerForm => ({
  ...DEFAULT_CONSUMER_FORM,
  income: "1500",
  ...overrides,
});

describe("validateConsumerForm", () => {
  it("accepts a filled-in form", () => {
    expect(validateConsumerForm(form())).toEqual({});
  });

  it("treats empty fields as not-yet-filled", () => {
    expect(validateConsumerForm(DEFAULT_CONSUMER_FORM)).toEqual({});
  });

  it("rejects a term beyond anything the Recomendação allows", () => {
    // 10 years is the ceiling for the most generous kind; nothing goes past it.
    expect(validateConsumerForm(form({ termYears: "15" })).termYears).toMatch(
      /10 anos/,
    );
  });

  it("accepts a term the kind itself will later cap", () => {
    // 9 years is legal for automóvel and gets capped to 7 for pessoal — that
    // is the engine's job to say, not a form error.
    expect(validateConsumerForm(form({ termYears: "9" })).termYears).toBeUndefined();
  });

  it("catches a rate typed in basis points", () => {
    expect(validateConsumerForm(form({ annualRate: "880" })).annualRate).toMatch(
      /em percentagem/,
    );
  });
});

describe("toConsumerLoanInput", () => {
  it("returns null until an income is given", () => {
    expect(toConsumerLoanInput(DEFAULT_CONSUMER_FORM, DATE)).toBeNull();
  });

  it("needs no property, unlike the mortgage form", () => {
    // The whole shape of the product: income alone is enough to answer.
    expect(toConsumerLoanInput(form(), DATE)).not.toBeNull();
  });

  it("maps the kind, term and rate", () => {
    const input = toConsumerLoanInput(
      form({ kind: "auto", termYears: "8", annualRate: "7,5" }),
      DATE,
    );
    expect(input).toMatchObject({ kind: "auto", termYears: 8 });
    expect(input?.annualRate).toBeCloseTo(0.075, 10);
  });

  it("defaults to a fixed rate, as the product usually is", () => {
    expect(toConsumerLoanInput(form(), DATE)?.rateType).toBe("fixed");
  });

  it("carries optional fields only when set", () => {
    const bare = toConsumerLoanInput(form(), DATE);
    expect(bare?.borrower.existingMonthlyDebt).toBeUndefined();
    expect(bare?.borrower.retired).toBeUndefined();

    const full = toConsumerLoanInput(
      form({ existingDebt: "150", retired: true }),
      DATE,
    );
    expect(full?.borrower.existingMonthlyDebt).toBe(150);
    expect(full?.borrower.retired).toBe(true);
  });
});

describe("the default rate is the published one, not an invention", () => {
  it("matches the ECB average for Portuguese consumer credit", () => {
    // Unlike the mortgage spread, this quantity is directly observable:
    // consumer credit is agreed as a single rate, so the published average is
    // exactly what the form needs.
    const asFraction = Number(DEFAULT_CONSUMER_RATE.replace(",", ".")) / 100;
    expect(asFraction).toBeCloseTo(CONSUMER_MARKET.averageRate, 3);
  });

  it("is well above any mortgage rate, as consumer credit is", () => {
    expect(CONSUMER_MARKET.averageRate).toBeGreaterThan(0.05);
  });
});
