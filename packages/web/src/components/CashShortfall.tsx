// When the savings do not reach even the fixed costs of buying.
//
// What the reader wants here is not "no". It is the two numbers they came for:
// how much they could borrow, and how much cash that takes. So the headline is
// the loan their income supports, and the deficit sits under it — the answer
// first, the obstacle second.
//
// AN EARLIER VERSION OF THIS PANEL MISLED, and the fix is the point of the
// layout. It showed the borrowing ceiling beside the cost of the deed, which
// invited the reading "find 700 € and I can borrow 190 000 €". That is wrong
// by an order of magnitude: the 700 € buys a nominal house, while borrowing
// the maximum also means covering the deposit and the taxes on a real one —
// without the state guarantee, some 22 000 € rather than 700 €. The two
// figures are now explicitly the target and the floor, each labelled with what
// it actually gets you.

import type { MaxPriceInput, MaxPriceResult } from "@pt-finance-tools/engine";
import { buildCapacityTarget, buildShortfall } from "../lib/cash-shortfall.js";
import { formatEuro } from "../lib/format.js";

interface CashShortfallProps {
  result: MaxPriceResult;
  /** What the buyer actually has. */
  savings: number;
  /** The input behind `result`, resolved again to find the cash target. */
  input: MaxPriceInput | null;
}

export function CashShortfall({ result, savings, input }: CashShortfallProps) {
  const { needed, missing, lines, exemptYoung } = buildShortfall(result, savings);
  const target = input ? buildCapacityTarget(input, result, savings) : null;

  return (
    <>
      {target ? (
        <div className="result-headline">
          <p className="result-label">Pelo seu rendimento, poderia pedir até</p>
          <p className="result-net num">{formatEuro(target.loan)}</p>
          <p className="result-sub">
            para uma casa de{" "}
            <span className="num">{formatEuro(target.price)}</span> — mas isso
            exige <span className="num">{formatEuro(target.savingsNeeded)}</span>{" "}
            de parte, para a entrada, os impostos e a escritura
          </p>
        </div>
      ) : (
        <div className="result-headline">
          <p className="result-label">Faltam-lhe</p>
          <p className="result-net is-negative num">{formatEuro(missing)}</p>
          <p className="result-sub">
            para cobrir o mínimo que qualquer compra exige em dinheiro
          </p>
        </div>
      )}

      {target ? (
        <dl className="lines">
          <div className="line is-earning">
            <dt>O que tem de parte</dt>
            <dd className="num">{formatEuro(savings)}</dd>
          </div>
          <div className="line is-deduction">
            <dt>
              Necessário para pedir esse valor
              <span className="line-note">
                <span>
                  A entrada mais os impostos e as despesas do ato, no preço que
                  esse empréstimo alcança.
                </span>
              </span>
            </dt>
            <dd className="num">{formatEuro(target.savingsNeeded)}</dd>
          </div>
          <div className="line is-total">
            <dt>Falta-lhe</dt>
            <dd className="num is-negative">
              {formatEuro(target.stillMissing)}
            </dd>
          </div>
        </dl>
      ) : null}

      <h3 className="group-title">O mínimo para comprar seja o que for</h3>
      <p className="chart-note">
        Mesmo que o banco financiasse a totalidade do preço, há custos que se
        pagam em dinheiro no dia da escritura e que nenhum crédito cobre. Só
        para os cobrir, numa casa de valor simbólico, precisaria de{" "}
        <span className="num">{formatEuro(needed)}</span> — e ainda não seria
        uma casa a sério, porque cada euro de preço acrescenta imposto e
        entrada por cima.
      </p>

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
      </dl>

      {exemptYoung ? (
        <p className="chart-note">
          O IMT e o imposto do selo da compra já estão isentos pela condição de
          primeira casa até aos 35 anos.
        </p>
      ) : null}
    </>
  );
}
