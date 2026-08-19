// The loan form's state, and its translation into an engine `MaxLoanInput`.
//
// Same shape as the wage form: raw strings so the user can type freely, one
// pure place for validation and conversion.

import type { LoanPurpose, MaxLoanInput } from "@pt-finance-tools/engine";
import { parseAmount } from "./format.js";

export interface LoanForm {
  /** Monthly income, as the DSTI denominator sees it. */
  income: string;
  age: string;
  propertyPrice: string;
  termYears: string;
  purpose: LoanPurpose;
  annualRate: string;
  existingDebt: string;
  appraisalValue: string;
  retired: boolean;
}

/**
 * The rate the form starts on, as a percentage.
 *
 * A placeholder, and labelled as one in the UI: the Euribor feed is not built
 * yet and the spread is PLAN.md open decision §10.1, so this is a plausible
 * 2026 figure rather than a sourced one. It is the single input most worth
 * the user overriding with their actual proposal.
 */
export const DEFAULT_ANNUAL_RATE = "3,2";

export const DEFAULT_LOAN_FORM: LoanForm = {
  income: "",
  age: "30",
  propertyPrice: "",
  termYears: "40",
  purpose: "own-permanent-residence",
  annualRate: DEFAULT_ANNUAL_RATE,
  existingDebt: "",
  appraisalValue: "",
  retired: false,
};

export type LoanFormErrors = Partial<Record<keyof LoanForm, string>>;

const MAX_INCOME = 1_000_000;
const MAX_PRICE = 100_000_000;
/** Above this the annuity stops meaning anything; also catches "320" for 3,20 %. */
const MAX_RATE_PERCENT = 25;
const MIN_AGE = 18;
const MAX_AGE = 100;
/** The longest any BdP maturity ceiling allows, so anything beyond is a typo. */
const MAX_TERM_YEARS = 40;

function parseCount(raw: string): number | null {
  const value = parseAmount(raw);
  if (value === null || !Number.isInteger(value)) return null;
  return value;
}

/**
 * Validate the whole form. As in the wage form, an empty field means "not
 * filled in yet" rather than an error — only something typed and wrong is
 * flagged.
 */
export function validateLoanForm(form: LoanForm): LoanFormErrors {
  const errors: LoanFormErrors = {};

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

  if (form.propertyPrice.trim() !== "") {
    const price = parseAmount(form.propertyPrice);
    if (price === null || price <= 0) {
      errors.propertyPrice = "Introduza o preço do imóvel.";
    } else if (price > MAX_PRICE) {
      errors.propertyPrice = "Valor demasiado alto.";
    }
  }

  if (form.appraisalValue.trim() !== "") {
    const value = parseAmount(form.appraisalValue);
    if (value === null || value <= 0) {
      errors.appraisalValue = "Introduza o valor da avaliação.";
    } else if (value > MAX_PRICE) {
      errors.appraisalValue = "Valor demasiado alto.";
    }
  }

  if (form.age.trim() !== "") {
    const age = parseCount(form.age);
    if (age === null || age < MIN_AGE || age > MAX_AGE) {
      errors.age = `Indique uma idade entre ${MIN_AGE} e ${MAX_AGE} anos.`;
    }
  }

  if (form.termYears.trim() !== "") {
    const term = parseCount(form.termYears);
    if (term === null || term <= 0) {
      errors.termYears = "Indique o prazo em anos.";
    } else if (term > MAX_TERM_YEARS) {
      errors.termYears = `O prazo máximo recomendado pelo Banco de Portugal é de ${MAX_TERM_YEARS} anos.`;
    }
  }

  if (form.annualRate.trim() !== "") {
    const rate = parseAmount(form.annualRate);
    if (rate === null || rate < 0) {
      errors.annualRate = "Introduza a taxa anual, por exemplo 3,2.";
    } else if (rate > MAX_RATE_PERCENT) {
      errors.annualRate = "Introduza a taxa em percentagem, por exemplo 3,2.";
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
 * Build the engine input from a validated form. Returns `null` when there is
 * not yet enough to compute — both the income and the property price are
 * needed, since one bounds the DSTI and the other the LTV.
 */
export function toMaxLoanInput(
  form: LoanForm,
  assessmentDate: string,
): MaxLoanInput | null {
  const monthlyIncome = parseAmount(form.income);
  const propertyPrice = parseAmount(form.propertyPrice);
  if (monthlyIncome === null || monthlyIncome <= 0) return null;
  if (propertyPrice === null || propertyPrice <= 0) return null;

  const ratePercent = parseAmount(form.annualRate);
  const input: MaxLoanInput = {
    borrower: {
      monthlyIncome,
      age: parseCount(form.age) ?? 30,
    },
    purpose: form.purpose,
    propertyPrice,
    // Entered as a percentage, used as a fraction.
    annualRate: (ratePercent ?? 0) / 100,
    termYears: parseCount(form.termYears) ?? MAX_TERM_YEARS,
    assessmentDate,
  };

  const existingDebt = parseAmount(form.existingDebt) ?? 0;
  if (existingDebt > 0) {
    input.borrower.existingMonthlyDebt = existingDebt;
  }

  if (form.retired) {
    input.borrower.retired = true;
  }

  const appraisal = parseAmount(form.appraisalValue) ?? 0;
  if (appraisal > 0) {
    input.appraisalValue = appraisal;
  }

  return input;
}

/** Setter passed down to the panels: one key of the form at a time. */
export type UpdateLoanForm = <K extends keyof LoanForm>(
  key: K,
  value: LoanForm[K],
) => void;
