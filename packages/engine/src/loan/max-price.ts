// The other direction: not "can I afford this house?" but "how expensive a
// house can I afford?".
//
// The tool could already test a price the user had picked. That is the wrong
// shape for the question most people actually arrive with, because it makes
// them guess first and then binary-search by hand. Here the unknown is the
// price and the inputs are the two things a buyer does know: their income and
// what they have saved.
//
// THREE CEILINGS, AND CASH IS THE NEW ONE. The DSTI and LTV limits are already
// solved by `maxLoan`; this composes it rather than restating it, so taxa
// mista, the past-70 income haircut, the maturity cap and the shock bands all
// arrive for free and stay in one place. What it adds is the cash equation:
//
//   cashNeeded(price) = price − loan(price) + purchaseCosts(price, loan).total
//
// and the answer is the largest price where that stays within savings.
//
// WHY A BISECTION AND NOT A FORMULA. `cashNeeded` is strictly increasing, but
// it is not continuous, and three of its jumps are large:
//
//   * IMT's top rows are *taxas únicas* charged on the whole value, so the tax
//     steps up by 543,71 € at 660 982 € and by 17 262,80 € at 1 150 853 €;
//   * the young table's advantage ends at a cliff rather than tapering;
//   * crossing 450 000 € withdraws the state guarantee, dropping the LTV from
//     100 % to 90 % and the loan with it.
//
// Every one of those is a step UP — the flat bands are average-rate bands, so
// the marginal rate never falls in the way that would break monotonicity — but
// they do mean `cashNeeded(price) = savings` can have no solution at all: a
// whole window of prices can be unaffordable while a price just below it is
// fine. Root-finding is therefore the wrong tool. What IS monotone is the
// predicate `cashNeeded(price) <= savings`, true-then-false, and bisecting
// that converges on its supremum whether or not a root exists.
//
// A closed-form solve per IMT bracket is possible and deliberately not done:
// it would copy the bracket table into the solver, and "a new rule is a data
// change, not a code change" is the bet the whole engine rests on.

import type {
  InterestRateShock,
  MacroprudentialParameters,
  MaxLoanInput,
  MaxLoanResult,
  MaxPriceInput,
  MaxPriceResult,
  PurchaseCosts,
  RegistrationFees,
  ImtTables,
  StampDuty,
  StateGuarantee,
} from "../types.js";
import { maxLoan } from "./max-loan.js";
import { purchaseCosts } from "./purchase-costs.js";

/** Enough to bracket any answer; the search doubles up to it, never past. */
const MAX_SEARCH_PRICE = 100_000_000;
/**
 * 64 halvings take a 100 M € bracket below a millionth of a cent, so the loop
 * is bounded by iterations rather than by a tolerance — no convergence test to
 * get wrong, and the final integer step below is what actually decides the
 * answer anyway.
 */
const ITERATIONS = 64;

interface Resolved {
  params: MacroprudentialParameters;
  shockTable: InterestRateShock;
  tables: ImtTables;
  stamp: StampDuty;
  fees: RegistrationFees;
  guarantee?: StateGuarantee;
}

/** The max-loan input this price implies, with the ratio inputs resolved. */
function loanInputAt(input: MaxPriceInput, price: number): MaxLoanInput {
  const {
    savings: _savings,
    appraisalRatio,
    vptRatio: _vptRatio,
    region: _region,
    youngFirstHome: _young,
    bankFees: _fees,
    ...rest
  } = input;
  return {
    ...rest,
    propertyPrice: price,
    ...(appraisalRatio !== undefined
      ? { appraisalValue: price * appraisalRatio }
      : {}),
  };
}

/** Everything about a candidate price: what it borrows, and what it costs. */
function evaluate(
  input: MaxPriceInput,
  price: number,
  d: Resolved,
): { loanResult: MaxLoanResult; costs: PurchaseCosts; cashNeeded: number } {
  const loanResult = maxLoan(
    loanInputAt(input, price),
    d.params,
    d.shockTable,
    d.guarantee,
  );
  const costs = purchaseCosts(
    {
      price,
      ...(input.vptRatio !== undefined
        ? { vpt: price * input.vptRatio }
        : {}),
      loanAmount: loanResult.maxLoan,
      purpose: input.purpose,
      region: input.region,
      youngFirstHome: input.youngFirstHome,
      termYears: loanResult.termYears,
      annualRate: input.annualRate,
      assessmentDate: input.assessmentDate,
      bankFees: input.bankFees,
    },
    d.tables,
    d.stamp,
    d.fees,
  );
  return {
    loanResult,
    costs,
    cashNeeded: price - loanResult.maxLoan + costs.upfrontTotal,
  };
}

