// IRS Jovem applied at source (CIRS art. 99.º-F n.º 4).
//
// The mechanism is deliberately not "tax the non-exempt part as if it were
// the whole salary". Art. 99.º-F n.º 4:
//
//   "devem aplicar a taxa de retenção que resultar do despacho previsto no
//    n.º 1 para a totalidade dos rendimentos, incluindo os isentos, apenas à
//    parte dos rendimentos que não esteja isenta"
//
// So the *rate* comes from the full remuneration — exempt part included —
// and is then levied only on the non-exempt part. A young worker keeps the
// progressivity of their real salary; the exemption shrinks the base, not
// the rate.

import type { IrsJovemRegime } from "../types.js";

/** The exemption applied to one payment. */
export interface IrsJovemExemption {
  /** Exempt share for the year of earning (1 = 100 %). */
  fraction: number;
  /** Ceiling on the exempt amount for this payment, in euros. */
  cap: number;
  /** Exempt euros after the ceiling. */
  exempt: number;
  /** The part still subject to withholding. */
  taxable: number;
  /** Whether the ceiling bit — useful for the UI to explain a surprise. */
  capped: boolean;
}

/**
 * Exempt share for a year of earning, 1-based (year 1 … year 10). Years
 * beyond the schedule are not covered by the regime and exempt nothing.
 */
export function exemptionFraction(
  yearOfIncome: number,
  regime: IrsJovemRegime,
): number {
  if (!Number.isInteger(yearOfIncome) || yearOfIncome < 1) {
    throw new Error(
      `IRS Jovem yearOfIncome must be a positive integer, got ${yearOfIncome}.`,
    );
  }
  return regime.exemptionByYear[yearOfIncome - 1] ?? 0;
}

/**
 * The per-payment exemption ceiling: the annual limit (capMultiplier × IAS)
 * spread over the year's payments (§5.g). `share` scales it for a payment
 * that is only a fraction of a full one — a duodécimo carries the same
 * fraction of the slot as of the subsidy.
 */
export function paymentExemptionCap(
  regime: IrsJovemRegime,
  share = 1,
): number {
  return (
    (regime.capMultiplier * regime.ias * share) / regime.paymentsPerYear
  );
}

/** Split one payment into its exempt and still-taxable parts. */
export function irsJovemExemption(
  amount: number,
  yearOfIncome: number,
  regime: IrsJovemRegime,
  share = 1,
): IrsJovemExemption {
  const fraction = exemptionFraction(yearOfIncome, regime);
  const cap = paymentExemptionCap(regime, share);
  const uncapped = amount * fraction;
  const exempt = Math.min(uncapped, cap);

  return {
    fraction,
    cap,
    exempt,
    taxable: amount - exempt,
    capped: uncapped > cap,
  };
}
