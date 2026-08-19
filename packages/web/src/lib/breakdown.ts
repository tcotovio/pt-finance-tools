// Turning an engine `WageResult` into the lines the payslip-style breakdown
// shows.
//
// One ordered list, each line signed by its `kind` — which is what a payslip
// is. Order carries meaning: the IRS Jovem credit sits directly under the IRS
// line it gives back, so the pair reads as one story.
//
// Every line is rounded to cents and the total is derived from the rounded
// lines, so the arithmetic on screen always adds up — a payslip does the
// same. The engine keeps full precision internally; the difference between
// its `netMonthly` and the total shown here is at most a cent or two.

import type { WageResult } from "@pt-finance-tools/engine";
import { formatEuro, formatPercent, formatWholePercent } from "./format.js";
import type { LawReferenceId } from "./law.js";

/** Whether a line adds to, subtracts from, or gives back on the total. */
export type LineKind = "earning" | "deduction" | "credit";

export interface BreakdownLine {
  key: string;
  label: string;
  /** Always positive; the sign is carried by {@link BreakdownLine.kind}. */
  amount: number;
  kind: LineKind;
  note?: string;
  /**
   * Render with an explicit "+" and in the credit colour. For earnings that
   * arrive on top of the base pay rather than composing it — the duodécimos.
   * A display hint only: `kind` still decides how the total is computed.
   */
  additive?: boolean;
  /** The statute this line comes from, rendered as an inline citation. */
  reference?: LawReferenceId;
}

/** One slice of where the month's gross actually went. */
export interface BreakdownSlice {
  key: "net" | "irs" | "social-security";
  label: string;
  amount: number;
  /** Fraction of the gross, 0–1. */
  share: number;
}

/** What the month costs the employer, rounded for display. */
export interface EmployerCost {
  /** Everything paid to the worker. */
  remuneration: number;
  /** The employer's own Segurança Social contribution. */
  socialSecurity: number;
  socialSecurityRate: number;
  /** remuneration + socialSecurity, from the rounded parts. */
  total: number;
  /** How many times the net take-home the total is. */
  multipleOfNet: number;
}

export interface Breakdown {
  /** In presentation order, top to bottom. */
  lines: BreakdownLine[];
  /** Everything paid this month, before deductions. */
  gross: number;
  /** Take-home: earnings − deductions + credits, from the rounded lines. */
  net: number;
  /** IRS actually withheld, over the remuneration it was withheld on. */
  effectiveIrsRate: number;
  /** The direct cost to the employer of this month's pay. */
  employer: EmployerCost;
  /**
   * The gross split three ways for the chart: what is kept, and the two
   * things that take the rest. These are the *actual* amounts — the IRS
   * slice is net of the IRS Jovem relief, so the three always sum to the
   * gross, which is what makes a part-to-whole chart honest.
   */
  split: BreakdownSlice[];
}

const cents = (value: number) => Math.round(value * 100) / 100;

const totalOf = (lines: BreakdownLine[], kind: LineKind) =>
  cents(
    lines
      .filter((line) => line.kind === kind)
      .reduce((total, line) => total + line.amount, 0),
  );

