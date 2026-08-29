// When the savings do not reach even the fixed costs of buying.
//
// The panel used to say only that it was not possible. That is true and
// useless: "no" without a number gives the reader nothing to act on, and the
// number here is usually small and very reachable — a few hundred euros of
// deed and registration, not a deposit. Someone told "you cannot buy" walks
// away; someone told "you are 620 € short, and here is what for" knows exactly
// what to do next.
//
// The costs shown are evaluated at a nominal price, so they are the floor:
// what buying ANY house costs before a single euro of deposit. Under the state
// guarantee the bank can lend the whole price, but these are never lent — they
// are paid at the deed, in cash.

import type { MaxPriceResult } from "@pt-finance-tools/engine";
import { buildShortfall } from "../lib/cash-shortfall.js";
import { formatEuro } from "../lib/format.js";

interface CashShortfallProps {
  result: MaxPriceResult;
  /** What the buyer actually has. */
  savings: number;
}

export function CashShortfall({ result, savings }: CashShortfallProps) {
  const { needed, missing, lines, exemptYoung } = buildShortfall(result, savings);

  return (
    <>
      <div className="result-headline">
        <p className="result-label">Faltam-lhe</p>
        <p className="result-net num">{formatEuro(missing)}</p>
        <p className="result-sub">
          para cobrir o mínimo que qualquer compra exige em dinheiro, mesmo com
          o banco a financiar todo o preço
        </p>
      </div>

      <div className="callout">
        <p>
          <strong>Isto não é entrada.</strong> São custos que se pagam no dia da
          escritura e que nenhum crédito cobre — por isso aparecem mesmo com a
          garantia do Estado, que permite financiar 100 % do preço mas não os
          impostos e as despesas do ato.
        </p>
      </div>

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

      <p className="chart-note">
        Este é o piso: numa compra a sério há ainda o imposto do selo do
        crédito, que é uma percentagem do valor financiado e por isso cresce
        com o preço da casa.
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
