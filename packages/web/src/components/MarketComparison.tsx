// How the user's loan compares with the market, from Banco de Portugal's own
// statistics.
//
// Two comparisons, and one of them needs a caveat that is easy to get wrong:
//
//   * INSTALMENT — against the STOCK of outstanding loans, not new lending.
//     Most of that stock was agreed years ago at smaller amounts, so a loan
//     signed today sits high against it by construction. Said plainly, or the
//     comparison flatters nobody and misleads everybody.
//   * RATE — against NEW business of the same rate type, which is the like-
//     for-like comparison. Taxa mista has no published rate percentiles, only
//     a share, so for the market's dominant product this says so rather than
//     borrowing a neighbouring series.

import { MORTGAGE_MARKET, type LoanRateType } from "@pt-finance-tools/engine";
import { formatEuro, formatRate } from "../lib/format.js";
import { DistributionStrip } from "./DistributionStrip.js";

interface MarketComparisonProps {
  /** What the borrower would start paying each month. */
  contractPayment: number;
  /** The contract's nominal rate, as a fraction. */
  contractRate: number;
  rateType: LoanRateType;
}

export function MarketComparison({
  contractPayment,
  contractRate,
  rateType,
}: MarketComparisonProps) {
  const market = MORTGAGE_MARKET;
  const provenance = `Banco de Portugal, ${market.month}`;

  const ratePercentiles =
    rateType === "variable"
      ? market.newBusinessRate.variable
      : rateType === "fixed"
        ? market.newBusinessRate.fixed
        : undefined;

  return (
    <section className="market-comparison">
      <h3 className="group-title">Como se compara com o mercado</h3>

      <DistributionStrip
        caption="A sua prestação, face aos créditos à habitação já em curso"
        percentiles={market.instalmentStock}
        value={contractPayment}
        format={formatEuro}
        subject="dos contratos em curso"
        source={`${provenance} — prestações do stock de empréstimos`}
      />
      <p className="chart-note">
        A comparação é com os contratos <strong>já em curso</strong>, muitos
        deles assinados há anos e por valores menores. Um crédito contratado
        hoje fica naturalmente acima da mediana — não é sinal de que esteja a
        pagar de mais.
      </p>

      {ratePercentiles ? (
        <>
          <DistributionStrip
            caption={`A sua taxa, face às novas operações a taxa ${
              rateType === "fixed" ? "fixa" : "variável"
            }`}
            percentiles={ratePercentiles}
            value={contractRate}
            format={formatRate}
            subject="das novas operações"
            source={`${provenance} — taxa de juro de novas operações`}
          />
          <p className="chart-note">
            Aqui a comparação é directa: contratos novos, do mesmo tipo de taxa,
            no mesmo mês.
          </p>
        </>
      ) : (
        <p className="chart-note">
          O Banco de Portugal publica a repartição da taxa mista no mercado (
          {Math.round(market.shareOfNewLending.mixed * 100)} % das novas
          operações) mas não a distribuição das suas taxas — por isso não há
          aqui uma comparação directa. É o produto mais vendido e, ao mesmo
          tempo, aquele cujo preço as estatísticas não detalham.
        </p>
      )}
    </section>
  );
}
