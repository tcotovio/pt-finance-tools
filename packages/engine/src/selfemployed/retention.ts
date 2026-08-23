// Retenção na fonte on a categoria B invoice — CIRS arts. 101.º / 101.º-B.
//
// Flat and per-invoice, with three separate routes to zero. They are not
// interchangeable: one is the worker's own forecast of the year, one is a fact
// about the client, and one is arithmetic on the invoice. A result that
// reported only "0 €" would leave the user unable to tell which applies to
// them next month.

import type { CategoryBRetention, RetentionCategory } from "../types.js";

export interface RetentionOptions {
  /** Art. 101.º-B n.º 1 al. a) — the worker expects to stay under the ceiling. */
  dispensed?: boolean;
  /** The payer has no contabilidade organizada, so art. 101.º n.º 1 misses it. */
  clientDoesNotWithhold?: boolean;
}

export interface RetentionResult {
  amount: number;
  rate: number;
  category: RetentionCategory;
  dispensed: boolean;
  dispensaReason?: "annual-threshold" | "client" | "below-minimum";
}

/**
 * Retention on one month's invoicing.
 *
 * The order of the tests is the order of the statute and it is observable: the
 * client test comes first because art. 101.º n.º 1 only ever *binds* an entity
 * with contabilidade organizada, so for anyone else there is no obligation for
 * art. 101.º-B to then dispense. The minimum comes last because it is computed
 * from the rate, which the earlier routes never reach.
 */
export function retentionOnInvoice(
  invoiced: number,
  category: RetentionCategory,
  params: CategoryBRetention,
  options: RetentionOptions = {},
): RetentionResult {
  const rate = params.rates[category];
  const base = { rate, category };

  if (options.clientDoesNotWithhold) {
    return { ...base, amount: 0, dispensed: true, dispensaReason: "client" };
  }
  if (options.dispensed) {
    return {
      ...base,
      amount: 0,
      dispensed: true,
      dispensaReason: "annual-threshold",
    };
  }

  const amount = invoiced * rate;
  if (amount < params.minimumRetention) {
    return {
      ...base,
      amount: 0,
      dispensed: true,
      dispensaReason: "below-minimum",
    };
  }
  return { ...base, amount, dispensed: false };
}
