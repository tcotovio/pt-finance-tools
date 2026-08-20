// "How much of the next euro do I keep?"
//
// The bracket rate is the number people quote and fear; the effective rate is
// the one they pay. Showing them together, with the user's own salary marked,
// answers the question the payslip never does — and it costs no new data, since
// the withholding tables are already in the bundle.

import { useMemo } from "react";
import type { WageInput } from "@pt-finance-tools/engine";
import { buildRateCurve, nearestPoint } from "../lib/wage-curve.js";
import { formatEuro, formatEuroCompact, formatPercent } from "../lib/format.js";
import { LineChart, type ChartSeries } from "./LineChart.js";

export function WageRateCurve({ input }: { input: WageInput }) {
  const points = useMemo(() => buildRateCurve(input), [input]);
  if (points.length === 0) return null;

  const series: ChartSeries[] = [
    {
      key: "marginal",
      label: "Taxa do escalão",
      points: points.map((p) => ({ x: p.gross, y: p.marginalRate })),
    },
    {
      key: "effective",
      label: "Retenção efetiva",
      points: points.map((p) => ({ x: p.gross, y: p.effectiveRate })),
    },
  ];

  if (points.some((p) => p.effectiveWithoutJovem !== undefined)) {
    series.push({
      key: "without-jovem",
      label: "Efetiva sem IRS Jovem",
      dashed: true,
      points: points.map((p) => ({
        x: p.gross,
        y: p.effectiveWithoutJovem ?? p.effectiveRate,
      })),
    });
  }

  const here = nearestPoint(points, input.grossMonthly);

  return (
    <>
      <LineChart
        caption="A taxa do escalão e o que é retido de facto, por vencimento"
        series={series}
        xTitle="Vencimento base"
        yTitle="Taxa"
        formatX={(value) => formatEuroCompact(value)}
        formatY={(value) => formatPercent(value)}
        marker={
          here
            ? { x: here.gross, label: `o seu: ${formatEuro(input.grossMonthly)}` }
            : undefined
        }
      />
      <p className="chart-note">
        A taxa do escalão aplica-se a todo o vencimento, mas só depois de
        abatidas as parcelas — por isso a retenção efetiva é sempre menor, e
        sobe de forma suave. A curva usa apenas o vencimento base: subsídio de
        alimentação, duodécimos e trabalho suplementar ficam de fora para
        mostrar as tabelas, não os extras.
      </p>
    </>
  );
}
