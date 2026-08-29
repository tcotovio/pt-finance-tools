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
  getMacroprudentialParameters,
  maxPropertyPriceForDate,
  purchaseCostsForDate,
  type MaxPriceInput,
  type MaxPriceResult,
} from "@pt-finance-tools/engine";

export interface ShortfallLine {
  key: string;
  label: string;
  amount: number;
  /**
   * Set when the charge is zero BECAUSE the state stepped in, rather than
   * absent. A missing row says nothing; a row reading "isento" explains why
   * the total is lower than the reader expects — and `saved` says by how much,
   * which for the young exemptions runs to thousands.
   */
  reliefLabel?: string;
  /** What the relief is worth, when it can be computed exactly. */
  saved?: number;
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
  /** What that cash is made of, largest first — the deposit usually dominates. */
  lines: ShortfallLine[];
  /** The cash as a share of the price, so any other house can be scaled to. */
  shareOfPrice: number;
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

  let at: MaxPriceResult | null = null;
  try {
    at = maxPropertyPriceForDate({ ...input, savings: savingsNeeded });
  } catch {
    at = null;
  }
  if (!at) return null;

  // What the cash is actually made of, AT THE PRICE IT BUYS. Evaluating the
  // charges at a nominal price — as the floor does — would show a few hundred
  // euros of notary and hide the deposit, which is the overwhelming part of
  // the answer and the only one most people can act on.
  // What the same purchase would have cost without the young-buyer rules, so
  // an exempt charge can say what it saved instead of merely vanishing.
  let withoutRelief: ReturnType<typeof purchaseCostsForDate> | null = null;
  if (input.youngFirstHome) {
    try {
      withoutRelief = purchaseCostsForDate({
        price: at.maxPrice,
        loanAmount: at.loan,
        purpose: input.purpose,
        region: input.region,
        termYears: input.termYears,
        annualRate: input.annualRate,
        assessmentDate: input.assessmentDate,
        youngFirstHome: false,
      });
    } catch {
      withoutRelief = null;
    }
  }

  // The guarantee's worth is exactly the deposit the LTV ceiling would
  // otherwise demand — a published limit, not an estimate.
  let depositWithoutGuarantee = 0;
  if (input.stateGuarantee) {
    try {
      const ltv = getMacroprudentialParameters(input.assessmentDate).ltvLimit[
        input.purpose
      ];
      depositWithoutGuarantee = at.maxPrice * (1 - ltv);
    } catch {
      depositWithoutGuarantee = 0;
    }
  }

  const charged = [
    { key: "deposit", label: "Entrada", amount: at.deposit },
    { key: "imt", label: "IMT", amount: at.costs.imt.amount },
    {
      key: "stamp-transfer",
      label: "Imposto do selo da compra",
      amount: at.costs.stampDutyTransfer.amount,
    },
    {
      key: "stamp-credit",
      label: "Imposto do selo do crédito",
      amount: at.costs.stampDutyCredit.amount,
    },
    {
      key: "registration",
      label: "Escritura e registo",
      amount: at.costs.registration.amount,
    },
    { key: "bank", label: "Comissões do banco", amount: at.costs.bankFees },
  ]
    .filter((line) => line.amount >= MIN_VISIBLE)
    .sort((a, b) => b.amount - a.amount);

  // Reliefs come after the charges: they are zeroes, and a zero belongs below
  // the numbers that actually add up to the total.
  const reliefs: ShortfallLine[] = [];
  if (at.costs.imt.amount < MIN_VISIBLE && (withoutRelief?.imt.amount ?? 0) >= MIN_VISIBLE) {
    reliefs.push({
      key: "imt-exempt",
      label: "IMT",
      amount: 0,
      reliefLabel: "Isento",
      saved: withoutRelief!.imt.amount,
    });
  }
  if (
    at.costs.stampDutyTransfer.amount < MIN_VISIBLE &&
    (withoutRelief?.stampDutyTransfer.amount ?? 0) >= MIN_VISIBLE
  ) {
    reliefs.push({
      key: "stamp-exempt",
      label: "Imposto do selo da compra",
      amount: 0,
      reliefLabel: "Isento",
      saved: withoutRelief!.stampDutyTransfer.amount,
    });
  }
  if (at.deposit < MIN_VISIBLE && depositWithoutGuarantee >= MIN_VISIBLE) {
    reliefs.push({
      key: "deposit-guaranteed",
      label: "Entrada",
      amount: 0,
      reliefLabel: "Coberta pela garantia do Estado",
      saved: depositWithoutGuarantee,
    });
  }

  const lines = [...charged, ...reliefs];

  return {
    loan,
    price: at.maxPrice,
    savingsNeeded,
    stillMissing: Math.max(0, savingsNeeded - savings),
    lines,
    shareOfPrice: at.maxPrice > 0 ? at.cashNeeded / at.maxPrice : 0,
  };
}
