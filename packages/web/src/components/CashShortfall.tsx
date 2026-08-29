// When the savings do not reach even the fixed costs of buying.
//
// ONE number, broken down. Earlier versions of this panel showed two — the
// cash needed to borrow the maximum, and the bare floor that buying anything
// at all costs — and readers reasonably asked which one they had to find. Both
// were right and they answer different questions, which is precisely the
// problem: nobody arrives wanting to know the cost of a house of symbolic
// value. So the floor is gone, and what remains is the amount that actually
// unlocks the loan, itemised.
//
// The itemisation matters more than it looks. Evaluated at a nominal price the
// charges come to a few hundred euros of notary; evaluated at the price the
// loan actually buys, the deposit dominates — 27 000 EUR of the 29 000 in the
// worked case. Showing the first would hide the only part most people can act
// on.

import type { MaxPriceInput, MaxPriceResult } from "@pt-finance-tools/engine";
import { buildCapacityTarget, buildShortfall } from "../lib/cash-shortfall.js";
import { formatEuro, formatEuroCompact, formatPercent } from "../lib/format.js";

interface CashShortfallProps {
  result: MaxPriceResult;
  /** What the buyer actually has. */
  savings: number;
  /** The input behind `result`, resolved again to find the cash target. */
  input: MaxPriceInput | null;
}

export function CashShortfall({ result, savings, input }: CashShortfallProps) {
  const target = input ? buildCapacityTarget(input, result, savings) : null;

  // No target means the income supports no loan at all — usually because
  // existing commitments already exhaust the 45 % ceiling. Then the cash is
  // not the story, and the floor is all there is to say.
  if (!target) return <FloorOnly result={result} savings={savings} />;

  return (
    <>
      <div className="result-headline">
        <p className="result-label">Pelo seu rendimento, poderia pedir até</p>
        <p className="result-net num">{formatEuro(target.loan)}</p>
        <p className="result-sub">
          para uma casa de{" "}
          <span className="num">{formatEuro(target.price)}</span> — mas isso
          exige <span className="num">{formatEuro(target.savingsNeeded)}</span>{" "}
          seus, que o crédito não cobre
        </p>
      </div>

      <h3 className="group-title">
        De onde vêm os {formatEuro(target.savingsNeeded)}
      </h3>
      <dl className="lines">
        {target.lines.map((line) => (
          <div className="line is-deduction" key={line.key}>
            <dt>{line.label}</dt>
            <dd className="num">{formatEuro(line.amount)}</dd>
          </div>
        ))}
        <div className="line is-total">
          <dt>Precisa de ter</dt>
          <dd className="num">{formatEuro(target.savingsNeeded)}</dd>
        </div>
        <div className="line is-earning">
          <dt>O que tem de parte</dt>
          <dd className="num">{formatEuro(savings)}</dd>
        </div>
        <div className="line is-total">
          <dt>Falta-lhe</dt>
          <dd className="num is-negative">{formatEuro(target.stillMissing)}</dd>
        </div>
      </dl>

      <p className="chart-note">
        Isto é para a casa mais cara que o seu rendimento alcança. Para uma casa
        mais barata precisa de menos: conte com cerca de{" "}
        <strong>{formatPercent(target.shareOfPrice)} do preço</strong> em
        dinheiro seu — por cada {formatEuroCompact(100_000)} de casa, à volta
        de{" "}
        <span className="num">
          {formatEuroCompact(
            Math.round((target.shareOfPrice * 100_000) / 100) * 100,
          )}
        </span>
        .
      </p>
    </>
  );
}

/** The degenerate case: no borrowing capacity, so only the floor can be said. */
function FloorOnly({
  result,
  savings,
}: {
  result: MaxPriceResult;
  savings: number;
}) {
  const { needed, missing, lines } = buildShortfall(result, savings);

  return (
    <>
      <div className="result-headline">
        <p className="result-label">Faltam-lhe</p>
        <p className="result-net is-negative num">{formatEuro(missing)}</p>
        <p className="result-sub">
          para cobrir o mínimo que qualquer compra exige em dinheiro
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
      </dl>

      <p className="chart-note">
        Com os encargos que já tem, a taxa de esforço não deixa espaço para mais
        crédito — por isso o valor acima é só o custo do ato, não uma entrada.
      </p>
    </>
  );
}
