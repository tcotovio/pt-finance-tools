// The single call into the engine, with its failure modes turned into
// something the UI can render.
//
// The engine throws when no dataset covers the requested region and date —
// Madeira and the Açores are not transcribed yet, and a date before the 2026
// tables is equally out of coverage. That is a legitimate answer to show,
// not a crash.

import {
  computeNetWageForDate,
  maxLoanForDate,
} from "@pt-finance-tools/engine";
import type {
  MaxLoanInput,
  MaxLoanResult,
  WageInput,
  WageResult,
} from "@pt-finance-tools/engine";

export type ComputeOutcome =
  | { ok: true; result: WageResult }
  | { ok: false; message: string };

export function computeSafely(input: WageInput): ComputeOutcome {
  try {
    return { ok: true, result: computeNetWageForDate(input) };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível calcular com estes dados.",
    };
  }
}

export type LoanOutcome =
  | { ok: true; result: MaxLoanResult }
  | { ok: false; message: string };

/**
 * The same treatment for the loan side. The engine throws when no
 * macroprudential parameters cover the assessment date — anything before
 * 1 August 2026 falls under the 2018 Recomendação, which is not modelled.
 */
export function computeMaxLoanSafely(input: MaxLoanInput): LoanOutcome {
  try {
    return { ok: true, result: maxLoanForDate(input) };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível calcular com estes dados.",
    };
  }
}
