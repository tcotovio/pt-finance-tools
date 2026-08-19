// Trabalho suplementar — CIRS art. 99.º-C n.º 8, with the arithmetic spelled
// out by despacho 233-A/2026 §5.f:
//
//   "Quando for paga remuneração relativa a trabalho suplementar, é aplicada a
//    taxa efetiva mensal de retenção na fonte correspondente a 50 % da que
//    resultou, após a aplicação da taxa marginal máxima, da parcela a abater
//    e, se aplicável, da parcela adicional a abater por dependente, para a
//    remuneração mensal do trabalho dependente referente ao mês em que aquela
//    é paga ou colocada à disposição"
//
// Three things follow, and each matters:
//
//   * the reference is the *effective* rate — withholding ÷ remuneração, after
//     both parcelas — not the bracket's marginal rate;
//   * it is the rate for the month's salary, so overtime never enters the
//     salary's own bracket lookup (autonomous, like the subsídios);
//   * Lei n.º 45-A/2024 dropped the old "a partir da 101.ª hora" threshold, so
//     the halving applies from the first hour and no cumulative-hour count is
//     needed.
//
// Overtime is remuneração for Segurança Social, which the caller adds to the
// contribution base.

/** What a month's trabalho suplementar adds to pay and to withholding. */
export interface OvertimeDetail {
  /** Amount paid this month. */
  paid: number;
  /** The rate actually levied: half the month's effective rate. */
  rate: number;
  /** IRS withheld on it. */
  withholding: number;
  /** Exempt part under IRS Jovem, if any. */
  exempt?: number;
}

/** IRS Jovem as it applies to this payment. */
export interface OvertimeExemption {
  /** Exempt share for the year of earning (1 = 100 %). */
  fraction: number;
  /**
   * What is left of the month's exemption ceiling after the salary has taken
   * its part. Despacho §5.g caps the year's *accumulated* monthly exemptions
   * at the annual limit ÷ 14, so overtime shares the month's slot rather than
   * carrying one of its own.
   */
  capHeadroom: number;
}

export const OVERTIME_RATE_FACTOR = 0.5;

/**
 * Withholding on this month's trabalho suplementar.
 *
 * `monthlyEffectiveRate` is the salary's effective rate for the month —
 * `withholding / remuneração` — which the caller has already computed for the
 * bracket lookup.
 */
export function overtimeDetail(
  paid: number,
  monthlyEffectiveRate: number,
  jovem?: OvertimeExemption,
): OvertimeDetail {
  if (paid < 0) {
    throw new Error(`overtime must not be negative, got ${paid}.`);
  }

  const rate = monthlyEffectiveRate * OVERTIME_RATE_FACTOR;

  if (!jovem) {
    return { paid, rate, withholding: rate * paid };
  }

  // Art. 99.º-F n.º 4 again: the rate is the one for the full remuneration,
  // levied only on the part that is not exempt.
  const exempt = Math.min(paid * jovem.fraction, Math.max(jovem.capHeadroom, 0));

  return { paid, rate, withholding: rate * (paid - exempt), exempt };
}
