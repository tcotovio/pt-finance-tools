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

export interface CapacityTarget {
  /** The loan the income supports, whatever the savings. */
  loan: number;
  /** The price that loan reaches at this savings level. */
  price: number;
  /** Savings needed before the cash stops being what caps the loan. */
  savingsNeeded: number;
  /** Savings needed, less what the buyer already has. */
  stillMissing: number;
}

/** Bounded so a pathological input cannot spin; 50 halvings is far past cents. */
const SEARCH_ITERATIONS = 50;

/**
 * How much cash it takes to borrow everything the income allows.
 *
 * This is the question behind the question. A buyer told only that they are
 * short by the cost of the deed reads it as "find 700 € and I can borrow the
 * maximum" — which is wrong by an order of magnitude, because reaching that
 * maximum also means covering the deposit and the taxes on a real purchase.
 * Without the state guarantee the two numbers differ by a factor of ninety.
 *
 * Found by bisection rather than algebra: the cash a price demands moves in
 * notches — IMT brackets, the young ceiling — so there is no closed form to
 * invert, and the solver is the only thing that knows where the notches fall.
 */
export function buildCapacityTarget(
  input: MaxPriceInput,
  result: MaxPriceResult,
  savings: number,
): CapacityTarget | null {
  const loan = result.loanResult.dsti.maxLoan;
  if (!(loan > 0)) return null;

  const reaches = (candidate: number) => {
    try {
      return maxPropertyPriceForDate({ ...input, savings: candidate }).loan >= loan - 1;
    } catch {
      return false;
    }
  };

  // The deposit can never exceed the price, so the loan itself bounds the
  // search generously; a little headroom covers the taxes on top.
  let low = 0;
  let high = loan * 1.5 + result.cashNeeded + 1000;
  if (!reaches(high)) return null;

  for (let i = 0; i < SEARCH_ITERATIONS; i++) {
    const mid = (low + high) / 2;
    if (reaches(mid)) high = mid;
    else low = mid;
  }

  const savingsNeeded = Math.ceil(high);
  let price = 0;
  try {
    price = maxPropertyPriceForDate({ ...input, savings: savingsNeeded }).maxPrice;
  } catch {
    price = 0;
  }

  return {
    loan,
    price,
    savingsNeeded,
    stillMissing: Math.max(0, savingsNeeded - savings),
  };
}
