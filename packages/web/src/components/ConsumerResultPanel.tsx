// The consumer-credit result.
//
// Deliberately shorter than the mortgage panel, because the answer is: there
// is no property, so no LTV, so the income ceiling is the only limit. Saying
// that plainly is more useful than borrowing the mortgage panel's
// which-constraint-binds machinery for a question with one constraint.

import type { ConsumerLoanInput, ConsumerLoanResult } from "@pt-finance-tools/engine";
import type { ConsumerOutcome } from "./ConsumerCalculator.js";
import { formatEuro, formatPercent, formatRate } from "../lib/format.js";
import { consumerSources } from "../lib/sources.js";
import { LawReference } from "./LawReference.js";
import { SourceList } from "./SourceList.js";

const KIND_LABEL: Record<string, string> = {
  personal: "crédito pessoal",
  auto: "crédito automóvel",
  "personal-earmarked": "crédito pessoal para educação, saúde ou energia",
};

interface ConsumerResultPanelProps {
  outcome: ConsumerOutcome | null;
  input: ConsumerLoanInput | null;
}

export function ConsumerResultPanel({ outcome, input }: ConsumerResultPanelProps) {
  return (
    <section className="panel result" aria-live="polite">
      <h2 className="visually-hidden">Resultado da simulação</h2>
      {outcome === null ? (
        <p className="result-empty">
          Introduza o rendimento mensal para ver quanto pode pedir.
        </p>
      ) : outcome.ok ? (
        <ConsumerResultBody result={outcome.result} input={input} />
      ) : (
        <p className="result-error" role="alert">
          {outcome.message}
        </p>
      )}
    </section>
  );
}

function ConsumerResultBody({
  result,
  input,
}: {
  result: ConsumerLoanResult;
  input: ConsumerLoanInput | null;
}) {
  // Floored to the euro for the same reason as the mortgage side: a ceiling
  // rounded up is a ceiling overstated.
  const scale = result.maxLoan > 0 ? Math.floor(result.maxLoan) / result.maxLoan : 0;
  const maxLoan = Math.floor(result.maxLoan);
  const payment = result.contractPayment * scale;
  const totalInterest = result.totalInterest * scale;
  const income = input?.borrower.monthlyIncome ?? 0;
  const existing = input?.borrower.existingMonthlyDebt ?? 0;

  return (
    <>
      <div className="result-headline">
        <p className="result-label">Pode pedir até</p>
        <p className="result-net num">{formatEuro(maxLoan)}</p>
        <p className="result-sub">
          prestação de <span className="num">{formatEuro(payment)}</span> por
          mês, a <span className="num">{result.termYears}</span> anos
        </p>
      </div>

      {input ? (
        <SourceList entries={consumerSources(result, input.assessmentDate)} />
      ) : null}

      <div className="callout">
        <p>
          <strong>Aqui só o rendimento o limita.</strong> Não há imóvel dado em
          garantia, por isso não existe limite de financiamento sobre um bem —
          o que manda é a taxa de esforço, e o prazo máximo que a finalidade do
          crédito permite.
        </p>
      </div>

      <dl className="lines">
        <div className="line is-deduction">
          <dt>
            Prestação mensal
            <span className="line-note">
              <span>
                {result.dsti.shock > 0
                  ? `À taxa do contrato. O teste de esforço usa ${formatPercent(
                      result.dsti.stressedRate,
                    )}.`
                  : "À taxa do contrato, fixa para todo o prazo — sem agravamento no teste de esforço, porque não há indexante que possa subir."}
              </span>
              <LawReference id="instrucao-23-2023" />
            </span>
          </dt>
          <dd className="num">{formatEuro(payment)}</dd>
        </div>

        <div className="line is-deduction">
          <dt>
            Taxa de esforço real
            <span className="line-note">
              <span>
                Esta prestação mais os outros créditos, sobre o rendimento.
              </span>
            </span>
          </dt>
          <dd className="num">
            {formatPercent(income > 0 ? (payment + existing) / income : 0)}
          </dd>
        </div>

        <div className="line is-deduction">
          <dt>
            Juros ao longo do contrato
            <span className="line-note">
              <span>
                {result.dsti.shock > 0
                  ? "Se a taxa se mantiver."
                  : "A taxa é fixa, por isso este valor não muda."}
              </span>
            </span>
          </dt>
          <dd className="num">{formatEuro(totalInterest)}</dd>
        </div>
      </dl>

      {result.termCappedByKind ? (
        <div className="callout">
          <p>
            O prazo foi reduzido para{" "}
            <span className="num">{result.termYears}</span> anos: é o máximo
            recomendado para {KIND_LABEL[result.kind]} (
            <LawReference id="bdp-1-2026-consumo" />
            ).
            {result.kind === "personal" ? (
              <>
                {" "}
                Para educação, saúde ou transição energética o prazo pode ir aos
                10 anos, se o banco comprovar a finalidade.
              </>
            ) : null}
          </p>
        </div>
      ) : null}

      {result.dsti.incomeReduction > 0 ? (
        <div className="callout">
          <p>
            O contrato passa dos 70 anos, por isso o rendimento considerado foi
            reduzido em{" "}
            <span className="num">
              {formatPercent(result.dsti.incomeReduction)}
            </span>
            . A redução é proporcional à parte do contrato vivida depois dos 70.
          </p>
        </div>
      ) : null}

      <div className="notices">
        <p>
          <strong>Estes limites são recomendações ao banco, não direitos.</strong>{" "}
          No crédito ao consumo, as taxas variam muito entre instituições e com
          o perfil de quem pede — a taxa por omissão aqui é a média do mercado (
          {formatRate(result.dsti.stressedRate - result.dsti.shock)} neste
          cálculo), não uma proposta.
        </p>
        <p>
          <strong>Simulação, não é aconselhamento.</strong>
        </p>
      </div>
    </>
  );
}
