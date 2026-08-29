// What a buyer is short by, and what the money is for.
//
// The reverse solver can answer "no house at all": the fixed costs of buying
// exhaust the savings before any deposit. The panel used to stop at that, and
// "no" without a number is not an answer anyone can act on — the gap is
// usually a few hundred euros of deed and registration, not a deposit.
//
// Kept out of the component and tested, like the rest of `lib/`, because the
// filtering below is a judgement call with a wrong version that looks right.

import type { MaxPriceResult } from "@pt-finance-tools/engine";

export interface ShortfallLine {
  key: string;
  label: string;
  amount: number;
}

export interface Shortfall {
  /** The minimum cash any purchase needs, as the engine evaluated it. */
  needed: number;
  /** How far the savings fall short of it. */
  missing: number;
  /** The charges making up `needed`, largest first. */
  lines: ShortfallLine[];
  /** True when the young-first-home rules already zeroed IMT or the selo. */
  exemptYoung: boolean;
}

/**
 * Sub-euro charges are dropped, not just zero ones.
 *
 * The engine evaluates these costs at a NOMINAL price, so anything
 * proportional to the purchase — the selo do crédito above all — comes out as
 * a cent or two. Shown as a line it reads as a real charge and invites the
 * reader to think the selo is negligible, which it is not: on a real purchase
 * it is a percentage of the amount borrowed.
 */
const MIN_VISIBLE = 1;

export function buildShortfall(
  result: MaxPriceResult,
  savings: number,
): Shortfall {
  const { costs } = result;

  const lines = [
    {
      key: "registration",
      label: "Escritura e registo",
      amount: costs.registration.amount,
    },
    { key: "bank", label: "Comissões do banco", amount: costs.bankFees },
    { key: "imt", label: "IMT", amount: costs.imt.amount },
    {
      key: "stamp-transfer",
      label: "Imposto do selo da compra",
      amount: costs.stampDutyTransfer.amount,
    },
    {
      key: "stamp-credit",
      label: "Imposto do selo do crédito",
      amount: costs.stampDutyCredit.amount,
    },
  ]
    .filter((line) => line.amount >= MIN_VISIBLE)
    .sort((a, b) => b.amount - a.amount);

  return {
    needed: result.cashNeeded,
    missing: Math.max(0, result.cashNeeded - savings),
    lines,
    exemptYoung:
      costs.imt.exempt || costs.stampDutyTransfer.youngDeduction > 0,
  };
}
