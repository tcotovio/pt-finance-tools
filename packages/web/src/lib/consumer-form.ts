// The consumer-credit form's state, and its translation into an engine input.
//
// Simpler than the mortgage form by construction: no property, so no price, no
// appraisal, no LTV, no purpose-of-property. What replaces them is the kind of
// credit, which is what sets the maturity ceiling.

import type {
  ConsumerCreditKind,
  ConsumerLoanInput,
  LoanRateType,
} from "@pt-finance-tools/engine";
import { CONSUMER_MARKET } from "@pt-finance-tools/engine";
import { parseAmount } from "./format.js";

export interface ConsumerForm {
  income: string;
  age: string;
  kind: ConsumerCreditKind;
  termYears: string;
  annualRate: string;
  rateType: LoanRateType;
  existingDebt: string;
  retired: boolean;
}

/**
 * The rate the form starts on, as a percentage.
 *
 * Unlike the mortgage spread, this one is a published figure rather than an
 * assumption: it is the ECB's average annualised rate on new Portuguese
 * consumer credit. Consumer loans are quoted and agreed as a single rate, so
 * the observed average is directly the quantity the form needs.
 */
export const DEFAULT_CONSUMER_RATE = (CONSUMER_MARKET.averageRate * 100)
  .toFixed(1)
  .replace(".", ",");

/** Longest term the Recomendação allows any consumer credit (art. 7.º n.º 3–4). */
const MAX_TERM_YEARS = 10;
const MAX_INCOME = 1_000_000;
const MAX_RATE_PERCENT = 40;

export const DEFAULT_CONSUMER_FORM: ConsumerForm = {
  income: "",
  age: "30",
  kind: "personal",
  termYears: "5",
  annualRate: DEFAULT_CONSUMER_RATE,
  // Portuguese consumer credit is overwhelmingly fixed-rate, and a fixed
  // contract takes no shock — modelling it as variable would invent a stress
  // test the statute does not prescribe for it.
  rateType: "fixed",
  existingDebt: "",
  retired: false,
};

export type ConsumerFormErrors = Partial<Record<keyof ConsumerForm, string>>;

function parseCount(raw: string): number | null {
  const value = parseAmount(raw);
  if (value === null || !Number.isInteger(value)) return null;
  return value;
}

/** Validate the whole form; an empty field means "not filled in yet". */
export function validateConsumerForm(form: ConsumerForm): ConsumerFormErrors {
  const errors: ConsumerFormErrors = {};

  if (form.income.trim() !== "") {
    const income = parseAmount(form.income);
    if (income === null) {
      errors.income = "Introduza um valor, por exemplo 1500 ou 1.500,00.";
    } else if (income <= 0) {
      errors.income = "O rendimento tem de ser superior a zero.";
    } else if (income > MAX_INCOME) {
      errors.income = "Valor demasiado alto para uma simulação mensal.";
    }
  }

  if (form.age.trim() !== "") {
    const age = parseCount(form.age);
    if (age === null || age < 18 || age > 100) {
      errors.age = "Indique uma idade entre 18 e 100 anos.";
    }
  }

  if (form.termYears.trim() !== "") {
    const term = parseCount(form.termYears);
    if (term === null || term <= 0) {
      errors.termYears = "Indique o prazo em anos.";
    } else if (term > MAX_TERM_YEARS) {
      errors.termYears = `O prazo máximo no crédito ao consumo é de ${MAX_TERM_YEARS} anos.`;
    }
  }

  if (form.annualRate.trim() !== "") {
    const rate = parseAmount(form.annualRate);
    if (rate === null || rate < 0) {
      errors.annualRate = "Introduza a taxa anual, por exemplo 8,8.";
    } else if (rate > MAX_RATE_PERCENT) {
      errors.annualRate = "Introduza a taxa em percentagem, por exemplo 8,8.";
    }
  }

  if (form.existingDebt.trim() !== "") {
    const debt = parseAmount(form.existingDebt);
    if (debt === null || debt < 0) {
      errors.existingDebt = "Introduza o total das prestações que já paga.";
    } else if (debt > MAX_INCOME) {
      errors.existingDebt = "Valor demasiado alto.";
    }
  }

  return errors;
}

/**
 * Build the engine input. Returns `null` when there is nothing to compute yet
 * — only the income is required, since there is no property to value.
 */
export function toConsumerLoanInput(
  form: ConsumerForm,
  assessmentDate: string,
): ConsumerLoanInput | null {
  const monthlyIncome = parseAmount(form.income);
  if (monthlyIncome === null || monthlyIncome <= 0) return null;

  const input: ConsumerLoanInput = {
    borrower: { monthlyIncome, age: parseCount(form.age) ?? 30 },
    kind: form.kind,
    annualRate: (parseAmount(form.annualRate) ?? 0) / 100,
    rateType: form.rateType,
    termYears: parseCount(form.termYears) ?? 5,
    assessmentDate,
  };

  const existingDebt = parseAmount(form.existingDebt) ?? 0;
  if (existingDebt > 0) input.borrower.existingMonthlyDebt = existingDebt;
  if (form.retired) input.borrower.retired = true;

  return input;
}

export type UpdateConsumerForm = <K extends keyof ConsumerForm>(
  key: K,
  value: ConsumerForm[K],
) => void;
