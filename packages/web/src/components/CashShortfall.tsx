// When the savings do not reach even the fixed costs of buying.
//
// The panel used to say only that it was not possible. That is true and
// useless: "no" without a number gives the reader nothing to act on, and the
// number here is usually small and very reachable — a few hundred euros of
// deed and registration, not a deposit.
//
// Three decisions about how it reads:
//
//   * the missing amount wears the NEGATIVE colour, not the accent. Everywhere
//     else in this app the big number is the answer the reader wanted; here it
//     is a deficit, and dressing a deficit as an answer is the wrong signal.
//   * the income ceiling is reported beside it, because it is usually the
//     reassuring half: the buyer is not short of borrowing power, only of the
//     cash the deed wants on the day.
//   * the rungs below are the floor PLUS round amounts, never the shortfall
//     itself. Covering exactly the missing amount reaches a few hundred euros
//     of house — the floor pays for a nominal purchase and every euro of real
//     price wants more cash on top — so "what the shortfall would buy" would
//     answer the obvious question with a rounding error.

import type { MaxPriceInput, MaxPriceResult } from "@pt-finance-tools/engine";
import { buildOutlook, buildShortfall } from "../lib/cash-shortfall.js";
import { formatEuro } from "../lib/format.js";

interface CashShortfallProps {
  result: MaxPriceResult;
  /** What the buyer actually has. */
  savings: number;
  /** The input behind `result`, resampled to show what more savings buy. */
  input: MaxPriceInput | null;
}

export function CashShortfall({ result, savings, input }: CashShortfallProps) {
  const { needed, missing, lines, exemptYoung } = buildShortfall(result, savings);
  const outlook = input ? buildOutlook(input, result) : null;

  return (
    <>
      <div className="result-headline">
        <p className="result-label">Faltam-lhe</p>
        <p className="result-net is-negative num">{formatEuro(missing)}</p>
        <p className="result-sub">
          para cobrir o mínimo que qualquer compra exige em dinheiro, mesmo com
          o banco a financiar todo o preço
        </p>
      </div>

      {outlook && outlook.incomeLoanCeiling > 0 ? (
        <div className="callout">
          <p>
            <strong>Não é o rendimento que o trava.</strong> Pelo que ganha, o
            banco poderia emprestar-lhe até{" "}
            <span className="num">{formatEuro(outlook.incomeLoanCeiling)}</span>{" "}
            — o que falta é dinheiro para os custos do ato, que nenhum crédito
            cobre.
          </p>
        </div>
      ) : null}

      <dl className="lines">
        {lines.map((line) => (
          <div className="line is-deduction" key={line.key}>
            <dt>{line.label}</dt>
            <dd className="num">{formatEuro(line.amount)}</dd>
          </div>
        ))}
        <div className="line is-total">
          <dt>Mínimo em dinheiro</dt>
          <dd className="num">{formatEuro(needed)}</dd>
        </div>
        <div className="line is-earning">
          <dt>O que tem de parte</dt>
          <dd className="num">{formatEuro(savings)}</dd>
        </div>
      </dl>

      {outlook && outlook.steps.length > 0 ? (
        <>
          <h3 className="group-title">O que mais algum dinheiro compraria</h3>
          <dl className="lines">
            {outlook.steps.map((step) => (
              <div className="line is-earning" key={step.savings}>
                <dt>
                  Com {formatEuro(step.savings)} de parte
                  {step.incomeCapped ? (
                    <span className="line-note">
                      <span>
                        A partir daqui é o rendimento que manda, não o dinheiro
                        que tem de parte.
                      </span>
                    </span>
                  ) : null}
                </dt>
                <dd className="num">{formatEuro(step.price)}</dd>
              </div>
            ))}
          </dl>
          <p className="chart-note">
            Ter exatamente os {formatEuro(missing)} que faltam quase não muda
            nada: dá para a escritura de uma casa de valor simbólico, porque
            cada euro de preço exige mais uns cêntimos seus por cima. É por
            isso que a tabela começa acima desse valor.
          </p>
        </>
      ) : null}

      <p className="chart-note">
        Os custos acima são o piso: numa compra a sério há ainda o imposto do
        selo do crédito, que é uma percentagem do valor financiado e por isso
        cresce com o preço da casa.
      </p>

      {exemptYoung ? (
        <p className="chart-note">
          O IMT e o imposto do selo da compra já estão isentos pela condição de
          primeira casa até aos 35 anos — o que falta são as despesas do ato e
          as comissões.
        </p>
      ) : null}
    </>
  );
}
