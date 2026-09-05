// The reverse direction's result: the most expensive house the borrower's
// income and savings reach together.
//
// Structurally the same panel as the forward one, and deliberately so — the
// answer, the sentence that explains it, the cash, the caveats, then the
// working behind disclosures. What differs is the headline (a price rather
// than a loan) and a third ceiling: the savings themselves, which is very
// often the one that actually binds and which the forward direction had no
// way to express.

import { nextImtStepForDate } from "@pt-finance-tools/engine";
import type {
  EuriborSnapshot,
  MaxPriceInput,
  MaxPriceResult,
} from "@pt-finance-tools/engine";
import type { MaxPriceOutcome } from "../lib/compute.js";
import { buildPriceSummary } from "../lib/loan-result.js";
import { formatEuro } from "../lib/format.js";
import { AmortizationSplit } from "./AmortizationSplit.js";
import { CashShortfall } from "./CashShortfall.js";
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

interface PriceResultPanelProps {
  outcome: MaxPriceOutcome | null;
  assessmentDate: string;
  euribor: EuriborSnapshot;
  monthlyIncome: number;
  existingMonthlyDebt: number;
  /** What the buyer has of their own — needed to quantify a shortfall. */
  savings: number;
  /** The engine input, resampled to show what more savings would buy. */
  priceInput: MaxPriceInput | null;
}

export function PriceResultPanel({
  outcome,
  assessmentDate,
  euribor,
  monthlyIncome,
  existingMonthlyDebt,
  savings,
  priceInput,
}: PriceResultPanelProps) {
  return (
    <section className="panel result" aria-live="polite">
      <h2 className="visually-hidden">Resultado da simulação</h2>
      {outcome === null ? (
        <p className="result-empty">
          Introduza o rendimento e o que tem de parte para ver até quanto pode
          comprar.
        </p>
      ) : outcome.ok ? (
        <PriceResultBody
          result={outcome.result}
          assessmentDate={assessmentDate}
          euribor={euribor}
          monthlyIncome={monthlyIncome}
          existingMonthlyDebt={existingMonthlyDebt}
          savings={savings}
          priceInput={priceInput}
        />
      ) : (
        <p className="result-error" role="alert">
          {outcome.message}
        </p>
      )}
    </section>
  );
}

