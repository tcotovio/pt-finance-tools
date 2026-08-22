// The pieces both result panels are built from.
//
// The panel used to be one unbroken column: headline, two ceiling bars, a full
// line chart, the market comparison, a table of lines, three caveats and the
// sources. Adding the taxes made it longer still, and the most useful block in
// it — how the borrower's own rate compares with the market — was fifth,
// under a chart, wearing the same heading style as a form sub-group label.
//
// So the answer and everything that qualifies it stay open, and the working
// goes behind three disclosures built on the existing "O meu caso" pattern.
// The exception is deliberate and is a rule of this project rather than a
// judgement call: the `.notices` block never collapses. A caveat behind a
// disclosure is not a caveat.

import type { ReactNode } from "react";
import { formatEuro, formatPercent } from "../lib/format.js";
import type { LoanSummary } from "../lib/loan-result.js";
import { LawReference } from "./LawReference.js";

/** A collapsed block of working, styled on the `.advanced` disclosure. */
export function ResultSection({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <details className="result-section">
      <summary>
        <span className="advanced-title">{title}</span>
        <span className="advanced-sub">{summary}</span>
      </summary>
      <div className="result-section-body">{children}</div>
    </details>
  );
}

/**
 * The ceilings side by side, scaled to the largest, with the binding one
 * filled and the rest outlined.
 *
 * Not a part-to-whole — these are independent limits and the answer is the
 * shortest bar. Identity never rests on the fill alone: the binding row is
 * labelled "limite aplicado" in text.
 */
