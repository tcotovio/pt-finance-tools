// "Where does the instalment actually go?"
//
// The breakdown gives one figure for interest over the whole contract, which
// is true and says nothing about the shape. Two crossing lines say the thing
// people are surprised by: the payment never changes, but for the first half
// of a long loan most of it is rent on the money rather than repayment of it.
//
// The lines are mirror images by construction — a constant instalment split
// two ways — so the reading is the crossing point, and the prose names it
// rather than leaving the reader to find it on the axis.

import { useMemo } from "react";
import { buildAmortizationSplit } from "../lib/amortization-split.js";
import { formatEuro, formatEuroCompact, formatPercent } from "../lib/format.js";
import type { LoanSummary } from "../lib/loan-result.js";
import { LineChart, type ChartSeries } from "./LineChart.js";

export function AmortizationSplit({ summary }: { summary: LoanSummary }) {
  // The same rate the "juros ao longo do contrato" total is computed at, so
  // the chart and the line above it can never tell different stories.
  const split = useMemo(
    () =>
      buildAmortizationSplit(
        summary.maxLoan,
        summary.contractRate,
        summary.termYears,
      ),
    [summary.maxLoan, summary.contractRate, summary.termYears],
  );

  if (!split) return null;

  const series: ChartSeries[] = [
    {
      key: "interest",
      label: "Juros",
      points: split.years.map((year) => ({ x: year.year, y: year.interest })),
    },
    {
      key: "principal",
      label: "Capital",
      points: split.years.map((year) => ({ x: year.year, y: year.principal })),
    },
  ];

  return (
    <>
      <p className="chart-note">
        A prestação é sempre a mesma, mas o que ela paga não. No primeiro mês,{" "}
        <strong>{formatPercent(split.firstMonthInterestShare)}</strong> dos{" "}
        <span className="num">{formatEuro(summary.contractPayment)}</span> são
        juros — só{" "}
        <span className="num">{formatEuro(split.firstMonthPrincipal)}</span>{" "}
        abatem à dívida. Ao fim de{" "}
        <span className="num">{split.halfway.year}</span> dos{" "}
        <span className="num">{summary.termYears}</span> anos ainda deve{" "}
        <strong>{formatEuro(split.halfway.balance)}</strong> dos{" "}
        <span className="num">{formatEuro(summary.maxLoan)}</span> que pediu,
        porque <span className="num">{formatPercent(split.interestInFirstHalf)}</span>{" "}
        de todos os juros do contrato se pagam nessa primeira metade.
        {split.crossoverYear !== undefined ? (
          <>
            {" "}
            Só a partir do <strong>ano {split.crossoverYear}</strong> é que a
            prestação passa a abater mais capital do que juros.
          </>
        ) : null}
      </p>

      <LineChart
        caption="O que paga em cada ano: juros e capital"
        series={series}
        xTitle="Ano"
        yTitle="Pago no ano"
        formatX={(value) => `ano ${Math.round(value)}`}
        formatY={formatEuroCompact}
        marker={
          split.crossoverYear !== undefined
            ? { x: split.crossoverYear, label: `ano ${split.crossoverYear}` }
            : undefined
        }
      />

      {summary.shocked ? (
        <p className="chart-note">
          À taxa de hoje, <span className="num">{formatPercent(summary.contractRate)}</span>
          , mantida até ao fim — o que em taxa variável não acontece. Se a taxa
          subir, a parte dos juros cresce e o capital abate mais devagar.
          {summary.mixedBasis
            ? " Sendo taxa mista, é a taxa depois do período fixo: a mesma com que está calculado o total de juros abaixo."
            : ""}
        </p>
      ) : null}
    </>
  );
}
