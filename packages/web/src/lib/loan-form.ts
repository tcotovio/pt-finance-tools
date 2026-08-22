// The loan form's state, and its translation into an engine `MaxLoanInput`.
//
// Same shape as the wage form: raw strings so the user can type freely, one
// pure place for validation and conversion.

import {
  contractRate,
  type EuriborTenor,
  type LoanPurpose,
  type LoanRateType,
  type MaxLoanInput,
  type MaxPriceInput,
  type PurchaseCostsInput,
  type Region,
} from "@pt-finance-tools/engine";
import { parseAmount } from "./format.js";

/**
 * Which question the form is answering.
 *
 * The calculator has always been able to test a price the user picked. That is
 * the wrong shape for the question most people arrive with — it makes them
 * guess a number and then binary-search by hand — so the same engine is driven
 * from the other end: savings in, price out.
 */
export type LoanMode = "price" | "capacity";

export interface LoanForm {
  mode: LoanMode;
  /** Monthly income, as the DSTI denominator sees it. */
  income: string;
  age: string;
  propertyPrice: string;
  /** Cash on hand. The answer in capacity mode; a cross-check in price mode. */
  savings: string;
  termYears: string;
  purpose: LoanPurpose;
  /** Whether the rate is indexed to Euribor or fixed for the whole term. */
  rateType: LoanRateType;
  /** Which Euribor the contract follows, when variable. */
  tenor: EuriborTenor;
  /** The bank's margin over the index, as a percentage. */
  spread: string;
  /**
   * The fixed rate, as a percentage. For `"fixed"` it is the whole term's
   * rate; for `"mixed"` it is the initial fixed rate, and the indexed rate
   * that follows is composed from `tenor` + `spread` like a variable one.
   */
  annualRate: string;
  /** Years the mista rate stays fixed for. */
  fixedPeriodYears: string;
  existingDebt: string;
  appraisalValue: string;
  retired: boolean;
  /** Which IMT tables apply — the country splits in two here, not three. */
  region: Region;
  /** VPT, when it is above the price. Blank means "not above it". */
  vpt: string;
  /**
   * The buyer asserts the IMT Jovem conditions (CIMT art. 9.º n.º 2). An
   * assertion rather than a derivation: two of the conditions — first ever
   * acquisition, not a dependant for IRS — are things only the buyer knows.
   */
  youngFirstHome: boolean;
  /** The buyer asserts the garantia pessoal do Estado conditions. */
  stateGuarantee: boolean;
  /** Bank charges from the FINE. Nothing models these; the user types them. */
  bankFees: string;
}

/**
 * The spread the form starts on, as a percentage.
 *
 * Still an assumption — no statute sets a spread and no feed publishes a
 * representative one — but no longer this project's own invention: 0,7 % is
 * the "spread base" published in the methodology of the Crédivel simulator,
 * the same independent implementation the loan engine is cross-checked
 * against (see loan/external-crosscheck.test.ts).
 *
 * Why it changed from 1,0 %. Once the app began showing BdP's distribution of
 * actual rates, the old default became visibly incoherent: over the Euribor
 * it composed to roughly the 90th percentile, so a user who touched nothing
 * saw the tool flag its own starting point as dearer than 90 % of the market.
 * At 0,7 % over the 6M index the default lands between the median (3,19 %)
 * and the third quartile (3,43 %) — mildly conservative, which is the right
 * direction for a borrowing-capacity tool, without the contradiction.
 *
 * It is still labelled in the UI as an estimate to replace with the bank's
 * own proposal.
 */
export const DEFAULT_SPREAD = "0,7";

/** The rate the form starts on when the contract is fixed, as a percentage. */
export const DEFAULT_ANNUAL_RATE = "3,2";

/**
 * How long a mista contract starts out fixed for. Two and five years are the
 * common Portuguese offers; five is the middle of the range and the value the
 * UI labels as an assumption to replace with the bank's own.
 */
export const DEFAULT_FIXED_PERIOD_YEARS = "5";

/**
 * The tenor the form starts on.
 *
 * Euribor 6M, because that is what the market actually uses: 49 % of new
 * variable-rate contracts follow it against 33 % on 12M and 11 % on 3M (BdP,
 * June 2026). The previous default of 12M was an assumption that the data,
 * once fetched, did not support.
 */