export function buildBreakdown(result: WageResult): Breakdown {
  const lines: BreakdownLine[] = [
    {
      key: "base",
      label: "Vencimento base",
      amount: cents(result.grossMonthly),
      kind: "earning",
    },
  ];

  if (result.workScheduleExemption) {
    lines.push({
      key: "work-schedule-exemption",
      label: "Isenção de horário de trabalho",
      amount: cents(result.workScheduleExemption),
      kind: "earning",
      note: "tributada como remuneração normal",
      reference: "ct-265",
    });
  }

  if (result.overtime) {
    lines.push({
      key: "overtime",
      label: "Trabalho suplementar",
      amount: cents(result.overtime.paid),
      kind: "earning",
      additive: true,
      note: `retido a ${formatPercent(result.overtime.rate)}, metade da taxa do mês`,
      reference: "cirs-99c-8",
    });
  }

  if (result.mealAllowance) {
    const { paid, exempt, taxable, dailyLimit } = result.mealAllowance;
    lines.push({
      key: "meal",
      label: "Subsídio de alimentação",
      amount: cents(paid),
      kind: "earning",
      note:
        taxable > 0
          ? `${formatEuro(exempt)} isentos · ${formatEuro(taxable)} tributados (limite ${formatEuro(dailyLimit)}/dia)`
          : `isento na totalidade (limite ${formatEuro(dailyLimit)}/dia)`,
    });
  }

  if (result.twelfths) {
    lines.push({
      key: "twelfths",
      label: "Duodécimos (férias e Natal)",
      amount: cents(result.twelfths.paid),
      kind: "earning",
      additive: true,
      note: "retenção autónoma",
      reference: "cirs-99c-5",
    });
  }

  // With IRS Jovem the IRS line shows what the tables alone would have taken,
  // and the exemption is credited back on the next line — the same net, but
  // the regime's worth is on screen instead of implicit.
  const jovem = result.irsJovem;
  const relief = jovem ? cents(jovem.relief) : 0;
  const credited = relief > 0;

  lines.push({
    key: "irs",
    label: "IRS — retenção na fonte",
    amount: cents(
      credited && jovem
        ? jovem.withholdingWithoutExemption
        : result.irsWithholding,
    ),
    kind: "deduction",
    ...(credited ? { note: "antes da isenção IRS Jovem" } : {}),
  });

  if (credited && jovem) {
    const exempted = [`${formatEuro(jovem.exempt)} do vencimento`];
    if (result.twelfths?.exempt) {
      exempted.push(`${formatEuro(result.twelfths.exempt)} de duodécimos`);
    }
    lines.push({
      key: "irs-jovem",
      label: `IRS Jovem — isenção de ${formatWholePercent(jovem.fraction)}`,
      amount: relief,
      kind: "credit",
      note: `${exempted.join(" + ")} sem IRS`,
      reference: "cirs-12b",
    });
  }

  // Everything the month's IRS and contributions were actually levied on:
  // salary base plus the two autonomous remunerações. Leaving either out
  // understates the base in the note and overstates the effective rate.
  const taxedRemuneration =
    result.taxableBase +
    (result.overtime?.paid ?? 0) +
    (result.twelfths?.paid ?? 0);

  lines.push({
    key: "social-security",
    label: "Segurança Social",
    amount: cents(result.socialSecurity),
    kind: "deduction",
    note: `${formatWholePercent(result.breakdown.socialSecurityRate)} sobre ${formatEuro(taxedRemuneration)}`,
  });

  const gross = totalOf(lines, "earning");
  const net = cents(
    gross - totalOf(lines, "deduction") + totalOf(lines, "credit"),
  );

  const slices: Array<Omit<BreakdownSlice, "share">> = [
    { key: "net", label: "Líquido", amount: net },
    { key: "irs", label: "IRS", amount: cents(result.irsWithholding) },
    {
      key: "social-security",
      label: "Segurança Social",
      amount: cents(result.socialSecurity),
    },
  ];

  const employerRemuneration = cents(result.employerCost.remuneration);
  const employerSocialSecurity = cents(result.employerCost.socialSecurity);

  return {
    lines,
    gross,
    net,
    employer: {
      remuneration: employerRemuneration,
      socialSecurity: employerSocialSecurity,
      socialSecurityRate: result.employerCost.socialSecurityRate,
      total: cents(employerRemuneration + employerSocialSecurity),
      multipleOfNet: net > 0 ? result.employerCost.total / net : 0,
    },
    effectiveIrsRate:
      taxedRemuneration > 0 ? result.irsWithholding / taxedRemuneration : 0,
    split: slices.map((slice) => ({
      ...slice,
      share: gross > 0 ? slice.amount / gross : 0,
    })),
  };
}
