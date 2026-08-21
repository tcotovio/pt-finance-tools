// "Would borrowing over longer actually help?"
//
// The panel above names which ceiling binds. This shows the shape behind it:
// the income ceiling climbing as the term lengthens, against a property
// ceiling that does not move at all. Where they cross is where a longer loan
// stops buying capacity and starts buying only interest.

import { useMemo } from "react";
import type { MaxLoanInput } from "@pt-finance-tools/engine";
import { buildLoanCurve } from "../lib/loan-curve.js";
import { formatEuroCompact } from "../lib/format.js";
import { LineChart, type ChartSeries } from "./LineChart.js";

export function LoanLimitCurve({ input }: { input: MaxLoanInput }) {
  const curve = useMemo(() => buildLoanCurve(input), [input]);
  if (curve.points.length === 0) return null;

  const series: ChartSeries[] = [
    {
      key: "dsti",
      label: "Limite pelo rendimento",
      points: curve.points.map((p) => ({ x: p.termYears, y: p.dsti })),
    },
    {
      key: "ltv",
      label: "Limite pelo imóvel",
      points: curve.points.map((p) => ({ x: p.termYears, y: p.ltv })),
    },
  ];

  return (
    <>
      <LineChart
        caption="Quanto pode pedir, consoante o prazo"
        series={series}
        xTitle="Prazo"
        yTitle="Montante"
        formatX={(value) => `${Math.round(value)} anos`}
        formatY={(value) => formatEuroCompact(value)}
        marker={{ x: input.termYears, label: `o seu: ${input.termYears} anos` }}
      />
      <p className="chart-note">
        {curve.crossoverTerm !== undefined ? (
          <>
            A partir dos <span className="num">{curve.crossoverTerm}</span> anos
            é o valor do imóvel que passa a mandar: alongar mais o prazo já não
            aumenta o financiamento, só os juros que paga no total.
          </>
        ) : (
          <>
            Em todo o intervalo é o rendimento que manda: alongar o prazo
            aumenta o que pode pedir — à custa de mais juros ao longo do
            contrato.
          </>
        )}
        {curve.maturityCap !== undefined ? (
          <>
            {" "}
            A curva deixa de subir aos{" "}
            <span className="num">{curve.maturityCap}</span> anos porque é esse
            o prazo máximo para a sua idade.
          </>
        ) : null}
      </p>
    </>
  );
}