export const DEFAULT_TENOR: EuriborTenor = "6m";

export const DEFAULT_LOAN_FORM: LoanForm = {
  mode: "price",
  income: "",
  age: "30",
  propertyPrice: "",
  savings: "",
  termYears: "40",
  purpose: "own-permanent-residence",
  rateType: "variable",
  tenor: DEFAULT_TENOR,
  spread: DEFAULT_SPREAD,
  annualRate: DEFAULT_ANNUAL_RATE,
  fixedPeriodYears: DEFAULT_FIXED_PERIOD_YEARS,
  existingDebt: "",
  appraisalValue: "",
  retired: false,
  region: "continente",
  vpt: "",
  youngFirstHome: false,
  stateGuarantee: false,
  bankFees: "",
};

export type LoanFormErrors = Partial<Record<keyof LoanForm, string>>;

const MAX_INCOME = 1_000_000;
const MAX_PRICE = 100_000_000;
/** Above this the annuity stops meaning anything; also catches "320" for 3,20 %. */
const MAX_RATE_PERCENT = 25;
/** A retail spread above this is a typo, not an offer. */
const MAX_SPREAD_PERCENT = 10;
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

  if (form.savings.trim() !== "") {
    const savings = parseAmount(form.savings);
    if (savings === null || savings < 0) {
      errors.savings = "Introduza o que tem de parte, por exemplo 40 000.";
    } else if (savings > MAX_PRICE) {
      errors.savings = "Valor demasiado alto.";
    }
  }

  if (form.vpt.trim() !== "") {
    const vpt = parseAmount(form.vpt);
    if (vpt === null || vpt <= 0) {
      errors.vpt = "Introduza o valor patrimonial tributário.";
    } else if (vpt > MAX_PRICE) {
      errors.vpt = "Valor demasiado alto.";
    }
  }

  if (form.bankFees.trim() !== "") {
    const fees = parseAmount(form.bankFees);
    if (fees === null || fees < 0) {
      errors.bankFees = "Introduza o total das comissões, por exemplo 800.";
    } else if (fees > MAX_INCOME) {
      errors.bankFees = "Valor demasiado alto.";
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

  if (form.rateType === "mixed" && form.fixedPeriodYears.trim() !== "") {
    const years = parseCount(form.fixedPeriodYears);
    const term = parseCount(form.termYears);
    if (years === null || years <= 0) {
      errors.fixedPeriodYears = "Indique quantos anos a taxa fica fixa.";
    } else if (term !== null && years >= term) {
      // A rate fixed for the whole term is taxa fixa, and the engine says so.
      errors.fixedPeriodYears =
        "O período fixo tem de ser mais curto do que o prazo do crédito.";
    }
  }

  if (form.spread.trim() !== "") {
    const spread = parseAmount(form.spread);
    if (spread === null || spread < 0) {
      errors.spread = "Introduza o spread, por exemplo 1,0.";
    } else if (spread > MAX_SPREAD_PERCENT) {
      errors.spread = "Spread demasiado alto para uma proposta real.";
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
  indexRate: number,
): MaxLoanInput | null {
  const monthlyIncome = parseAmount(form.income);
  const propertyPrice = parseAmount(form.propertyPrice);
  if (monthlyIncome === null || monthlyIncome <= 0) return null;
  if (propertyPrice === null || propertyPrice <= 0) return null;

  // Variable: the ECB's index plus the bank's margin. Fixed: whatever the
  // proposal says, with no index involved. Mixed: BOTH — the indexed rate is
  // what applies after the fixed period, so it is the one the engine takes as
  // `annualRate`, with the fixed leg carried separately.
  const indexed = contractRate(indexRate, (parseAmount(form.spread) ?? 0) / 100);
  const fixed = (parseAmount(form.annualRate) ?? 0) / 100;
  const annualRate = form.rateType === "fixed" ? fixed : indexed;

  const input: MaxLoanInput = {
    borrower: {
      monthlyIncome,
      age: parseCount(form.age) ?? 30,
    },
    purpose: form.purpose,
    propertyPrice,
    annualRate,
    rateType: form.rateType,
    termYears: parseCount(form.termYears) ?? MAX_TERM_YEARS,
    assessmentDate,
  };

  const existingDebt = parseAmount(form.existingDebt) ?? 0;
  if (existingDebt > 0) {
    input.borrower.existingMonthlyDebt = existingDebt;
  }

  if (form.rateType === "mixed") {
    input.mixedTerms = {
      fixedPeriodYears: parseCount(form.fixedPeriodYears) ?? 5,
      fixedRate: fixed,
    };
  }

  if (form.retired) {
    input.borrower.retired = true;
  }

  const appraisal = parseAmount(form.appraisalValue) ?? 0;
  if (appraisal > 0) {
    input.appraisalValue = appraisal;
  }

  if (form.stateGuarantee) {
    input.stateGuarantee = true;
  }

  return input;
}

/**
 * Build the reverse-direction input: savings in, price out.
 *
 * The appraisal and the VPT arrive as RATIOS rather than amounts, because the
 * price is the unknown they would be measured against. In price mode the user
 * gives both in euros; here the honest translation is "the same relationship
 * to whatever price we land on", and a blank field means "equal to the price"
 * — which is what the forward direction already assumes.
 */
export function toMaxPriceInput(
  form: LoanForm,
  assessmentDate: string,
  indexRate: number,
): MaxPriceInput | null {
  const monthlyIncome = parseAmount(form.income);
  const savings = parseAmount(form.savings);
  if (monthlyIncome === null || monthlyIncome <= 0) return null;
  if (savings === null || savings < 0) return null;

  const indexed = contractRate(indexRate, (parseAmount(form.spread) ?? 0) / 100);
  const fixed = (parseAmount(form.annualRate) ?? 0) / 100;
  const annualRate = form.rateType === "fixed" ? fixed : indexed;

  const input: MaxPriceInput = {
    borrower: {
      monthlyIncome,
      age: parseCount(form.age) ?? 30,
    },
    purpose: form.purpose,
    annualRate,
    rateType: form.rateType,
    termYears: parseCount(form.termYears) ?? MAX_TERM_YEARS,
    region: form.region,
    savings,
    assessmentDate,
  };

  const existingDebt = parseAmount(form.existingDebt) ?? 0;
  if (existingDebt > 0) {
    input.borrower.existingMonthlyDebt = existingDebt;
  }

  if (form.rateType === "mixed") {
    input.mixedTerms = {
      fixedPeriodYears: parseCount(form.fixedPeriodYears) ?? 5,
      fixedRate: fixed,
    };
  }

  if (form.retired) input.borrower.retired = true;
  if (form.youngFirstHome) input.youngFirstHome = true;
  if (form.stateGuarantee) input.stateGuarantee = true;

  const bankFees = parseAmount(form.bankFees) ?? 0;
  if (bankFees > 0) input.bankFees = bankFees;

  return input;
}

/**
 * The purchase-cost input for a settled price — the forward direction's
 * companion to {@link toMaxPriceInput}.
 *
 * Returns `null` until there is a price and a loan to cost, since a cost model
 * with no transaction to attach to would just be a table of rates.
 */
export function toPurchaseCostsInput(
  form: LoanForm,
  price: number,
  loanAmount: number,
  termYears: number,
  annualRate: number,
  assessmentDate: string,
): PurchaseCostsInput | null {
  if (price <= 0) return null;

  const input: PurchaseCostsInput = {
    price,
    loanAmount,
    purpose: form.purpose,
    region: form.region,
    termYears,
    annualRate,
    assessmentDate,
  };

  const vpt = parseAmount(form.vpt) ?? 0;
  if (vpt > 0) input.vpt = vpt;
  if (form.youngFirstHome) input.youngFirstHome = true;

  const bankFees = parseAmount(form.bankFees) ?? 0;
  if (bankFees > 0) input.bankFees = bankFees;

  return input;
}

/** Setter passed down to the panels: one key of the form at a time. */
export type UpdateLoanForm = <K extends keyof LoanForm>(
  key: K,
  value: LoanForm[K],
) => void;
