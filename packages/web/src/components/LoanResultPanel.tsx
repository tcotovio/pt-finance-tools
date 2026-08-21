// The loan result: how much, what it costs, and — the part a borrower can
// actually act on — which of the two ceilings stopped them.
//
// Showing only the minimum would hide the useful half of the answer. Being
// capped by income and being capped by the property's value call for opposite
// responses, so the panel names the binding rule and says what moves it.

import type {
  EuriborSnapshot,
  MaxLoanInput,
  MaxLoanResult,
} from "@pt-finance-tools/engine";
import type { LoanOutcome } from "../lib/compute.js";
import { buildLoanSummary, type LoanSummary } from "../lib/loan-result.js";
import { formatEuro, formatPercent } from "../lib/format.js";
import { LawReference } from "./LawReference.js";
import { LoanLimitCurve } from "./LoanLimitCurve.js";
import { MarketComparison } from "./MarketComparison.js";
import { SourceList } from "./SourceList.js";
import { loanSources } from "../lib/sources.js";

interface LoanResultPanelProps {
  outcome: LoanOutcome | null;
  /** The engine input behind `outcome`, resampled by the limit curve. */
  input: MaxLoanInput | null;
  /** The index snapshot actually used, so the sources can cite its month. */
  euribor: EuriborSnapshot;
  propertyPrice: number;
  monthlyIncome: number;
  existingMonthlyDebt: number;
}

export function LoanResultPanel({
  outcome,
  input,
  euribor,
  propertyPrice,
  monthlyIncome,
  existingMonthlyDebt,
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
}: {
  result: MaxLoanResult;
  input: MaxLoanInput | null;
  euribor: EuriborSnapshot;
  propertyPrice: number;
  monthlyIncome: number;
  existingMonthlyDebt: number;
}) {
  const summary = buildLoanSummary(
    result,
    propertyPrice,
    monthlyIncome,
    existingMonthlyDebt,
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

      <ConstraintBars summary={summary} />

      <div className="callout">
        <p>
          {/* Not lower-cased: it would turn "LTV" into "ltv". */}
          <strong>O que o limita: {summary.binding.label}.</strong>{" "}
          {summary.binding.remedy}
        </p>
      </div>

      {input ? <LoanLimitCurve input={input} /> : null}

      {summary.maxLoan > 0 ? (
        <MarketComparison
          contractPayment={summary.contractPayment}
          contractRate={summary.stressedRate - summary.shock}
          rateType={summary.rateType}
        />
      ) : null}

      <dl className="lines">
        <div className="line is-earning">
          <dt>
            Entrada necessária
            <span className="line-note">
              <span>
                Preço menos o financiamento —{" "}
                {formatPercent(summary.depositShare)} do imóvel. Acresce o IMT,
                o imposto do selo e a escritura.
              </span>
            </span>
          </dt>
          <dd className="num">{formatEuro(summary.deposit)}</dd>
        </div>

        <div className="line is-deduction">
          <dt>
            Prestação mensal
            <span className="line-note">
              <span>
                {/* mista first: it is also "shocked", but its wording differs */}
                {summary.mixedBasis ? (
                  <>
                    A prestação do período fixo — a partir daí depende do
                    indexante. O teste de esforço usou{" "}
                    {formatEuro(summary.stressedPayment)}.
                  </>
                ) : summary.shocked ? (
                  <>
                    À taxa do contrato. O teste de esforço usa{" "}
                    {formatPercent(summary.stressedRate)} e daria{" "}
                    {formatEuro(summary.stressedPayment)}.
                  </>
                ) : (
                  <>À taxa do contrato, fixa para todo o prazo.</>
                )}
              </span>
              <LawReference id="instrucao-23-2023" />
            </span>
          </dt>
          <dd className="num">{formatEuro(summary.contractPayment)}</dd>
        </div>

        <div className="line is-deduction">
          <dt>
            Taxa de esforço real
            <span className="line-note">
              <span>
                Prestação (mais os outros créditos) sobre o rendimento, sem
                agravamento — o peso no orçamento, não o teste do regulador.
              </span>
            </span>
          </dt>
          <dd className="num">{formatPercent(summary.effortRate)}</dd>
        </div>

        <div className="line is-deduction">
          <dt>
            Juros ao longo do contrato
            <span className="line-note">
              <span>
                {summary.shocked
                  ? "Se a taxa se mantiver — o que em taxa variável não acontece."
                  : "A taxa é fixa, por isso este valor não muda ao longo do contrato."}
              </span>
            </span>
          </dt>
          <dd className="num">{formatEuro(summary.totalInterest)}</dd>
        </div>
      </dl>

      {summary.termCappedByAge ? (
        <div className="callout">
          <p>
            O prazo foi reduzido para{" "}
            <span className="num">{summary.termYears}</span> anos: acima dos 35
            anos de idade, o Banco de Portugal recomenda no máximo 35 (
            <LawReference id="bdp-1-2026" />
            ).
          </p>
        </div>
      ) : null}

      {summary.incomeReduction > 0 ? (
        <div className="callout">
          <p>
            O contrato passa dos 70 anos, por isso o rendimento considerado foi
            reduzido em{" "}
            <span className="num">{formatPercent(summary.incomeReduction)}</span>{" "}
            — para <span className="num">{formatEuro(summary.adjustedIncome)}</span>.
            A redução é proporcional à parte do contrato vivida depois dos 70,
            não uma penalização fixa.
          </p>
        </div>
      ) : null}

      <div className="notices">
        <p>
          <strong>Estes limites são recomendações ao banco, não direitos.</strong>{" "}
          Cada instituição aplica ainda os seus próprios critérios, e pode
          recusar um crédito que caiba nestes limites. Até 10 % do que cada
          banco empresta por semestre pode também ultrapassar a taxa de esforço
          de 45 %.
        </p>
        <p>
          <strong>Simulação, não é aconselhamento.</strong> Os valores reais
          dependem da taxa, do spread e da avaliação que o banco lhe propuser.
        </p>
      </div>

      {input ? (
        <SourceList entries={loanSources(result, input.assessmentDate, euribor)} />
      ) : null}
    </>
  );
}