export function ConstraintBars({ summary }: { summary: LoanSummary }) {
  const scale = Math.max(...summary.constraints.map((c) => c.amount), 1);

  return (
    <figure className="constraints">
      <figcaption className="constraints-caption">
        Os limites, e qual deles manda
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

/**
 * The cash summary: what has to be in the account on the day of the deed.
 *
 * This replaces a line that showed only the deposit and added, in prose, that
 * "o IMT, o imposto do selo e a escritura acrescem". On a 250 000 € purchase
 * those come to roughly 8 000 €, so the old line understated the requirement
 * by about a third of a year's savings.
 */
export function CashSummary({ summary }: { summary: LoanSummary }) {
  const costs = summary.costs;

  return (
    <div className="cash-summary">
      <div className="cash-head">
        <span className="cash-label">Precisa de ter</span>
        <span className="cash-total num">{formatEuro(summary.cashNeeded)}</span>
      </div>
      <ul className="cash-parts">
        <li>
          <span>
            Entrada <span className="cash-note">
              {formatPercent(summary.depositShare)} do imóvel
            </span>
          </span>
          <span className="num">{formatEuro(summary.deposit)}</span>
        </li>
        {costs ? (
          <li>
            <span>Impostos, escritura e registos</span>
            <span className="num">{formatEuro(costs.upfrontTotal)}</span>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

/** The itemised taxes, with each zero explained rather than left blank. */
export function PurchaseCostLines({ summary }: { summary: LoanSummary }) {
  const costs = summary.costs;
  if (!costs) return null;

  const jovem = costs.imt.table === "young-own-permanent-residence";
  // The price on screen is deposit + loan; when the tax fell on something
  // larger, it fell on the VPT (CIMT art. 12.º) and the note should say so.
  const taxedOnVpt = costs.taxableValue > summary.deposit + summary.maxLoan;

  return (
    <dl className="lines">
      <div className="line is-deduction">
        <dt>
          IMT
          <span className="line-note">
            <span>
              {costs.imt.exempt
                ? "Isento: é a primeira habitação própria e permanente, e o valor não passa o topo do 1.º escalão da tabela dos jovens."
                : costs.imt.deduct > 0
                  ? `${formatPercent(costs.imt.rate)} sobre ${formatEuro(
                      costs.taxableValue,
                    )}, menos a parcela a abater de ${formatEuro(
                      costs.imt.deduct,
                    )}.`
                  : `Taxa única de ${formatPercent(
                      costs.imt.rate,
                    )} sobre ${formatEuro(
                      costs.taxableValue,
                    )} — nos escalões de topo a taxa incide sobre o valor todo, não só sobre o excedente.`}
              {taxedOnVpt
                ? " Incide sobre o valor patrimonial tributário, por este ser superior ao preço."
                : ""}
            </span>
            <LawReference id={jovem ? "cimt-9" : "cimt-17"} />
          </span>
        </dt>
        <dd className="num">{formatEuro(costs.imt.amount)}</dd>
      </div>

      <div className="line is-deduction">
        <dt>
          Imposto do selo — compra
          <span className="line-note">
            <span>
              0,8 % sobre {formatEuro(costs.taxableValue)}
              {costs.stampDutyTransfer.youngDeduction > 0
                ? `, menos a dedução de ${formatEuro(
                    costs.stampDutyTransfer.youngDeduction,
                  )} para jovens (limite ${formatEuro(
                    costs.stampDutyTransfer.youngDeductionCap,
                  )}).`
                : "."}
            </span>
            <LawReference
              id={
                costs.stampDutyTransfer.youngDeduction > 0
                  ? "cis-7a"
                  : "cis-tgis"
              }
            />
          </span>
        </dt>
        <dd className="num">{formatEuro(costs.stampDutyTransfer.amount)}</dd>
      </div>

      <div className="line is-deduction">
        <dt>
          Imposto do selo — crédito
          <span className="line-note">
            <span>
              Verba {costs.stampDutyCredit.verba}:{" "}
              {formatPercent(costs.stampDutyCredit.rate)} sobre o capital, pago
              na utilização do crédito.
            </span>
            <LawReference id="cis-tgis" />
          </span>
        </dt>
        <dd className="num">{formatEuro(costs.stampDutyCredit.amount)}</dd>
      </div>

      <div className="line is-deduction">
        <dt>
          Escritura e registos
          <span className="line-note">
            <span>
              Balcão único (Casa Pronta), com escritura e registos num só ato.
              {costs.registration.youngReduction > 0
                ? ` Reduzido em ${formatEuro(
                    costs.registration.youngReduction,
                  )} por ser a primeira casa até aos 35 anos — é uma redução, não uma isenção.`
                : " É um valor mínimo: notário e registos em separado custam mais."}
            </span>
            <LawReference
              id={
                costs.registration.youngReduction > 0
                  ? "dl-48d-2024"
                  : "casa-pronta"
              }
            />
          </span>
        </dt>
        <dd className="num">{formatEuro(costs.registration.amount)}</dd>
      </div>

      {costs.bankFees > 0 ? (
        <div className="line is-deduction">
          <dt>
            Comissões do banco
            <span className="line-note">
              <span>O valor que indicou. Nenhuma lei o fixa.</span>
            </span>
          </dt>
          <dd className="num">{formatEuro(costs.bankFees)}</dd>
        </div>
      ) : null}

      <div className="line is-total">
        <dt>Total a pagar na escritura</dt>
        <dd className="num">{formatEuro(costs.upfrontTotal)}</dd>
      </div>
    </dl>
  );
}

/**
 * What the credit costs over its life — and why this is not called the MTIC.
 *
 * The MTIC is a regulated disclosure whose composition is fixed, and it
 * includes the commissions and the life and multi-risk policies that this app
 * cannot know. A number labelled MTIC that sits below the bank's MTIC would
 * read as the bank overcharging, so the figure is named as the minimum it is
 * and the MTIC is named only to say what the gap consists of.
 */
export function TotalCreditLines({ summary }: { summary: LoanSummary }) {
  const total = summary.totalCredit;
  if (!total) return null;

  return (
    <dl className="lines">
      <div className="line">
        <dt>Capital</dt>
        <dd className="num">{formatEuro(total.capital)}</dd>
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
        <dd className="num">{formatEuro(total.interest)}</dd>
      </div>
      <div className="line is-deduction">
        <dt>Imposto do selo sobre o capital</dt>
        <dd className="num">{formatEuro(total.stampDutyCredit)}</dd>
      </div>
      {summary.costs?.stampDutyInterest.exempt ? (
        <div className="line">
          <dt>
            Imposto do selo sobre os juros
            <span className="line-note">
              <span>{summary.costs.stampDutyInterest.reason}</span>
              <LawReference id="cis-7-1-l" />
            </span>
          </dt>
          <dd className="num">isento</dd>
        </div>
      ) : (
        <div className="line is-deduction">
          <dt>
            Imposto do selo sobre os juros
            <span className="line-note">
              <span>{summary.costs?.stampDutyInterest.reason}</span>
              <LawReference id="cis-7-1-l" />
            </span>
          </dt>
          <dd className="num">{formatEuro(total.stampDutyInterest)}</dd>
        </div>
      )}
      <div className="line is-total">
        <dt>Custo total mínimo do crédito</dt>
        <dd className="num">{formatEuro(total.total)}</dd>
      </div>
      <p className="chart-note">
        <strong>Não é o MTIC da FINE.</strong> O montante total imputado ao
        consumidor inclui ainda o seguro de vida, o multirriscos e as comissões
        do banco — que dependem de si e da proposta, e que esta simulação não
        pode calcular. O valor acima é o mínimo, não a estimativa.
      </p>
    </dl>
  );
}

/** The caveats. Always open, on purpose. */
export function LoanNotices({ summary }: { summary: LoanSummary }) {
  return (
    <div className="notices">
      {summary.ltvFromGuarantee ? (
        <p>
          <strong>Este financiamento excede a recomendação do Banco de Portugal.</strong>{" "}
          Os 90 % do art. 5.º não têm exceção para crédito garantido: financiar
          a totalidade é um desvio que a instituição justifica caso a caso, com
          a fiança do Estado a cobrir 15 %. Contar com ele é contar com uma
          decisão do banco, não com um direito.
        </p>
      ) : null}
      <p>
        <strong>Estes limites são recomendações ao banco, não direitos.</strong>{" "}
        Cada instituição aplica ainda os seus próprios critérios, e pode
        recusar um crédito que caiba nestes limites. Até 10 % do que cada banco
        empresta por semestre pode também ultrapassar a taxa de esforço de
        45 %.
      </p>
      <p>
        <strong>Simulação, não é aconselhamento.</strong> Os valores reais
        dependem da taxa, do spread e da avaliação que o banco lhe propuser.
      </p>
    </div>
  );
}

/** The conditional callouts about this particular answer. Also always open. */
export function LoanCaveats({ summary }: { summary: LoanSummary }) {
  return (
    <>
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
    </>
  );
}
