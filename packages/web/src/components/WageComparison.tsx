// The user's base salary against the national average.
//
// One line, not a strip: INE publishes a mean quarterly, not a distribution,
// so there is no range to place anyone within. Drawing a percentile position
// here would invent precision the source does not have — the loan side gets a
// strip because BdP publishes percentiles, and this does not.
//
// Two things the wording has to get right or the comparison misleads:
//
//   * it compares BASE salary with BASE salary. The headline figure in the
//     news is the total (1 835 €), which includes subsídios and overtime; put
//     against someone's base salary it would flatter every reader.
//   * it is a MEAN. High earners pull it up, so more than half of workers earn
//     less than it. "Below average" reads as "below the middle" to almost
//     everyone, and here those are not the same thing.

import { WAGE_MARKET } from "@pt-finance-tools/engine";
import { formatEuro, formatPercent } from "../lib/format.js";

const QUARTER_LABEL: Record<string, string> = {
  Q1: "1.º trimestre",
  Q2: "2.º trimestre",
  Q3: "3.º trimestre",
  Q4: "4.º trimestre",
};

function periodLabel(period: string): string {
  const [year, quarter] = period.split("-");
  return `${QUARTER_LABEL[quarter] ?? quarter} de ${year}`;
}

export function WageComparison({ grossMonthly }: { grossMonthly: number }) {
  if (grossMonthly <= 0) return null;

  const market = WAGE_MARKET;
  const difference = grossMonthly - market.baseMean;
  const share = Math.abs(difference) / market.baseMean;
  const above = difference >= 0;

  return (
    <section className="wage-comparison">
      <h3 className="group-title">Face à média nacional</h3>
      <p className="wage-comparison-reading">
        O seu vencimento base está{" "}
        <strong>
          {above ? "acima" : "abaixo"} da média em {formatPercent(share)}
        </strong>{" "}
        — <span className="num">{formatEuro(grossMonthly)}</span> contra uma
        remuneração base média de{" "}
        <span className="num">{formatEuro(market.baseMean)}</span> no{" "}
        {periodLabel(market.period)}.
      </p>
      <p className="chart-note">
        A comparação é entre vencimentos <strong>base</strong>: o valor de{" "}
        <span className="num">{formatEuro(market.totalMean)}</span> que costuma
        aparecer nas notícias é a remuneração <em>total</em>, que inclui
        subsídios e trabalho suplementar. E é uma <strong>média</strong>, não a
        mediana — como os salários mais altos puxam a média para cima, mais de
        metade dos trabalhadores ganha menos do que ela.
      </p>
    </section>
  );
}