function PriceResultBody({
  result,
  assessmentDate,
  euribor,
  monthlyIncome,
  existingMonthlyDebt,
  savings,
  priceInput,
}: {
  result: MaxPriceResult;
  savings: number;
  priceInput: MaxPriceInput | null;
  assessmentDate: string;
  euribor: EuriborSnapshot;
  monthlyIncome: number;
  existingMonthlyDebt: number;
}) {
  const summary = buildPriceSummary(result, monthlyIncome, existingMonthlyDebt);

  // The IMT boundary immediately above the answer, when there is one. Read
  // here rather than inside LeftoverNote so the panel keeps one place where
  // engine values are gathered.
  const imtStep = priceInput
    ? nextImtStepForDate({
        price: summary.maxPrice,
        purpose: priceInput.purpose,
        region: priceInput.region,
        youngFirstHome: priceInput.youngFirstHome,
        assessmentDate,
      })
    : null;

  if (summary.maxPrice <= 0) {
    // "Not possible" on its own tells the reader nothing they can act on. The
    // engine already knows the cash the purchase needs and what they have, so
    // the panel says how far short they are and what the money is for.
    return (
      <>
        <CashShortfall result={result} savings={savings} input={priceInput} />
        <LoanNotices summary={summary} />
      </>
    );
  }

  return (
    <>
      <div className="result-headline">
        <p className="result-label">Pode comprar até</p>
        <p className="result-net num">{formatEuro(summary.maxPrice)}</p>
        <p className="result-sub">
          empréstimo de{" "}
          <span className="num">{formatEuro(summary.maxLoan)}</span>, prestação
          de <span className="num">{formatEuro(summary.contractPayment)}</span>{" "}
          por mês a <span className="num">{summary.termYears}</span> anos
        </p>
      </div>

      {/*
        Not "O que o limita: …" as the forward direction says it. There the
        answer varies; here it cannot. This solver raises the price until the
        cash runs out, so the cash is always what stops it — naming that as
        though it were a finding tells the reader nothing and hides the part
        that does vary, which is the ceiling on the loan underneath. The
        remedy already names that, so the heading gets out of its way.
      */}
      <div className="callout">
        <p>
          <strong>É o que tem de parte que fixa o preço.</strong>{" "}
          {summary.binding.remedy}
        </p>
      </div>

      <CashSummary summary={summary} />

      {/*
        The sensitivity ("cada 1 000 € que junte dá para…") lives in the
        binding callout above, and saying it twice with two different
        roundings — which is what happened here first — reads as two different
        numbers rather than one.
      */}
      <LeftoverNote
        unusedFunds={summary.unusedFunds}
        maxPrice={summary.maxPrice}
        step={imtStep}
      />

      <LoanCaveats summary={summary} />

      <ResultSection
        title="Como se compara com o mercado"
        summary="A sua prestação e a sua taxa, face aos dados do Banco de Portugal"
      >
        <MarketComparison
          contractPayment={summary.contractPayment}
          contractRate={summary.stressedRate - summary.shock}
          rateType={summary.rateType}
        />
      </ResultSection>

      <ResultSection
        title="Até onde chega cada limite"
        summary="Rendimento, valor do imóvel e poupança, lado a lado"
      >
        <ConstraintBars summary={summary} showBinding={false} />
        <p className="chart-note">
          As barras mostram o <strong>empréstimo</strong> que cada limite
          permitiria, excepto a da poupança, que mostra o{" "}
          <strong>preço</strong> a que ela chega — é essa a grandeza que este
          modo procura.
        </p>
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

      <SourceList
        entries={loanSources(
          result.loanResult,
          assessmentDate,
          euribor,
          result.costs,
        )}
      />
    </>
  );
}

/**
 * What is left of the savings, and why it could not be spent.
 *
 * The old note fired from one euro up and explained itself with "aqui o que
 * trava não é o dinheiro". Both halves were wrong.
 *
 * A euro or two is the solver converging, not a finding: across a 32 256-case
 * sweep the leftovers cluster under 10 € or above 1 000 € with nothing in
 * between, so the threshold sits in that gap and reports only the second kind.
 *
 * And when the leftover IS large, money is exactly what stops the buyer. IMT's
 * taxa única applies to the whole price, so at the boundary the tax steps —
 * 17 263 € for one euro of price in continente. The search halts one euro
 * below with money it cannot use, and the panel's own callout says "o que o
 * limita: poupança disponível" two blocks above. Saying the opposite here was
 * a contradiction on one screen.
 */
const LEFTOVER_FLOOR = 100;

function LeftoverNote({
  unusedFunds,
  maxPrice,
  step,
}: {
  unusedFunds: number;
  maxPrice: number;
  step: { threshold: number; increase: number } | null;
}) {
  if (unusedFunds < LEFTOVER_FLOOR) return null;

  // Only the boundary that actually stopped the search explains anything. A
  // step half a million euros further up is true and irrelevant.
  const atBoundary = step !== null && step.threshold - maxPrice <= 2;

  return (
    <p className="chart-note">
      Sobram-lhe{" "}
      <span className="num">{formatEuro(unusedFunds)}</span> do que tem de
      parte
      {atBoundary && step ? (
        <>
          , e não chegam para subir de escalão: a partir de{" "}
          <span className="num">{formatEuro(step.threshold)}</span> o IMT passa
          a ser cobrado sobre o valor todo a uma taxa mais alta, o que custa{" "}
          <span className="num">{formatEuro(step.increase)}</span> de uma só
          vez.
        </>
      ) : (
        <>: aqui o que trava não é o dinheiro.</>
      )}
    </p>
  );
}
