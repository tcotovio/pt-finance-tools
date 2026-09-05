// The loan result: how much, what it costs to get there, and — the part a
// borrower can actually act on — which of the ceilings stopped them.
//
// Showing only the minimum would hide the useful half of the answer. Being
// capped by income and being capped by the property's value call for opposite
// responses, so the panel names the binding rule and says what moves it.
//
// The working now sits behind three disclosures (see LoanSections.tsx). What
// stays open is the answer, the one sentence that explains it, the cash the
// buyer has to produce, and every caveat.

import type {
  EuriborSnapshot,
  MaxLoanInput,
  MaxLoanResult,
  PurchaseCosts,
} from "@pt-finance-tools/engine";
import type { LoanOutcome } from "../lib/compute.js";
import { buildLoanSummary, type LoanSummary } from "../lib/loan-result.js";
import { formatEuro } from "../lib/format.js";
import { AmortizationSplit } from "./AmortizationSplit.js";
import { LoanLimitCurve } from "./LoanLimitCurve.js";
import { MarketComparison } from "./MarketComparison.js";
import { SourceList } from "./SourceList.js";
import { loanSources } from "../lib/sources.js";
import {
  CashSummary,
  EffortLines,
  ConstraintBars,
  LoanCaveats,
  LoanNotices,
  PurchaseCostLines,
  ResultSection,
  TotalCreditLines,
} from "./LoanSections.js";

interface LoanResultPanelProps {
  outcome: LoanOutcome | null;
  /** The engine input behind `outcome`, resampled by the limit curve. */
  input: MaxLoanInput | null;
  /** The index snapshot actually used, so the sources can cite its month. */
  euribor: EuriborSnapshot;
  propertyPrice: number;
  monthlyIncome: number;
  existingMonthlyDebt: number;
  /** What the buyer says they have, for the cross-check callout. Optional. */
  savings: number;
  costs: PurchaseCosts | null;
}

export function LoanResultPanel({
  outcome,
  input,
  euribor,
  propertyPrice,
  monthlyIncome,
  existingMonthlyDebt,
  savings,
  costs,
}: LoanResultPanelProps) {
  return (
    <section className="panel result" aria-live="polite">
      <h2 className="visually-hidden">Resultado da simulação</h2>
      {outcome === null ? (
        <p className="result-empty">
          Introduza o rendimento e o preço do imóvel para ver quanto pode
          pedir.
        </p>
      ) : outcome.ok ? (
        <LoanResultBody
          result={outcome.result}
          input={input}
          euribor={euribor}
          propertyPrice={propertyPrice}
          monthlyIncome={monthlyIncome}
          existingMonthlyDebt={existingMonthlyDebt}
          savings={savings}
          costs={costs}
        />
      ) : (
        <p className="result-error" role="alert">
          {outcome.message}
        </p>
      )}
    </section>
  );
}

function LoanResultBody({
  result,
  input,
  euribor,
  propertyPrice,
  monthlyIncome,
  existingMonthlyDebt,
  savings,
  costs,
}: {
  result: MaxLoanResult;
  input: MaxLoanInput | null;
  euribor: EuriborSnapshot;
  propertyPrice: number;
  monthlyIncome: number;
  existingMonthlyDebt: number;
  savings: number;
  costs: PurchaseCosts | null;
}) {
  const summary = buildLoanSummary(
    result,
    propertyPrice,
    monthlyIncome,
    existingMonthlyDebt,
    costs,
  );

  return (
    <>
      <div className="result-headline">
        <p className="result-label">Pode pedir até</p>
        <p className="result-net num">{formatEuro(summary.maxLoan)}</p>
        <p className="result-sub">
          prestação de{" "}
          <span className="num">{formatEuro(summary.contractPayment)}</span> por
          mês, a <span className="num">{summary.termYears}</span> anos
        </p>
      </div>

      <div className="callout">
        <p>
          {/* Not lower-cased: it would turn "LTV" into "ltv". */}
          <strong>O que o limita: {summary.binding.label}.</strong>{" "}
          {summary.binding.remedy}
        </p>
      </div>

      <CashSummary summary={summary} />

      {savings > 0 ? <SavingsCheck summary={summary} savings={savings} /> : null}

      <LoanCaveats summary={summary} />

      <ResultSection
        title="Como se compara com o mercado"
        summary="A sua prestação e a sua taxa, face aos dados do Banco de Portugal"
      >
        {summary.maxLoan > 0 ? (
          <MarketComparison
            contractPayment={summary.contractPayment}
            contractRate={summary.stressedRate - summary.shock}
            rateType={summary.rateType}
          />
        ) : null}
      </ResultSection>

      <ResultSection
        title="Os limites, e qual deles manda"
        summary="Rendimento e valor do imóvel, e como mudam com o prazo"
      >
        <ConstraintBars summary={summary} />
        {input ? <LoanLimitCurve input={input} /> : null}
      </ResultSection>

      <ResultSection
        title="Todos os meses"
        summary="A prestação, e as duas taxas de esforço"
        value={`${formatEuro(summary.contractPayment)}/mês`}
      >
        <EffortLines summary={summary} />
      </ResultSection>

      {summary.costs ? (
        <ResultSection
          title="Na escritura"
          summary="IMT, imposto do selo, escritura e registos"
          value={formatEuro(summary.costs.upfrontTotal)}
        >
          <PurchaseCostLines summary={summary} />
        </ResultSection>
      ) : null}

      {summary.totalCredit ? (
        <ResultSection
          title="Ao longo do contrato"
          summary="Quanto do que paga é capital, e quanto são juros"
          value={formatEuro(summary.totalCredit.total)}
        >
          <AmortizationSplit summary={summary} />
          <TotalCreditLines summary={summary} />
        </ResultSection>
      ) : null}

      <LoanNotices summary={summary} />

      {input ? (
        <SourceList
          entries={loanSources(result, input.assessmentDate, euribor, costs)}
        />
      ) : null}
    </>
  );
}

/**
 * Whether what the buyer has actually covers what the answer demands.
 *
 * The forward direction never used to ask, so a user could be shown a loan
 * they qualified for and a deposit they could not raise, with nothing on
 * screen connecting the two.
 */
function SavingsCheck({
  summary,
  savings,
}: {
  summary: LoanSummary;
  savings: number;
}) {
  const shortfall = summary.cashNeeded - savings;
  return (
    <div className="callout">
      <p>
        {shortfall > 0 ? (
          <>
            <strong>Faltam-lhe {formatEuro(shortfall)}.</strong> Indicou{" "}
            <span className="num">{formatEuro(savings)}</span> de parte, e esta
            compra precisa de{" "}
            <span className="num">{formatEuro(summary.cashNeeded)}</span> entre
            entrada e impostos. Mude para «Ainda não tenho casa» para ver que
            preço é que esse valor alcança.
          </>
        ) : (
          <>
            <strong>Chega, e sobram {formatEuro(-shortfall)}.</strong> Indicou{" "}
            <span className="num">{formatEuro(savings)}</span> de parte, contra{" "}
            <span className="num">{formatEuro(summary.cashNeeded)}</span> de
            entrada e impostos.
          </>
        )}
      </p>
    </div>
  );
}