/**
 * The largest property price the borrower's income and savings reach together.
 */
export function maxPropertyPrice(
  input: MaxPriceInput,
  params: MacroprudentialParameters,
  shockTable: InterestRateShock,
  tables: ImtTables,
  stamp: StampDuty,
  fees: RegistrationFees,
  guarantee?: StateGuarantee,
): MaxPriceResult {
  if (!Number.isFinite(input.savings) || input.savings < 0) {
    throw new Error("savings must be zero or more.");
  }
  const d: Resolved = { params, shockTable, tables, stamp, fees, guarantee };
  const affordable = (price: number) =>
    price > 0 && evaluate(input, price, d).cashNeeded <= input.savings;

  // Bracket. The upper bound has to be genuinely unaffordable for the
  // bisection to mean anything, so it is doubled until it is — starting from
  // the crudest possible over-estimate, every euro of savings and every euro
  // the DSTI ceiling could ever lend, with no costs deducted.
  let low = 0;
  let high = Math.max(1, input.savings) * 2;
  while (high < MAX_SEARCH_PRICE && affordable(high)) high *= 2;
  high = Math.min(high, MAX_SEARCH_PRICE);

  if (!affordable(1)) {
    // Not even a nominal purchase works — the costs alone exhaust the savings.
    const at = evaluate(input, Math.max(1, input.savings), d);
    return {
      maxPrice: 0,
      loan: 0,
      deposit: 0,
      costs: at.costs,
      cashNeeded: at.cashNeeded,
      unusedFunds: input.savings,
      bindingConstraint: "cash",
      cashPerEuroOfPrice: 1,
      loanResult: at.loanResult,
    };
  }
  low = 1;

  for (let i = 0; i < ITERATIONS; i++) {
    const mid = (low + high) / 2;
    if (affordable(mid)) low = mid;
    else high = mid;
  }

  // Floor to the euro, then step down until the answer is genuinely
  // affordable. The step matters: it is what lands a notched case exactly on
  // 450 000 € or 660 982 € rather than a cent past the edge of the jump.
  let price = Math.floor(low);
  while (price > 0 && !affordable(price)) price -= 1;

  const at = evaluate(input, price, d);
  const loan = at.loanResult.maxLoan;

  // What is actually stopping them, and the two directions answer this
  // differently enough that it is worth being careful.
  //
  // In the forward direction the binding rule is whichever ceiling produced
  // the smaller loan. Here the loan is not the answer — the price is — and the
  // price stops exactly where the cash runs out, whatever capped the loan. So
  // "cash" is reported whenever one more euro of house is unaffordable, and
  // `loanResult.bindingConstraint` remains available to say what capped the
  // loan underneath it.
  //
  // Getting this wrong is not cosmetic: attributing it to the DSTI would tell
  // a borrower whose loan is frozen by income that "a bigger deposit does not
  // move this limit", when a bigger deposit is precisely what does move the
  // price they can reach.
  const oneMore = price > 0 ? evaluate(input, price + 1, d) : undefined;
  const cashBinds = oneMore ? oneMore.cashNeeded > input.savings : true;
  const bindingConstraint = cashBinds
    ? "cash"
    : at.loanResult.bindingConstraint;

  return {
    maxPrice: price,
    loan,
    deposit: Math.max(0, price - loan),
    costs: at.costs,
    cashNeeded: at.cashNeeded,
    unusedFunds: Math.max(0, input.savings - at.cashNeeded),
    bindingConstraint,
    // The local slope, read off the next euro. Under the state guarantee this
    // is around 1,4 % rather than 10 %, which is why a small change in savings
    // moves the answer so much — worth showing rather than hiding.
    cashPerEuroOfPrice: oneMore ? oneMore.cashNeeded - at.cashNeeded : 1,
    loanResult: at.loanResult,
  };
}
