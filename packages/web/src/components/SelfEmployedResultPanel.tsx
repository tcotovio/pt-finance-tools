// What is left of the invoice, and where the rest went.
//
// The IVA line sits ABOVE the rule and the take-home below it, because the two
// are different kinds of number: what the client pays, then what of it is the
// worker's. Folding IVA into either side is the specific confusion this panel
// exists to undo.

import type { SelfEmployedResult } from "@pt-finance-tools/engine";
import type { SelfEmployedOutcome } from "./SelfEmployedCalculator.js";
import {
  formatEuro,
  formatNegativeEuro,
  formatPercent,
  formatRate,
} from "../lib/format.js";
import { selfEmployedSources } from "../lib/sources.js";
import { SourceList } from "./SourceList.js";

interface Props {
  outcome: SelfEmployedOutcome | null;
}

export function SelfEmployedResultPanel({ outcome }: Props) {
  return (
    <section className="panel result" aria-live="polite">
      <h2 className="visually-hidden">Resultado da simulação</h2>
      {outcome === null ? (
        <p className="result-empty">
          Introduza o valor que fatura por mês para ver quanto lhe fica.
        </p>
      ) : outcome.ok ? (
        <SelfEmployedResultBody result={outcome.result} />
      ) : (
        <p className="result-error" role="alert">
          {outcome.message}
        </p>
      )}
    </section>
  );
}

/**
 * A euro figure that may legitimately be negative — the take-home, when the
 * contribution outruns the invoice.
 *
 * `formatEuro` renders that with Intl's ASCII hyphen, where every deduction
 * line in the app uses a real minus sign. Routing both through
 * `formatNegativeEuro` keeps one character for one meaning in a single column.
 */
function formatSigned(value: number): string {
  return value < 0 ? formatNegativeEuro(value) : formatEuro(value);
}

const DISPENSA_REASON: Record<string, string> = {
  "annual-threshold": "dispensada — prevê faturar menos de 15 000 € no ano",
  client: "não há retenção a clientes particulares",
  "below-minimum": "abaixo de 25 €, por isso não é retida",
};

