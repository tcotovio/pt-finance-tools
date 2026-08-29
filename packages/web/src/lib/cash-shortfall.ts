// What a buyer is short by, and what the money is for.
//
// The reverse solver can answer "no house at all": the fixed costs of buying
// exhaust the savings before any deposit. The panel used to stop at that, and
// "no" without a number is not an answer anyone can act on — the gap is
// usually a few hundred euros of deed and registration, not a deposit.
//
// Kept out of the component and tested, like the rest of `lib/`, because the
// filtering below is a judgement call with a wrong version that looks right.

import {
  maxPropertyPriceForDate,
  type MaxPriceInput,
  type MaxPriceResult,
} from "@pt-finance-tools/engine";

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

export interface OutlookStep {
  /** Total savings at this step, not the increment. */
  savings: number;
  /** The most expensive house reachable with them. */
  price: number;
  /** True once income, not cash, is what caps the answer. */
  incomeCapped: boolean;
}

export interface ShortfallOutlook {
  /** What the income alone supports, whatever the savings. */
  incomeLoanCeiling: number;
  /** A few rungs above the floor, so the reader can see what cash buys. */
  steps: OutlookStep[];
}

/** Savings above the floor to sample, in euros. */
const STEPS = [500, 1000, 2500];

/**
 * Rungs are rounded up to a round figure. The floor carries cents, so the raw
 * sum reads as "com 1 251,00 EUR de parte" — a precision nobody has about
 * their own savings, and one that makes an illustrative rung look computed.
 */
const ROUND_TO = 50;

/**
 * What the missing money would actually unlock.
 *
 * The obvious version of this — "here is what you could buy if you had the
 * amount you are missing" — is a trap, and the numbers say so plainly: with
 * exactly the shortfall covered the reachable price is a few hundred euros,
 * because the floor pays for a NOMINAL purchase and every euro of real price
 * wants more cash on top. Answering the obvious question would mean printing
 * a number that is a rounding error beside what the income supports. So the rungs are the floor PLUS a few round amounts, and the ceiling
 * the income already supports is reported alongside, because that is usually
 * the reassuring part: the buyer is not short of borrowing power, only of the
 * few thousand euros the deed and the taxes want in cash.
 */
export function buildOutlook(
  input: MaxPriceInput,
  result: MaxPriceResult,
): ShortfallOutlook {
  const floor = result.cashNeeded;
  const incomeLoanCeiling = result.loanResult.dsti.maxLoan;

  const steps: OutlookStep[] = [];
  for (const extra of STEPS) {
    const savings = Math.ceil((floor + extra) / ROUND_TO) * ROUND_TO;
    try {
      const at = maxPropertyPriceForDate({ ...input, savings });
      if (at.maxPrice > 0) {
        steps.push({
          savings,
          price: at.maxPrice,
          // Within a euro of the income ceiling: cash has stopped binding.
          incomeCapped: at.loan >= incomeLoanCeiling - 1,
        });
      }
    } catch {
      // A savings level the parameters cannot serve is simply not shown.
    }
  }

  return { incomeLoanCeiling, steps };
}
