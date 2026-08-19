import { describe, expect, it } from "vitest";
import { DEFAULT_FORM, toWageInput, validateForm } from "./form.js";
import type { WageForm } from "./form.js";

const form = (overrides: Partial<WageForm> = {}): WageForm => ({
  ...DEFAULT_FORM,
  ...overrides,
});

const DATE = "2026-08-19";

describe("validateForm", () => {
  it("accepts the initial, empty form", () => {
    expect(validateForm(DEFAULT_FORM)).toEqual({});
  });

  it("flags a gross that was typed but is not a number", () => {
    expect(validateForm(form({ gross: "abc" })).gross).toBeDefined();
  });

  it("flags a gross of zero or less", () => {
    expect(validateForm(form({ gross: "0" })).gross).toBeDefined();
  });

  it("treats an emptied field as unfilled rather than wrong", () => {
    // Clearing a box to retype it must not paint the form red.
    expect(validateForm(form({ dependents: "" })).dependents).toBeUndefined();
    expect(
      validateForm(form({ meal: true, mealDailyAmount: "", mealDays: "" })),
    ).toEqual({});
  });

  it("flags an isenção de horário that is not a number", () => {
    expect(
      validateForm(form({ workScheduleExemption: "abc" }))
        .workScheduleExemption,
    ).toBeDefined();
    expect(
      validateForm(form({ workScheduleExemption: "" })).workScheduleExemption,
    ).toBeUndefined();
  });

  it("flags trabalho suplementar that is not a number", () => {
    expect(validateForm(form({ overtime: "abc" })).overtime).toBeDefined();
    expect(validateForm(form({ overtime: "" })).overtime).toBeUndefined();
  });

  it("rejects fractional dependents", () => {
    expect(validateForm(form({ dependents: "2,5" })).dependents).toBeDefined();
  });

  it("checks the meal allowance only while it is switched on", () => {
    const values = { mealDailyAmount: "abc", mealDays: "99" };
    expect(validateForm(form({ meal: false, ...values }))).toEqual({});

    const errors = validateForm(form({ meal: true, ...values }));
    expect(errors.mealDailyAmount).toBeDefined();
    expect(errors.mealDays).toBeDefined();
  });

  it("keeps the IRS Jovem year inside the 10-year schedule", () => {
    expect(
      validateForm(form({ irsJovem: true, irsJovemYear: "11" })).irsJovemYear,
    ).toBeDefined();
    expect(
      validateForm(form({ irsJovem: true, irsJovemYear: "10" })).irsJovemYear,
    ).toBeUndefined();
  });
});

describe("toWageInput", () => {
  it("returns null until there is a usable gross", () => {
    expect(toWageInput(DEFAULT_FORM, DATE)).toBeNull();
    expect(toWageInput(form({ gross: "abc" }), DATE)).toBeNull();
    expect(toWageInput(form({ gross: "0" }), DATE)).toBeNull();
  });

  it("maps the plain case", () => {
    expect(toWageInput(form({ gross: "1.500,00" }), DATE)).toEqual({
      grossMonthly: 1500,
      region: "continente",
      category: "unmarried",
      dependents: 0,
      referenceDate: DATE,
    });
  });

  it("counts an emptied dependents box as zero", () => {
    expect(
      toWageInput(form({ gross: "1500", dependents: "" }), DATE)?.dependents,
    ).toBe(0);
  });

  it("passes the isenção de horário through as an amount", () => {
    expect(
      toWageInput(
        form({ gross: "1500", workScheduleExemption: "330" }),
        DATE,
      )?.workScheduleExemption,
    ).toBe(330);

    // Blank or zero means the worker does not receive it.
    expect(
      toWageInput(form({ gross: "1500" }), DATE)?.workScheduleExemption,
    ).toBeUndefined();
  });

  it("raises the subsidy base only when the contract says so", () => {
    const excluded = toWageInput(
      form({ gross: "1500", workScheduleExemption: "330" }),
      DATE,
    );
    // Left unset, so the engine falls back to the base salary.
    expect(excluded?.subsidyAmount).toBeUndefined();

    const included = toWageInput(
      form({
        gross: "1500",
        workScheduleExemption: "330",
        subsidiesIncludeExemption: true,
      }),
      DATE,
    );
    expect(included?.subsidyAmount).toBe(1830);
  });

  it("ignores the subsidy toggle without an isenção de horário", () => {
    expect(
      toWageInput(
        form({ gross: "1500", subsidiesIncludeExemption: true }),
        DATE,
      )?.subsidyAmount,
    ).toBeUndefined();
  });

  it("passes trabalho suplementar through as an amount", () => {
    expect(
      toWageInput(form({ gross: "1500", overtime: "300" }), DATE)?.overtime,
    ).toBe(300);
    expect(toWageInput(form({ gross: "1500" }), DATE)?.overtime).toBeUndefined();
  });

  it("includes the meal allowance once it is complete", () => {
    const input = toWageInput(
      form({
        gross: "1500",
        meal: true,
        mealDailyAmount: "10,46",
        mealDays: "22",
        mealMethod: "cash",
      }),
      DATE,
    );
    expect(input?.mealAllowance).toEqual({
      dailyAmount: 10.46,
      days: 22,
      method: "cash",
    });
  });

  it("leaves out an allowance that is switched on but still blank", () => {
    const input = toWageInput(
      form({ gross: "1500", meal: true, mealDailyAmount: "" }),
      DATE,
    );
    expect(input?.mealAllowance).toBeUndefined();
  });

  it("passes the twelfths through as fractions, and omits them at zero", () => {
    expect(toWageInput(form({ gross: "1500" }), DATE)?.twelfths).toBeUndefined();

    expect(
      toWageInput(
        form({
          gross: "1500",
          holidayTwelfths: "1",
          christmasTwelfths: "0.5",
        }),
        DATE,
      )?.twelfths,
    ).toEqual({ holiday: 1, christmas: 0.5 });
  });

  it("passes IRS Jovem through only when opted in", () => {
    expect(toWageInput(form({ gross: "1500" }), DATE)?.irsJovem).toBeUndefined();

    expect(
      toWageInput(
        form({ gross: "1500", irsJovem: true, irsJovemYear: "4" }),
        DATE,
      )?.irsJovem,
    ).toEqual({ yearOfIncome: 4 });
  });
});
