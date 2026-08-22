import { describe, expect, it } from "vitest";
import {
  maxPropertyPriceForDate,
  maxLoanForDate,
  purchaseCostsForDate,
} from "../index.js";
import { STATE_GUARANTEE_2024 } from "../data/index.js";
import type { MaxPriceInput } from "../types.js";

const base: MaxPriceInput = {
  borrower: { monthlyIncome: 2_500, age: 30 },
  purpose: "own-permanent-residence",
  annualRate: 0.032,
  rateType: "variable",
  termYears: 40,
  region: "continente",
  savings: 50_000,
  assessmentDate: "2026-09-01",
};

const solve = (extra: Partial<MaxPriceInput> = {}) =>
  maxPropertyPriceForDate({ ...base, ...extra });

/**
 * The cash equation, rebuilt from the two public functions rather than read
 * off the solver — so the monotonicity the solver depends on is checked
 * against an independent statement of it, not against the solver's own.
 */
function cashNeededAt(price: number, input: MaxPriceInput): number {
  const loan = maxLoanForDate({
    borrower: input.borrower,
    purpose: input.purpose,
    propertyPrice: price,
    annualRate: input.annualRate,
    rateType: input.rateType,
    termYears: input.termYears,
    stateGuarantee: input.stateGuarantee,
    assessmentDate: input.assessmentDate,
  });
  const costs = purchaseCostsForDate({
    price,
    loanAmount: loan.maxLoan,
    purpose: input.purpose,
    region: input.region,
    youngFirstHome: input.youngFirstHome,
    termYears: loan.termYears,
    annualRate: input.annualRate,
    assessmentDate: input.assessmentDate,
    bankFees: input.bankFees,
  });
  return price - loan.maxLoan + costs.upfrontTotal;
}

describe("the answer is self-consistent", () => {
  it("reproduces its own loan when fed back through the forward direction", () => {
    const result = solve();
    const forward = maxLoanForDate({
      borrower: base.borrower,
      purpose: base.purpose,
      propertyPrice: result.maxPrice,
      annualRate: base.annualRate,
      rateType: base.rateType,
      termYears: base.termYears,
      assessmentDate: base.assessmentDate,
    });
    expect(forward.maxLoan).toBeCloseTo(result.loan, 6);
  });

  it("spends the savings without exceeding them", () => {
    const result = solve();
    expect(result.cashNeeded).toBeLessThanOrEqual(base.savings);
    expect(result.deposit + result.costs.upfrontTotal).toBeCloseTo(
      result.cashNeeded,
      2,
    );
    expect(result.unusedFunds).toBeCloseTo(base.savings - result.cashNeeded, 2);
  });

  it("is a true ceiling: one euro more house needs more cash than there is", () => {
    // The property that makes the bisection meaningful, checked from outside
    // the solver so it cannot pass by agreeing with itself.
    const result = solve();
    expect(cashNeededAt(result.maxPrice, base)).toBeLessThanOrEqual(
      base.savings,
    );
    expect(cashNeededAt(result.maxPrice + 1, base)).toBeGreaterThan(
      base.savings,
    );
  });
});

