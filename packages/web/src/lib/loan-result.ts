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
  type LoanRateType,
  type MaxLoanResult,
  type MaxPriceResult,
  type PriceBindingConstraint,
  type PurchaseCosts,
} from "@pt-finance-tools/engine";
import type { LawReferenceId } from "./law.js";

/** One of the ceilings, as a row the panel can compare side by side. */
export interface ConstraintRow {
  key: PriceBindingConstraint;
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
  /** The rate actually paid — `stressedRate` less the shock. */
  contractRate: number;
  shock: number;
  rateType: LoanRateType;
  /** For taxa mista, which leg of art. 1.º n.º 2 governed the test. */
  mixedBasis?: "post-fixed" | "fixed-period";
  /**
   * Whether the DSTI test was actually stressed. False for a fixed rate,
   * where there is no indexante to shock — and the copy has to change with
   * it, since "tested with a rise of 0,0 p.p." is nonsense.
   */
  shocked: boolean;
  /** Income after the past-70 reduction. */
  adjustedIncome: number;
  /** The reduction applied, as a fraction (0 when none). */
  incomeReduction: number;
  /** Total interest over the life of the loan, at the contract rate. */
  totalInterest: number;
  /** IMT, selo and registos — everything payable on top of the price. */
  costs: PurchaseCosts | null;
  /**
   * Deposit plus the upfront costs: what actually has to be in the account on
   * the day. The old panel showed only the deposit, which understated the
   * requirement by five figures on a typical purchase.
   */
  cashNeeded: number;
  /**
   * What the credit costs in total, and it is deliberately NOT called the
   * MTIC.
   *
   * The MTIC is a regulated disclosure with a fixed composition (montante
   * total do crédito + custo total do crédito), and the custo total includes
   * commissions and the life and multi-risk policies that every Portuguese
   * offer requires. This app knows none of those. A figure labelled MTIC that
   * sits systematically below the bank's MTIC would read as the bank
   * overcharging, so it is labelled as the minimum it is, and the UI names the
   * MTIC only to say what the difference consists of.
   */
  totalCredit: {
    capital: number;
    interest: number;
    /** Verba 17.1, paid at drawdown. */
    stampDutyCredit: number;
    /** Verba 17.3.1 — zero for own housing, and the UI says why. */
    stampDutyInterest: number;
    total: number;
  } | null;
  /** True when the LTV ceiling came from the state guarantee, not art. 5.º. */
  ltvFromGuarantee: boolean;
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
  costs: PurchaseCosts | null = null,
): LoanSummary {
  const maxLoan = Math.floor(result.maxLoan);
  const months = Math.round(result.termYears * 12);
  const contractRate = result.dsti.stressedRate - result.dsti.shock;
  const shocked = result.dsti.shock > 0;

  // Both instalments come from the engine and are only rescaled to the
  // floored amount. They are linear in the principal, so scaling is exact —
  // and recomputing them here from a rate would be wrong for taxa mista,
  // where the instalment paid and the instalment tested come from different
  // legs and different balances.
  const scale = result.maxLoan > 0 ? maxLoan / result.maxLoan : 0;
  const contractPayment = result.contractPayment * scale;
  const stressedPayment = result.stressedPayment * scale;
  const ltvFromGuarantee = result.ltv.source === "state-guarantee";

  const constraints: ConstraintRow[] = [
    {
      key: "dsti",
      label: "Rendimento (taxa de esforço)",
      amount: Math.floor(result.dsti.maxLoan),
      binding: result.bindingConstraint === "dsti",
      detail: result.dsti.mixedBasis
        ? `A prestação não pode passar ${percentLabel(
            result.dsti.limit,
          )} do rendimento. Sendo taxa mista, foi testada pela ${
            result.dsti.mixedBasis === "fixed-period"
              ? "prestação do período fixo, que é a mais alta"
              : `prestação depois do período fixo, com o indexante agravado em ${formatPoints(
                  result.dsti.shock,
                )}`
          }.`
        : shocked
        ? `A prestação, testada com uma subida de ${formatPoints(
            result.dsti.shock,
          )}, não pode passar ${percentLabel(result.dsti.limit)} do rendimento.`
        : `A prestação não pode passar ${percentLabel(
            result.dsti.limit,
          )} do rendimento. Sendo taxa fixa, é testada à taxa do próprio contrato.`,
      // Names the shock explicitly, because this is the row that produces the
      // "but my taxa de esforço is only 36 %" question: the ceiling is on the
      // stressed instalment, and without saying so the limit looks arbitrary.
      //
      // "Uma entrada maior não muda nada" is what this used to say, and it
      // contradicted the cash block directly underneath it. The deposit does
      // not move THIS ceiling — the bank will not lend more against a bigger
      // deposit when the income is what binds — but the reader in this
      // direction asked whether they can buy a specific house, and there the
      // deposit is exactly what closes the gap the same panel is quoting them.
      // The LTV row a few lines down already made that distinction; this one
      // did not. Say which quantity does not move, not "nothing".
      remedy: shocked
        ? `O teste não usa a prestação que vai pagar, mas uma agravada em ${formatPoints(
            result.dsti.shock,
          )} — e é essa que está nos 45 %. Uma entrada maior não aumenta o empréstimo, mas é ela que cobre a diferença até ao preço. Para subir o empréstimo: mais rendimento, menos encargos mensais, um prazo mais longo (se a idade permitir), ou taxa fixa, que não leva agravamento.`
        : "Uma entrada maior não altera este limite, mas é ela que cobre a diferença até ao preço. Para subir o empréstimo: mais rendimento, menos encargos mensais, ou um prazo mais longo (se a idade ainda o permitir).",
      reference: "bdp-1-2026",
    },
    {
      key: "ltv",
      label: "Valor do imóvel (LTV)",
      amount: Math.floor(result.ltv.maxLoan),
      binding: result.bindingConstraint === "ltv",
      detail: ltvFromGuarantee
        ? `Com a garantia do Estado, o banco pode financiar até ${percentLabel(
            result.ltv.limit,
          )} do imóvel — acima dos ${percentLabel(
            0.9,
          )} que o Banco de Portugal recomenda. É um desvio que cada banco decide, não um direito seu.`
        : `O banco não financia mais de ${percentLabel(
            result.ltv.limit,
          )} do imóvel.`,
      remedy: ltvFromGuarantee
        ? "Está a financiar 100 % com a garantia do Estado, o que já excede os 90 % que o Banco de Portugal recomenda. Acima disto não há folga: só um imóvel mais barato."
        : "Ganhar mais não altera este limite: a diferença para o preço tem de vir de capitais próprios. Um imóvel mais barato ou uma entrada maior é o que o move.",
      reference: ltvFromGuarantee ? "dl-44-2024" : "bdp-1-2026",
    },
  ];

  const binding = constraints.find((c) => c.binding) ?? constraints[0];
  const deposit = Math.max(0, propertyPrice - maxLoan);
  const cashNeeded = deposit + (costs?.upfrontTotal ?? 0);
  const totalInterest =
    maxLoan > 0 ? amortize(maxLoan, contractRate, months).totalInterest : 0;

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
    contractRate,
    shock: result.dsti.shock,
    rateType: result.dsti.rateType,
    mixedBasis: result.dsti.mixedBasis,
    shocked,
    adjustedIncome: result.dsti.adjustedIncome,
    incomeReduction: result.dsti.incomeReduction,
    totalInterest,
    costs,
    cashNeeded,
    totalCredit: costs
      ? {
          capital: maxLoan,
          interest: totalInterest,
          stampDutyCredit: costs.stampDutyCredit.amount,
          stampDutyInterest: costs.stampDutyInterest.amount,
          total:
            maxLoan +
            totalInterest +
            costs.stampDutyCredit.amount +
            costs.stampDutyInterest.amount,
        }
      : null,
    ltvFromGuarantee,
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

/** The reverse direction's summary: the same shape, plus the price it found. */
export interface PriceSummary extends LoanSummary {
  /** The most expensive property the income and the savings reach together. */
  maxPrice: number;
  savings: number;
  unusedFunds: number;
  /** Cash needed per extra euro of price, at the answer. */
  cashPerEuroOfPrice: number;
}

/**
 * Turn a `MaxPriceResult` into what the panel shows.
 *
 * Reuses `buildLoanSummary` on the inner forward answer rather than restating
 * it, so the two modes cannot drift apart, and then adds the one thing this
 * direction has that the other does not: a third ceiling, the borrower's own
 * savings. It belongs beside the other two because the remedy differs again —
 * more income, a cheaper house, or simply more time to save.
 */
export function buildPriceSummary(
  result: MaxPriceResult,
  monthlyIncome: number,
  existingMonthlyDebt = 0,
): PriceSummary {
  const summary = buildLoanSummary(
    result.loanResult,
    result.maxPrice,
    monthlyIncome,
    existingMonthlyDebt,
    result.costs,
  );

  const cashBinds = result.bindingConstraint === "cash";
  const constraints: ConstraintRow[] = [
    ...summary.constraints.map((row) => ({
      ...row,
      // The forward answer thinks in terms of a fixed price; here the price is
      // what moved, so the binding flag has to come from the price solver.
      binding: !cashBinds && row.key === result.bindingConstraint,
    })),
    {
      key: "cash",
      label: "Poupança disponível",
      amount: result.maxPrice,
      binding: cashBinds,
      detail: `A entrada e os impostos saem ambos do que tem de parte. Neste preço são ${Math.round(
        result.cashNeeded,
      ).toLocaleString("pt-PT")} € — entrada, mais IMT, selo e registos.`,
      // Which lever moves the price depends on what capped the LOAN, so the
      // remedy has to name that rather than repeating the row's own label.
      remedy:
        (result.loanResult.bindingConstraint === "dsti"
          ? `O rendimento trava o empréstimo em ${Math.round(
              result.loan,
            ).toLocaleString(
              "pt-PT",
            )} €, por isso tudo acima disso sai do seu bolso. `
          : "O banco financia até ao limite do valor do imóvel, e o resto sai do seu bolso. ") +
        `Cada 1 000 € que junte dá para cerca de ${(
          Math.round(1_000 / Math.max(result.cashPerEuroOfPrice, 1e-6) / 100) *
          100
        ).toLocaleString("pt-PT")} € de casa.`,
      reference: "cimt-17",
    },
  ];

  return {
    ...summary,
    constraints,
    binding: constraints.find((c) => c.binding) ?? constraints[0],
    maxPrice: result.maxPrice,
    savings: result.cashNeeded + result.unusedFunds,
    unusedFunds: result.unusedFunds,
    cashPerEuroOfPrice: result.cashPerEuroOfPrice,
  };
}
