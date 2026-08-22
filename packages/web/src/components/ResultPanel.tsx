// The result: one headline number, a payslip-style breakdown, and the
// caveats that make the number honest.

import type { WageInput, WageResult } from "@pt-finance-tools/engine";
import { buildBreakdown } from "../lib/breakdown.js";
import type { BreakdownLine } from "../lib/breakdown.js";
import type { ComputeOutcome } from "../lib/compute.js";
import { EmployerCost } from "./EmployerCost.js";
import { WageRateCurve } from "./WageRateCurve.js";
import { WageComparison } from "./WageComparison.js";
import { GrossSplitChart } from "./GrossSplitChart.js";
import { LawReference } from "./LawReference.js";
import { SourceList } from "./SourceList.js";
import { wageSources } from "../lib/sources.js";
import {
  formatEuro,
  formatNegativeEuro,
  formatPercent,
  formatPositiveEuro,
} from "../lib/format.js";

interface ResultPanelProps {
  outcome: ComputeOutcome | null;
  /** The engine input behind `outcome`, resampled by the rate curve. */
  input: WageInput | null;
}

export function ResultPanel({ outcome, input }: ResultPanelProps) {
  return (
    <section className="panel result" aria-live="polite">
      <h2 className="visually-hidden">Resultado da simulação</h2>
      {outcome === null ? (
        <p className="result-empty">
          Introduza o vencimento base para ver o líquido mensal e a sua
          decomposição.
        </p>
      ) : outcome.ok ? (
        <ResultBody result={outcome.result} input={input} />
      ) : (
        <p className="result-error" role="alert">
          {outcome.message}
        </p>
      )}
    </section>
  );
}

function formatLine(line: BreakdownLine): string {
  if (line.kind === "deduction") return formatNegativeEuro(line.amount);
  if (line.kind === "credit" || line.additive) {
    return formatPositiveEuro(line.amount);
  }
  return formatEuro(line.amount);
}

function ResultBody({
  result,
  input,
}: {
  result: WageResult;
  input: WageInput | null;
}) {
  const breakdown = buildBreakdown(result);

  return (
    <>
      <div className="result-headline">
        <p className="result-label">Salário líquido mensal</p>
        <p className="result-net num">{formatEuro(breakdown.net)}</p>
        <p className="result-sub">
          de <span className="num">{formatEuro(breakdown.gross)}</span> pagos ·
          retenção efetiva de{" "}
          <span className="num">{formatPercent(breakdown.effectiveIrsRate)}</span>
        </p>
      </div>

      <GrossSplitChart split={breakdown.split} gross={breakdown.gross} />

      <dl className="lines">
        {breakdown.lines.map((line) => (
          <div
            className={`line is-${line.kind}${line.additive ? " is-additive" : ""}`}
            key={line.key}
          >
            <dt>
              {line.label}
              {line.note || line.reference ? (
                <span className="line-note">
                  {line.note ? <span>{line.note}</span> : null}
                  {line.reference ? <LawReference id={line.reference} /> : null}
                </span>
              ) : null}
            </dt>
            <dd className="num">{formatLine(line)}</dd>
          </div>
        ))}
        <div className="line is-total">
          <dt>Líquido a receber</dt>
          <dd className="num">{formatEuro(breakdown.net)}</dd>
        </div>
      </dl>

      {result.irsJovem ? <IrsJovemNote result={result} /> : null}

      {input ? <WageRateCurve input={input} /> : null}

      <WageComparison grossMonthly={result.grossMonthly} />

      <EmployerCost employer={breakdown.employer} />

      <div className="notices">
        <p>
          <strong>A retenção não é o imposto final.</strong> É um adiantamento
          por conta do IRS; o acerto só é feito na declaração anual e pode dar
          reembolso ou imposto a pagar.
        </p>
        <p>
          <strong>Simulação, não é aconselhamento.</strong> Confirme sempre os
          valores com o seu recibo de vencimento ou com a Autoridade
          Tributária.
        </p>
      </div>

      <SourceList entries={input ? wageSources(result, input.referenceDate) : []} />
    </>
  );
}

function IrsJovemNote({ result }: { result: WageResult }) {
  const jovem = result.irsJovem;
  if (!jovem) return null;

  return (
    <div className="callout">
      <p>
        <strong>IRS Jovem:</strong> a taxa de{" "}
        <span className="num">{formatPercent(jovem.effectiveRate)}</span> é a
        que corresponde ao rendimento total, mas incide apenas sobre a parte
        não isenta (<LawReference id="cirs-99f-4" />).
        {result.twelfths
          ? " Os duodécimos são isentos à parte, com o seu próprio limite."
          : ""}
      </p>
      {jovem.capped ? (
        <p>
          O limite de isenção por pagamento (
          <span className="num">{formatEuro(jovem.cap)}</span>) foi atingido: a
          parte acima é tributada normalmente. O limite anual é repartido por
          14 pagamentos (<LawReference id="despacho-233a-2026" />).
        </p>
      ) : null}
    </div>
  );
}