describe("cashNeeded is monotone in the price", () => {
  it("never falls, right across every discontinuity in the tables", () => {
    // The property the whole search rests on. If a flat IMT band or the
    // guarantee cliff ever produced a DOWNWARD step, bisection would return a
    // silently wrong answer rather than failing, so this is swept explicitly
    // around each known edge.
    const edges = [
      106_346, 145_470, 198_347, 330_539, 450_000, 633_931, 660_982, 1_150_853,
    ];
    const points = edges
      .flatMap((e) => [e - 1, e, e + 1])
      .concat([1_000, 50_000, 250_000, 2_000_000])
      .sort((a, b) => a - b);

    // A borrower rich enough that the DSTI ceiling never binds, and with every
    // discontinuity switched on: the guarantee (a cliff at 450 000) and the
    // young tables (a cliff at 660 982), on top of the taxa-única steps.
    const wealthy: MaxPriceInput = {
      ...base,
      borrower: { monthlyIncome: 40_000, age: 30 },
      stateGuarantee: true,
      youngFirstHome: true,
    };

    let previous = -Infinity;
    for (const price of points) {
      const cash = cashNeededAt(price, wealthy);
      expect(cash, `cash needed at ${price}`).toBeGreaterThanOrEqual(
        previous - 1e-6,
      );
      previous = cash;
    }
  });

  it("makes a bigger deposit buy a bigger house, always", () => {
    let previous = -1;
    for (const savings of [10_000, 25_000, 50_000, 80_000, 150_000, 400_000]) {
      const result = solve({ savings, borrower: { monthlyIncome: 8_000, age: 30 } });
      expect(result.maxPrice, `savings ${savings}`).toBeGreaterThanOrEqual(
        previous,
      );
      previous = result.maxPrice;
    }
  });
});

describe("which limit binds", () => {
  it("reports cash when the savings run out before the income does", () => {
    const result = solve({
      borrower: { monthlyIncome: 8_000, age: 30 },
      savings: 30_000,
    });
    expect(result.bindingConstraint).toBe("cash");
  });

  it("still reports cash when the loan is the part the income froze", () => {
    // The distinction the forward direction cannot make. Here the loan is
    // capped by income, but the PRICE is capped by savings — every euro of
    // house above the loan comes out of the deposit. Saying "rendimento" and
    // then "a bigger deposit does not move this" would be flatly wrong.
    const result = solve({
      borrower: { monthlyIncome: 2_000, age: 30 },
      savings: 200_000,
    });
    expect(result.bindingConstraint).toBe("cash");
    expect(result.loanResult.bindingConstraint).toBe("dsti");
    // And more savings really does buy more house, which is the whole point.
    const richer = solve({
      borrower: { monthlyIncome: 2_000, age: 30 },
      savings: 250_000,
    });
    expect(richer.maxPrice).toBeGreaterThan(result.maxPrice);
  });

  it("returns zero when the costs alone exhaust the savings", () => {
    const result = solve({ savings: 0 });
    expect(result.maxPrice).toBe(0);
    expect(result.bindingConstraint).toBe("cash");
  });
});

