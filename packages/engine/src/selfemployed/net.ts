// What is left of a categoria B invoice this month.
//
// Deliberately not called a net wage. The categoria A calculator answers "what
// lands in my account from a salary"; this answers "what of this invoice is
// actually mine", which is a different question with a different shape — three
// instruments instead of one, and an IVA line that is money passing through.

import {
  getCategoryBRetention,
  getIas,
  getSelfEmployedContributions,
  getVatExemption,
} from "../data/index.js";
import type {
  SelfEmployedInput,
  SelfEmployedResult,
  SourceRef,
} from "../types.js";
import {
  contributionAmount,
  contributionBase,
  periodIncome,
  relevantIncome,
} from "./contributions.js";
import { retentionOnInvoice } from "./retention.js";

/**
 * The month's calculation, from the datasets in effect on the input's
 * reference date.
 *
 * Composed from the three modules rather than restating any of them, so the
 * per-invoice rules (retention) and the per-period rules (contributions) each
 * stay in the file that owns their statute.
 */
export function selfEmployedNet(
  input: SelfEmployedInput,
): SelfEmployedResult {
  const { referenceDate, monthlyInvoicing: invoiced } = input;

  if (!(invoiced >= 0) || !Number.isFinite(invoiced)) {
    throw new Error("monthlyInvoicing must be a non-negative, finite number.");
  }

  const retentionParams = getCategoryBRetention(referenceDate);
  const vatParams = getVatExemption(referenceDate);
  const contributionParams = getSelfEmployedContributions(referenceDate);
  const ias = getIas(referenceDate);

  // --- IVA: charged on top, and never the worker's money. ------------------
  const chargesVat = input.chargesVat === true;
  const vatAmount = chargesVat ? invoiced * vatParams.standardRate : 0;

  // --- Retention: per invoice, on the value before IVA. --------------------
  // Art. 101.º puts it on the "rendimentos ilíquidos", and IVA is not income:
  // it is the State's money collected on the State's behalf. Withholding on
  // the invoice total would overstate the retention by 23 % of itself.
  const retention = retentionOnInvoice(
    invoiced,
    input.retentionCategory,
    retentionParams,
    {
      dispensed: input.retentionDispensed,
      clientDoesNotWithhold: input.clientDoesNotWithhold,
    },
  );

  // --- Contribution: per period, on a base derived from the quarter. -------
  const period = periodIncome(invoiced, input.quarter, contributionParams);
  const relevant = relevantIncome(
    period.total,
    input.activity,
    contributionParams,
  );
  const { base, cappedByCeiling, accumulationRelief } = contributionBase(
    relevant,
    ias.value,
    contributionParams,
    input.accumulatesEmployment,
  );
  const deferred = input.firstActivityDeferral === true;
  const contribution = deferred
    ? { amount: 0, rate: contributionParams.rate, atMinimum: false }
    : contributionAmount(base, contributionParams, {
        soleTrader: input.soleTrader,
        exemptByAccumulation: input.accumulatesEmployment,
      });

  const net = invoiced - retention.amount - contribution.amount;

  return {
    invoiced,
    vat: {
      amount: vatAmount,
      rate: vatParams.standardRate,
      exempt: !chargesVat,
      invoiceTotal: invoiced + vatAmount,
    },
    retention,
    contribution: {
      amount: contribution.amount,
      rate: contribution.rate,
      periodInvoicing: period.total,
      relevantIncome: relevant,
      base,
      coefficient: contributionParams.coefficient[input.activity],
      cappedByCeiling,
      atMinimum: contribution.atMinimum,
      accumulationRelief,
      deferred,
      quarterAssumed: !period.given,
    },
    net,
    // Guarded rather than assumed: a zero invoice is a legitimate month for
    // someone between contracts, and it still owes the 20 € floor — so the
    // effective rate has no denominator, not a rate of zero.
    effectiveRate: invoiced > 0 ? net / invoiced : 0,
    sources: selfEmployedSources(referenceDate),
    verified:
      retentionParams.verified &&
      vatParams.verified &&
      contributionParams.verified &&
      ias.verified,
    isWithholdingEstimate: true,
  };
}

/** Provenance of every dataset the answer leaned on. */
function selfEmployedSources(referenceDate: string): SourceRef[] {
  const retention = getCategoryBRetention(referenceDate);
  const vat = getVatExemption(referenceDate);
  const contributions = getSelfEmployedContributions(referenceDate);
  const ias = getIas(referenceDate);

  return [
    {
      key: "cirs-101",
      citation: retention.source,
      verified: retention.verified,
    },
    { key: "civa-53", citation: vat.source, verified: vat.verified },
    {
      key: "cc-independentes",
      citation: contributions.source,
      verified: contributions.verified,
    },
    { key: "ias", citation: ias.source, verified: ias.verified },
  ];
}
