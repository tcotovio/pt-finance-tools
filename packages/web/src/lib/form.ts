// The form's own state, and its translation into an engine `WageInput`.
//
// Inputs are kept as raw strings so the user can type freely (including a
// half-finished "1.2"); validation and conversion happen here, in one pure
// place, rather than being spread across the components.

import type {
  MealAllowanceMethod,
  Region,
  TaxpayerCategory,
  WageInput,
} from "@pt-finance-tools/engine";
import { parseAmount } from "./format.js";

/** How much of a subsidy is paid monthly in duodécimos. */
export type TwelfthsChoice = "0" | "0.5" | "1";

export interface WageForm {
  gross: string;
  category: TaxpayerCategory;
  dependents: string;
  region: Region;
  workScheduleExemption: string;
  subsidiesIncludeExemption: boolean;
  overtime: string;
  meal: boolean;
  mealDailyAmount: string;
  mealDays: string;
  mealMethod: MealAllowanceMethod;
  holidayTwelfths: TwelfthsChoice;
  christmasTwelfths: TwelfthsChoice;
  irsJovem: boolean;
  irsJovemYear: string;
}

export const DEFAULT_FORM: WageForm = {
  gross: "",
  category: "unmarried",
  dependents: "0",
  region: "continente",
  workScheduleExemption: "",
  subsidiesIncludeExemption: false,
  overtime: "",
  meal: false,
  mealDailyAmount: "",
  mealDays: "22",
  mealMethod: "card",
  holidayTwelfths: "0",
  christmasTwelfths: "0",
  irsJovem: false,
  irsJovemYear: "1",
};

export type FormErrors = Partial<Record<keyof WageForm, string>>;

/** Highest year of earning the IRS Jovem schedule covers (art. 12.º-B). */
export const IRS_JOVEM_MAX_YEAR = 10;

const MAX_GROSS = 1_000_000;
const MAX_DEPENDENTS = 20;
const MAX_MEAL_DAYS = 31;
const MAX_MEAL_DAILY = 100;

function parseCount(raw: string): number | null {
  const value = parseAmount(raw);
  if (value === null || !Number.isInteger(value)) return null;
  return value;
}

/**
 * Validate the whole form.
 *
 * An empty field is never an error: it means "not filled in yet", and is
 * treated as absent by {@link toWageInput}. Only something typed and wrong
 * gets flagged — so switching the meal allowance on, or clearing a box to
 * retype it, does not paint the form red before the user has done anything.
 */
export function validateForm(form: WageForm): FormErrors {
  const errors: FormErrors = {};

  if (form.gross.trim() !== "") {
    const gross = parseAmount(form.gross);
    if (gross === null) {
      errors.gross = "Introduza um valor, por exemplo 1500 ou 1.500,00.";
    } else if (gross <= 0) {
      errors.gross = "O vencimento tem de ser superior a zero.";
    } else if (gross > MAX_GROSS) {
      errors.gross = "Valor demasiado alto para uma simulação mensal.";
    }
  }

  if (form.dependents.trim() !== "") {
    const dependents = parseCount(form.dependents);
    if (dependents === null || dependents < 0) {
      errors.dependents = "Indique um número inteiro de dependentes.";
    } else if (dependents > MAX_DEPENDENTS) {
      errors.dependents = `No máximo ${MAX_DEPENDENTS} dependentes.`;
    }
  }

  if (form.workScheduleExemption.trim() !== "") {
    const amount = parseAmount(form.workScheduleExemption);
    if (amount === null || amount < 0) {
      errors.workScheduleExemption = "Introduza o valor mensal da isenção.";
    } else if (amount > MAX_GROSS) {
      errors.workScheduleExemption = "Valor demasiado alto.";
    }
  }

  if (form.overtime.trim() !== "") {
    const amount = parseAmount(form.overtime);
    if (amount === null || amount < 0) {
      errors.overtime = "Introduza o valor pago em trabalho suplementar.";
    } else if (amount > MAX_GROSS) {
      errors.overtime = "Valor demasiado alto.";
    }
  }

  if (form.meal) {
    if (form.mealDailyAmount.trim() !== "") {
      const daily = parseAmount(form.mealDailyAmount);
      if (daily === null || daily < 0) {
        errors.mealDailyAmount = "Introduza o valor pago por dia.";
      } else if (daily > MAX_MEAL_DAILY) {
        errors.mealDailyAmount = "Valor diário demasiado alto.";
      }
    }

    if (form.mealDays.trim() !== "") {
      const days = parseCount(form.mealDays);
      if (days === null || days < 0) {
        errors.mealDays = "Indique um número inteiro de dias.";
      } else if (days > MAX_MEAL_DAYS) {
        errors.mealDays = `No máximo ${MAX_MEAL_DAYS} dias.`;
      }
    }
  }

  if (form.irsJovem && form.irsJovemYear.trim() !== "") {
    const year = parseCount(form.irsJovemYear);
    if (year === null || year < 1 || year > IRS_JOVEM_MAX_YEAR) {
      errors.irsJovemYear = `Indique um ano entre 1 e ${IRS_JOVEM_MAX_YEAR}.`;
    }
  }

  return errors;
}

/**
 * Build the engine input from a form that has already passed
 * {@link validateForm} and carries a gross amount. Returns `null` when there
 * is nothing to compute yet, so the caller can render the empty state.
 */
export function toWageInput(
  form: WageForm,
  referenceDate: string,
): WageInput | null {
  const grossMonthly = parseAmount(form.gross);
  if (grossMonthly === null || grossMonthly <= 0) return null;

  const input: WageInput = {
    grossMonthly,
    region: form.region,
    category: form.category,
    dependents: parseCount(form.dependents) ?? 0,
    referenceDate,
  };

  // Isenção de horário: ordinary remuneration, so the engine only needs the
  // amount. Whether the subsídios include it is contractual, which is why it
  // is the caller that says so, via `subsidyAmount`.
  const exemption = parseAmount(form.workScheduleExemption) ?? 0;
  if (exemption > 0) {
    input.workScheduleExemption = exemption;
    if (form.subsidiesIncludeExemption) {
      input.subsidyAmount = grossMonthly + exemption;
    }
  }

  const overtime = parseAmount(form.overtime) ?? 0;
  if (overtime > 0) {
    input.overtime = overtime;
  }

  if (form.meal) {
    const dailyAmount = parseAmount(form.mealDailyAmount) ?? 0;
    const days = parseCount(form.mealDays) ?? 0;
    // An allowance that is still blank (or zero) changes no number, but would
    // add a €0,00 line to the breakdown — so leave it out until it is real.
    if (dailyAmount > 0 && days > 0) {
      input.mealAllowance = { dailyAmount, days, method: form.mealMethod };
    }
  }

  const holiday = Number(form.holidayTwelfths);
  const christmas = Number(form.christmasTwelfths);
  if (holiday > 0 || christmas > 0) {
    input.twelfths = { holiday, christmas };
  }

  if (form.irsJovem) {
    input.irsJovem = { yearOfIncome: parseCount(form.irsJovemYear) ?? 1 };
  }

  return input;
}

/** Setter passed down to the panels: one key of the form at a time. */
export type UpdateForm = <K extends keyof WageForm>(
  key: K,
  value: WageForm[K],
) => void;