describe("the state guarantee", () => {
  // Income high enough that the LTV ceiling is what binds, savings low enough
  // that the deposit is the problem — which is the borrower the guarantee
  // exists for, and the only one on whom it changes anything.
  const depositConstrained = {
    borrower: { monthlyIncome: 6_000, age: 30 },
    savings: 25_000,
  };

  it("raises the LTV ceiling to 100 % for a qualifying borrower", () => {
    const without = solve(depositConstrained);
    const guaranteed = solve({ ...depositConstrained, stateGuarantee: true });
    expect(guaranteed.maxPrice).toBeGreaterThan(without.maxPrice);
    expect(guaranteed.loanResult.ltv.source).toBe("state-guarantee");
    expect(guaranteed.loanResult.ltv.limit).toBe(1);
    expect(without.loanResult.ltv.limit).toBe(0.9);
  });

  it("changes nothing for a borrower the income ceiling already stops", () => {
    // Worth pinning: the guarantee moves the LTV, and a DSTI-bound borrower is
    // not held back by the LTV. Ticking the box does not conjure income.
    const modest = { borrower: { monthlyIncome: 3_000, age: 30 } };
    expect(solve({ ...modest, stateGuarantee: true }).maxPrice).toBe(
      solve(modest).maxPrice,
    );
  });

  it("marks the answer unverified, because that dataset has no Axis B", () => {
    const result = solve({ ...depositConstrained, stateGuarantee: true });
    expect(result.loanResult.parametersVerified).toBe(false);
    expect(result.loanResult.sources.guarantee).toContain("44/2024");
  });

  it("is refused above the transaction ceiling, however the box is ticked", () => {
    const price = STATE_GUARANTEE_2024.maxTransactionValue + 1;
    const above = maxLoanForDate({
      borrower: { monthlyIncome: 20_000, age: 30 },
      purpose: "own-permanent-residence",
      propertyPrice: price,
      annualRate: 0.032,
      termYears: 40,
      stateGuarantee: true,
      assessmentDate: base.assessmentDate,
    });
    expect(above.ltv.source).toBe("recomendacao");
    expect(above.ltv.limit).toBe(0.9);
  });

  it("is refused to a borrower over 35, however the box is ticked", () => {
    const result = maxLoanForDate({
      borrower: { monthlyIncome: 5_000, age: 36 },
      purpose: "own-permanent-residence",
      propertyPrice: 300_000,
      annualRate: 0.032,
      termYears: 30,
      stateGuarantee: true,
      assessmentDate: base.assessmentDate,
    });
    expect(result.ltv.source).toBe("recomendacao");
  });

  it("has lapsed by 2027, and the lookup says so rather than pretending", () => {
    const result = maxLoanForDate({
      borrower: { monthlyIncome: 5_000, age: 30 },
      purpose: "own-permanent-residence",
      propertyPrice: 300_000,
      annualRate: 0.032,
      termYears: 40,
      stateGuarantee: true,
      assessmentDate: "2027-03-01",
    });
    expect(result.ltv.source).toBe("recomendacao");
    expect(result.ltv.limit).toBe(0.9);
  });

  it("flattens the cash slope, which is why small savings go far", () => {
    // While the LTV is what binds, each extra euro of house costs about ten
    // cents of savings; under the guarantee it costs about one, plus tax. That
    // is the whole mechanism, and it is also why the answer becomes sensitive
    // to the bank fees this engine does not model.
    const plain = solve(depositConstrained);
    const guaranteed = solve({ ...depositConstrained, stateGuarantee: true });
    expect(plain.loanResult.bindingConstraint).toBe("ltv");
    expect(plain.cashPerEuroOfPrice).toBeGreaterThan(0.09);
    expect(guaranteed.cashPerEuroOfPrice).toBeLessThan(
      plain.cashPerEuroOfPrice,
    );
  });
});

describe("purchase costs feed back into the answer", () => {
  it("buys less house once the taxes are counted than a naive split would", () => {
    // A 50 000 € deposit at 90 % LTV would "reach" 500 000 € if the taxes did
    // not exist. They do, so the honest answer is materially lower — which is
    // the whole reason this direction had to wait for the cost model.
    const result = solve({ borrower: { monthlyIncome: 10_000, age: 30 } });
    expect(result.maxPrice).toBeLessThan(500_000);
    expect(result.costs.imt.amount).toBeGreaterThan(0);
  });

  it("reaches further for a young first-time buyer", () => {
    const earner = { borrower: { monthlyIncome: 10_000, age: 30 } };
    const plain = solve(earner);
    const young = solve({ ...earner, youngFirstHome: true });
    expect(young.maxPrice).toBeGreaterThan(plain.maxPrice);
    expect(young.costs.imt.amount).toBeLessThan(plain.costs.imt.amount);
  });

  it("pays no IMT at all while the answer stays inside the exemption", () => {
    // A more modest earner lands below 330 539 €, where the exemption is total
    // — IMT, the verba 1.1 selo and the registration emoluments all at zero.
    const young = solve({
      borrower: { monthlyIncome: 3_000, age: 30 },
      savings: 35_000,
      youngFirstHome: true,
    });
    expect(young.maxPrice).toBeLessThan(330_539);
    expect(young.costs.imt.amount).toBe(0);
    expect(young.costs.stampDutyTransfer.amount).toBe(0);
    expect(young.costs.registration.youngReduction).toBeGreaterThan(0);
  });

  it("counts bank fees against the savings", () => {
    const free = solve();
    const charged = solve({ bankFees: 1_500 });
    expect(charged.maxPrice).toBeLessThan(free.maxPrice);
  });
});
