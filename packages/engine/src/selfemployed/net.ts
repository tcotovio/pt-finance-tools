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
  const vatRate = vatParams.standardRate[input.region ?? "continente"];
  const vatAmount = chargesVat ? invoiced * vatRate : 0;

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
    input.includeIntellectualProperty,
  );
  const { base, cappedByCeiling, accumulationRelief } = contributionBase(
    relevant,
    ias.value,
    contributionParams,
    input.accumulatesEmployment,
  );
  const excludedFromBase =
    input.activity === "intellectual-property" &&
    input.includeIntellectualProperty !== true;
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
      rate: vatRate,
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
      // The coefficient that was actually applied, so the panel's arithmetic
      // reconciles: reporting the table's 70 % beside a base of zero would
      // print a sum that does not add up.
      coefficient: excludedFromBase
        ? 0
        : contributionParams.coefficient[input.activity],
      cappedByCeiling,
      atMinimum: contribution.atMinimum,
      excludedFromBase,
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
    /*
      Only the datasets that actually entered the arithmetic.

      The IVA dataset is the reason this is conditional rather than a flat AND
      of all four. Under the art. 53.º exemption — the common case here, and
      the form's default — no rate from it is applied to anything: the invoice
      total is the invoiced amount, and the exemption reached the answer as the
      caller's assertion rather than as a number from a table. Letting its
      unverified flag pull the whole result down would put "Dados por
      verificar" on an answer whose every figure came from a cross-checked
      dataset, which is the badge lying in the cautious direction. It still
      lies. The same reasoning is why the loan side lists the state guarantee
      only when it moved the ceiling.
    */
    verified:
      retentionParams.verified &&
      contributionParams.verified &&
      ias.verified &&
      (!chargesVat || vatParams.verified),
    isWithholdingEstimate: true,
  };
}

/**
 * Provenance of every dataset the answer leaned on.
 *
 * The CIVA entry is listed either way — the panel cites art. 53.º on screen to
 * explain why there is no IVA line, so a reader following that citation must
 * find it here. Whether it counts towards {@link SelfEmployedResult.verified}
 * is a separate question, answered at the call site.
 */
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
    // Reported at its own flag either way, which is simply the truth about the
    // dataset. Whether it drags the composed answer down is the separate
    // question decided at the call site.
    { key: "civa-53", citation: vat.source, verified: vat.verified },
    {
      key: "cc-independentes",
      citation: contributions.source,
      verified: contributions.verified,
    },
    { key: "ias", citation: ias.source, verified: ias.verified },
  ];
}
