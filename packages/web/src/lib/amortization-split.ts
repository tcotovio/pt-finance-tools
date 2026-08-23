// How each instalment divides between interest and capital, year by year.
//
// The instalment is constant, but what it BUYS is not. On a 40-year loan at
// 3,2 % the first payment is about two thirds interest, and the borrower does
// not repay more capital than interest until nearly half way through the
// contract. That is the least intuitive thing about a mortgage, and the panel
// had no way to say it: the breakdown showed one lump of interest for the
// whole term, which is the number you arrive at *after* the surprise.
//
// The aggregation is yearly rather than monthly on purpose. 480 points on a
// 560px chart is a solid block of ink; 40 is a shape.

import { amortizationSchedule } from "@pt-finance-tools/engine";

export interface AmortizationYear {
  /** 1-based, so "ano 1" is the first twelve instalments. */
  year: number;
  interest: number;
  principal: number;
  /** Outstanding at the end of the year. */
  balance: number;
}

export interface AmortizationSplit {
  years: AmortizationYear[];
  /** The first year in which capital repaid exceeds interest paid. */
  crossoverYear?: number;
  /** Interest as a share of the very first instalment, 0–1. */
  firstMonthInterestShare: number;
  /** What that first instalment actually knocks off the debt. */
  firstMonthPrincipal: number;
  /** Share of the contract's whole interest bill paid in its first half. */
  interestInFirstHalf: number;
  /**
   * Where the debt stands half way through, which is the most durable way to
   * show the front-loading.
   *
   * The crossover year is the vivid number but it moves enormously with the
   * term and the rate — year 3 of 25 on a small cheap loan, year 22 of 40 on
   * a large expensive one — so it cannot carry the explanation on its own.
   * The halfway balance barely moves at all: across ordinary Portuguese
   * mortgages it lands between 61 % and 67 % still owed, which is the fact
   * worth putting in words.
   */
  halfway: {
    year: number;
    balance: number;
    /** Balance over the original principal, 0–1. */
    shareOutstanding: number;
  };
  totalInterest: number;
}

/**
 * Returns `null` for a loan with nothing to amortize, so the caller can leave
 * the chart out rather than render an empty frame.
 */
export function buildAmortizationSplit(
  principal: number,
  annualRate: number,
  termYears: number,
): AmortizationSplit | null {
  const months = Math.round(termYears * 12);
  if (principal <= 0 || months <= 0) return null;

  const schedule = amortizationSchedule(principal, annualRate, months);
  const first = schedule[0];
  if (!first) return null;

  const years: AmortizationYear[] = [];
  for (let index = 0; index < schedule.length; index += 12) {
    const periods = schedule.slice(index, index + 12);
    const last = periods[periods.length - 1];
    if (!last) continue;
    years.push({
      year: index / 12 + 1,
      interest: periods.reduce((sum, period) => sum + period.interest, 0),
      principal: periods.reduce((sum, period) => sum + period.principal, 0),
      balance: last.balance,
    });
  }

  const totalInterest = schedule.reduce((sum, period) => sum + period.interest, 0);
  const half = Math.floor(schedule.length / 2);
  const interestInFirstHalf =
    totalInterest > 0
      ? schedule
          .slice(0, half)
          .reduce((sum, period) => sum + period.interest, 0) / totalInterest
      : 0;

  // Rounded down, so a 25-year contract reports the end of year 12 rather
  // than inventing a mid-year balance. The copy names the year it used.
  const halfwayYear = years[Math.max(0, Math.floor(years.length / 2) - 1)]!;

  return {
    years,
    crossoverYear: years.find((year) => year.principal > year.interest)?.year,
    firstMonthInterestShare:
      first.payment > 0 ? first.interest / first.payment : 0,
    firstMonthPrincipal: first.principal,
    interestInFirstHalf,
    halfway: {
      year: halfwayYear.year,
      balance: halfwayYear.balance,
      shareOutstanding: halfwayYear.balance / principal,
    },
    totalInterest,
  };
}
