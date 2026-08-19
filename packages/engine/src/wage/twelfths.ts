// Subsídios de férias e de Natal paid in duodécimos (twelfths).
//
// CIRS art. 99.º-C n.º 5: the holiday and Christmas subsidies are "sempre
// objeto de retenção autónoma, não podendo, para cálculo do imposto a reter,
// ser adicionados às remunerações dos meses em que são pagos" — so a
// duodécimo never pushes the salary into a higher bracket, and vice versa.
//
// n.º 6: "Quando os subsídios de férias e de Natal forem pagos
// fracionadamente, deve ser retido, em cada pagamento, a parte proporcional
// do imposto calculado nos termos do número anterior." So the withholding is
// computed on the *whole* subsidy and then pro-rated by the fraction paid —
// equivalently, the subsidy's effective rate applied to the amount paid.

import type {
  IrsJovemInput,
  IrsJovemRegime,
  TwelfthsOption,
  WithholdingTable,
} from "../types.js";
import { irsJovemExemption } from "./irs-jovem.js";
import { selectBracket } from "./resolver.js";
import { withholdingDetailForBracket } from "./withholding-core.js";

/** What a month's duodécimos add to pay and to withholding. */
export interface TwelfthsDetail {
  /** Amount paid this month across both subsidies. */
  paid: number;
  /** IRS withheld on that amount, autonomously (art. 99.º-C n.º 5). */
  withholding: number;
  /** The full-subsidy amount the calculation was based on. */
  subsidyAmount: number;
  /** Withholding due on one whole subsidy, before pro-rating. */
  withholdingOnFullSubsidy: number;
  /**
   * What this month's duodécimo would have withheld without IRS Jovem. Equal
   * to `withholding` when the regime does not apply.
   */
  withholdingWithoutExemption: number;
  /** IRS Jovem exemption applied to this month's duodécimo, if any. */
  exempt?: number;
}

/**
 * Duodécimos for one month.
 *
 * `holiday` and `christmas` are the fraction of each subsidy paid monthly in
 * twelfths — 1 for a subsidy paid entirely in duodécimos, 0.5 for half, 0 for
 * one taken as a lump sum in its usual month. A month therefore pays
 * `subsidyAmount × fraction / 12` per subsidy.
 */
export function twelfthsDetail(
  option: TwelfthsOption,
  subsidyAmount: number,
  dependents: number,
  table: WithholdingTable,
  irsJovem?: { input: IrsJovemInput; regime: IrsJovemRegime },
): TwelfthsDetail {
  const { holiday, christmas } = option;
  for (const [name, f] of [["holiday", holiday], ["christmas", christmas]] as const) {
    if (f < 0 || f > 1) {
      throw new Error(`Twelfths fraction for ${name} must be between 0 and 1, got ${f}.`);
    }
  }

  // The subsidy is a remuneração in its own right: its own bracket, its own
  // parcela a abater and per-dependent deduction.
  const bracket = selectBracket(table, subsidyAmount);
  const withholdingOnFullSubsidy = withholdingDetailForBracket(
    subsidyAmount,
    dependents,
    bracket,
  ).withholding;

  const fraction = (holiday + christmas) / 12;
  const paid = subsidyAmount * fraction;

  // n.º 6: the tax on the whole subsidy, pro-rated by the fraction paid.
  const withholdingWithoutExemption = withholdingOnFullSubsidy * fraction;

  if (!irsJovem) {
    return {
      paid,
      withholding: withholdingWithoutExemption,
      subsidyAmount,
      withholdingOnFullSubsidy,
      withholdingWithoutExemption,
    };
  }

  // The subsidy is exempt income too. Per art. 99.º-F n.º 4 the rate comes
  // from the whole subsidy and is levied on the non-exempt part; the payment
  // carries the same share of the annual ceiling as it does of the subsidy.
  const effectiveRate =
    subsidyAmount > 0 ? withholdingOnFullSubsidy / subsidyAmount : 0;
  const exemption = irsJovemExemption(
    paid,
    irsJovem.input.yearOfIncome,
    irsJovem.regime,
    fraction,
  );

  return {
    paid,
    withholding: effectiveRate * exemption.taxable,
    subsidyAmount,
    withholdingOnFullSubsidy,
    withholdingWithoutExemption,
    exempt: exemption.exempt,
  };
}
