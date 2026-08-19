// The loan calculator: four fields on the surface, everything else behind
// "O meu caso" — the same progressive-disclosure shape as the wage side.
//
// Income and property price are both required before anything is shown: one
// bounds the DSTI ceiling and the other the LTV ceiling, and an answer that
// silently ignored either would be the wrong number rather than a partial one.

import { useMemo, useState } from "react";
import { computeMaxLoanSafely, type LoanOutcome } from "../lib/compute.js";
import {
  DEFAULT_LOAN_FORM,
  toMaxLoanInput,
  validateLoanForm,
  type LoanForm,
  type UpdateLoanForm,
} from "../lib/loan-form.js";
import { todayIso, parseAmount } from "../lib/format.js";
import { LoanAdvancedPanel } from "./LoanAdvancedPanel.js";
import { LoanResultPanel } from "./LoanResultPanel.js";
import { TextField } from "./fields.js";

export function LoanCalculator() {
  // Fixed for the session, like the wage side: the parameters are keyed by
  // the assessment date, and re-reading the clock per render would make the
  // result silently non-deterministic.
  const assessmentDate = useMemo(() => todayIso(), []);
  const [form, setForm] = useState<LoanForm>(DEFAULT_LOAN_FORM);

  const update: UpdateLoanForm = (key, value) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const errors = useMemo(() => validateLoanForm(form), [form]);
  const outcome = useMemo<LoanOutcome | null>(() => {
    const input = toMaxLoanInput(form, assessmentDate);
    if (!input) return null;
    if (Object.keys(errors).length > 0) {
      return {
        ok: false,
        message: "Corrija os campos assinalados para ver o resultado.",
      };
    }
    return computeMaxLoanSafely(input);
  }, [assessmentDate, errors, form]);

  return (
    <div className="calculator">
      <form className="panel form" onSubmit={(event) => event.preventDefault()}>
        <h2 className="visually-hidden">Os seus dados</h2>

        <TextField
          id="loan-income"
          large
          label="Rendimento mensal do agregado"
          suffix="€"
          placeholder="2 000,00"
          value={form.income}
          error={errors.income}
          hint="Líquido, somando quem vai ao crédito. Com 14 meses, use o anual a dividir por 12 — é o que o Banco de Portugal manda usar."
          onChange={(value) => update("income", value)}
        />

        <TextField
          id="loan-price"
          large
          label="Preço do imóvel"
          suffix="€"
          placeholder="250 000,00"
          value={form.propertyPrice}
          error={errors.propertyPrice}
          onChange={(value) => update("propertyPrice", value)}
        />

        <div className="field-row">
          <TextField
            id="loan-age"
            label="Idade"
            inputMode="numeric"
            suffix="anos"
            value={form.age}
            error={errors.age}
            hint="Do mutuário mais velho."
            onChange={(value) => update("age", value)}
          />
          <TextField
            id="loan-term"
            label="Prazo"
            inputMode="numeric"
            suffix="anos"
            value={form.termYears}
            error={errors.termYears}
            onChange={(value) => update("termYears", value)}
          />
        </div>

        <LoanAdvancedPanel form={form} errors={errors} update={update} />
      </form>

      <LoanResultPanel
        outcome={outcome}
        propertyPrice={parseAmount(form.propertyPrice) ?? 0}
        monthlyIncome={parseAmount(form.income) ?? 0}
        existingMonthlyDebt={parseAmount(form.existingDebt) ?? 0}
      />
    </div>
  );
}