function SelfEmployedResultBody({ result }: { result: SelfEmployedResult }) {
  const { contribution, retention, vat } = result;

  return (
    <>
      <div className="result-headline">
        <p className="result-label">
          {result.net < 0 ? "Este mês fica a dever" : "Fica para si"}
        </p>
        <p className={`result-net num${result.net < 0 ? " is-negative" : ""}`}>
          {/*
            formatNegativeEuro for the negative case, so the headline uses the
            same real minus sign as the deduction lines rather than the ASCII
            hyphen Intl produces. Two different characters for one meaning in
            one column reads as a rendering fault.
          */}
          {formatSigned(result.net)}
        </p>
        <p className="result-sub">
          de <span className="num">{formatEuro(result.invoiced)}</span> faturados
          {/*
            The share kept is only meaningful when something is kept. "Fica com
            −42,8 %" is not a share of anything, so the negative month gets the
            sentence that actually explains it instead.
          */}
          {result.invoiced > 0 && result.net >= 0 ? (
            <>
              {" "}
              · fica com{" "}
              <span className="num">
                {formatPercent(result.effectiveRate)}
              </span>
            </>
          ) : null}
          {result.net < 0 ? " · a contribuição excede o que faturou" : null}
        </p>
      </div>

      <dl className="lines">
        {!vat.exempt ? (
          <>
            <div className="line is-additive">
              <dt>
                IVA cobrado ao cliente
                <span className="line-note">
                  <span>
                    Passa pela sua conta e é entregue ao Estado — nunca foi seu.
                  </span>
                </span>
              </dt>
              <dd className="num">{formatEuro(vat.amount)}</dd>
            </div>
            <div className="line">
              <dt>O cliente paga</dt>
              <dd className="num">{formatEuro(vat.invoiceTotal)}</dd>
            </div>
          </>
        ) : null}

        <div className="line">
          <dt>
            Faturado
            <span className="line-note">
              <span>
                {vat.exempt
                  ? "Isento de IVA ao abrigo do artigo 53.º."
                  : "Sem IVA — é sobre este valor que incidem a retenção e a contribuição."}
              </span>
            </span>
          </dt>
          <dd className="num">{formatEuro(result.invoiced)}</dd>
        </div>

        <div className="line is-deduction">
          <dt>
            Retenção na fonte
            <span className="line-note">
              <span>
                {retention.dispensed
                  ? `À taxa de ${formatRate(retention.rate)}, ${
                      DISPENSA_REASON[retention.dispensaReason ?? ""] ?? ""
                    }.`
                  : `${formatRate(retention.rate)} sobre o faturado.`}
              </span>
            </span>
          </dt>
          {/*
            formatNegativeEuro, not a hand-written minus: a dispensed retention
            is legitimately zero, and "−0,00 €" reads as a rendering fault
            rather than as "nothing was withheld".
          */}
          <dd className="num">{formatNegativeEuro(retention.amount)}</dd>
        </div>

        <div className="line is-deduction">
          <dt>
            Segurança Social
            <span className="line-note">
              <span>
                {contribution.deferred
                  ? "Ainda não é devida: no primeiro ano de atividade a obrigação só começa no 12.º mês."
                  : contribution.atMinimum
                    ? "O mínimo de 20 € por mês, que é devido mesmo sem faturação."
                    : `${formatRate(contribution.rate)} sobre ${formatEuro(
                        contribution.base,
                      )} — ${formatRate(
                        contribution.coefficient,
                      )} do trimestre, a dividir por três.`}
              </span>
            </span>
          </dt>
          <dd className="num">{formatNegativeEuro(contribution.amount)}</dd>
        </div>

        <div className="line is-total">
          <dt>{result.net < 0 ? "Fica a dever" : "Fica para si"}</dt>
          <dd className="num">{formatSigned(result.net)}</dd>
        </div>
      </dl>

      {result.net < 0 ? (
        <div className="callout">
          <p>
            Este mês fica negativo: a Segurança Social é calculada sobre o
            trimestre anterior, por isso continua a ser devida mesmo quando a
            faturação cai. É a razão pela qual convém guardar parte dos meses
            bons.
          </p>
        </div>
      ) : null}

      {contribution.cappedByCeiling ? (
        <div className="callout">
          <p>
            A base de incidência foi limitada ao máximo de 12 × IAS (
            <span className="num">{formatEuro(contribution.base)}</span>). Acima
            deste valor a contribuição não sobe mais.
          </p>
        </div>
      ) : null}

      {contribution.accumulationRelief > 0 ? (
        <div className="callout">
          <p>
            Por acumular com trabalho por conta de outrem, só contribui sobre a
            parte que excede 4 × IAS —{" "}
            <span className="num">
              {formatEuro(contribution.accumulationRelief)}
            </span>{" "}
            ficaram de fora da base.
          </p>
        </div>
      ) : null}

      {/*
        Never collapsed. §9's rule, and it bites harder here than anywhere else
        in the app: the contribution figure is conditional on an assumption the
        user did not make explicitly, and burying that would be presenting a
        guess as a calculation.
      */}
      <div className="notices">
        {contribution.quarterAssumed ? (
          <p>
            <strong>A Segurança Social aqui assume faturação estável.</strong> A
            contribuição real deste mês é calculada sobre o trimestre anterior,
            não sobre o que fatura agora — se os últimos três meses foram
            diferentes, indique-os em "O meu caso" para ter o valor certo.
          </p>
        ) : (
          <p>
            <strong>A contribuição é a do trimestre que indicou.</strong> É
            fixada por três meses, por isso mantém-se mesmo que a faturação
            deste mês mude.
          </p>
        )}
        <p>
          <strong>A retenção não é o imposto final.</strong> É um adiantamento
          por conta do IRS. No regime simplificado só uma parte do que fatura é
          tributada, por isso o acerto anual costuma devolver parte do retido —
          e é também na declaração anual que o IRS Jovem se pede, não aqui.
        </p>
        <p>
          <strong>Simulação, não é aconselhamento.</strong> Não cobra IVA
          trimestral, contabilidade organizada, nem despesas dedutíveis.
          Confirme com o seu contabilista ou na Segurança Social Direta.
        </p>
      </div>

      <SourceList entries={selfEmployedSources(result)} />
    </>
  );
}