/**
 * The two ceilings side by side, scaled to the larger one, with the binding
 * bar filled and the other outlined.
 *
 * Not a part-to-whole — these are two independent limits, and the answer is
 * the shorter bar. Identity never rests on the fill alone: the binding row is
 * labelled "limite aplicado" in text.
 */
function ConstraintBars({ summary }: { summary: LoanSummary }) {
  const scale = Math.max(...summary.constraints.map((c) => c.amount), 1);

  return (
    <figure className="constraints">
      <figcaption className="constraints-caption">
        Os dois limites, e qual deles manda
      </figcaption>
      <ul className="constraint-list">
        {summary.constraints.map((constraint) => (
          <li
            key={constraint.key}
            className={`constraint${constraint.binding ? " is-binding" : ""}`}
          >
            <div className="constraint-head">
              <span className="constraint-label">
                {constraint.label}
                {constraint.binding ? (
                  <span className="constraint-flag">limite aplicado</span>
                ) : null}
              </span>
              <span className="constraint-amount num">
                {formatEuro(constraint.amount)}
              </span>
            </div>
            <div
              className="constraint-track"
              role="img"
              aria-label={`${constraint.label}: ${formatEuro(constraint.amount)}`}
            >
              <div
                className="constraint-fill"
                style={{ inlineSize: `${(constraint.amount / scale) * 100}%` }}
              />
            </div>
            <p className="constraint-detail">
              {constraint.detail} <LawReference id={constraint.reference} />
            </p>
          </li>
        ))}
      </ul>
    </figure>
  );
}
