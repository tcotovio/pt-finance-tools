// Turning an engine `MaxLoanResult` into what the loan panel shows.
//
// The engine answers "how much" and "which rule stopped you". This file adds
// the two things a borrower actually acts on: the deposit the answer implies,
// and what would move the binding limit — which differs completely between
// the two constraints, and is the reason the panel names the binding one
// rather than only showing the minimum.
//
// Amounts are floored to the euro, not rounded: a max loan is a ceiling, and
// rounding 249 999,60 € up to 250 000 € would overstate what the borrower can
// have. The deposit is derived from the floored loan, so the two always add
// back up to the price on screen.

import {
  amortize,
  monthlyPayment,
  type BindingConstraint,
  type MaxLoanResult,
} from "@pt-finance-tools/engine";
import type { LawReferenceId } from "./law.js";

/** One of the two ceilings, as a row the panel can compare side by side. */
export interface ConstraintRow {
  key: BindingConstraint;
  label: string;
  /** The loan this constraint alone would allow. */
  amount: number;
  /** True for the one that actually decided the answer. */
  binding: boolean;
  /** What the rule is, in one line. */
  detail: string;
  /** What would move it — only shown for the binding one. */
  remedy: string;
  reference: LawReferenceId;
}

export interface LoanSummary {
  /** What can be borrowed, floored to the euro. */
  maxLoan: number;
  /** The instalment at the contract rate — what is actually paid. */
  contractPayment: number;
  /** The instalment the DSTI test was run at, which nobody pays. */
  stressedPayment: number;
  /** Price − loan: what has to come from savings. */
  deposit: number;
  /** The deposit as a share of the price, 0–1. */
  depositShare: number;
  termYears: number;
  termCappedByAge: boolean;
  /**
   * The real effort rate: the contract instalment plus existing debt over the
   * *unadjusted* income. Not the DSTI — that one is stressed and reduced, and
   * is a supervisory test rather than a description of the household budget.
   */
  effortRate: number;
  /** The supervisory ratio itself, which sits on the 45 % ceiling by design. */
  dstiRatio: number;
  stressedRate: number;
  shock: number;
  /** Income after the past-70 reduction. */
  adjustedIncome: number;
  /** The reduction applied, as a fraction (0 when none). */
  incomeReduction: number;
  /** Total interest over the life of the loan, at the contract rate. */
  totalInterest: number;
  constraints: ConstraintRow[];
  /** The row that decided the answer. */
  binding: ConstraintRow;
  parametersVerified: boolean;
  sources: MaxLoanResult["sources"];
}

function percentLabel(fraction: number): string {
  return `${(fraction * 100).toLocaleString("pt-PT", {
    maximumFractionDigits: 0,
  })} %`;
}

export function buildLoanSummary(
  result: MaxLoanResult,
  propertyPrice: number,
  monthlyIncome: number,
  existingMonthlyDebt = 0,
): LoanSummary {
  const maxLoan = Math.floor(result.maxLoan);
  const months = Math.round(result.termYears * 12);
  const contractRate = result.dsti.stressedRate - result.dsti.shock;

  // Recomputed on the floored amount so the instalment on screen is the one
  // that belongs to the loan on screen.
  const contractPayment =
    maxLoan > 0 ? monthlyPayment(maxLoan, contractRate, months) : 0;
  const stressedPayment =
    maxLoan > 0 ? monthlyPayment(maxLoan, result.dsti.stressedRate, months) : 0;

  const constraints: ConstraintRow[] = [
    {
      key: "dsti",
      label: "Rendimento (taxa de esforço)",
      amount: Math.floor(result.dsti.maxLoan),
      binding: result.bindingConstraint === "dsti",
      detail: `A prestação, testada com uma subida de ${formatPoints(
        result.dsti.shock,
      )}, não pode passar ${percentLabel(result.dsti.limit)} do rendimento.`,
      remedy:
        "Uma entrada maior não altera este limite. O que o move: mais rendimento, menos encargos mensais, ou um prazo mais longo (se a idade ainda o permitir).",
      reference: "bdp-1-2026",
    },
    {
      key: "ltv",
      label: "Valor do imóvel (LTV)",
      amount: Math.floor(result.ltv.maxLoan),
      binding: result.bindingConstraint === "ltv",
      detail: `O banco não financia mais de ${percentLabel(
        result.ltv.limit,
      )} do imóvel.`,
      remedy:
        "Ganhar mais não altera este limite: a diferença para o preço tem de vir de capitais próprios. Um imóvel mais barato ou uma entrada maior é o que o move.",
      reference: "bdp-1-2026",
    },
  ];

  const binding = constraints.find((c) => c.binding) ?? constraints[0];
  const deposit = Math.max(0, propertyPrice - maxLoan);

  return {
    maxLoan,
    contractPayment,
    stressedPayment,
    deposit,
    depositShare: propertyPrice > 0 ? deposit / propertyPrice : 0,
    termYears: result.termYears,
    termCappedByAge: result.termCappedByAge,
    effortRate:
      monthlyIncome > 0
        ? (contractPayment + existingMonthlyDebt) / monthlyIncome
        : 0,
    dstiRatio:
      result.dsti.adjustedIncome > 0
        ? (stressedPayment + existingMonthlyDebt) / result.dsti.adjustedIncome
        : 0,
    stressedRate: result.dsti.stressedRate,
    shock: result.dsti.shock,
    adjustedIncome: result.dsti.adjustedIncome,
    incomeReduction: result.dsti.incomeReduction,
    totalInterest:
      maxLoan > 0 ? amortize(maxLoan, contractRate, months).totalInterest : 0,
    constraints,
    binding,
    parametersVerified: result.parametersVerified,
    sources: result.sources,
  };
}

function formatPoints(points: number): string {
  return `${(points * 100).toLocaleString("pt-PT", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} p.p.`;
}
