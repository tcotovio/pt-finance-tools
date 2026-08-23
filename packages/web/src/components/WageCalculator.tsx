// The calculator: form state in one place, engine call derived from it.
//
// There is no "calcular" button on purpose — the whole computation is local
// and instantaneous, so the result simply follows what is typed.

import { useMemo, useState } from "react";
import type { TaxpayerCategory } from "@pt-finance-tools/engine";
import { computeSafely, type ComputeOutcome } from "../lib/compute.js";
import {
  DEFAULT_FORM,
  toWageInput,
  validateForm,
  type UpdateForm,
  type WageForm,
} from "../lib/form.js";
import { todayIso } from "../lib/format.js";
import { AdvancedPanel } from "./AdvancedPanel.js";
import { ResultPanel } from "./ResultPanel.js";
import { SelectField, TextField, type SelectOption } from "./fields.js";

const CATEGORY_OPTIONS: readonly SelectOption[] = [
  { value: "unmarried", label: "Não casado(a)" },
  { value: "married-single-earner", label: "Casado(a), um titular" },
  { value: "married-dual-earner", label: "Casado(a), dois titulares" },
];

export function WageCalculator() {
  // Fixed for the session: the datasets are keyed by date, and re-reading the
  // clock on every render would make the result silently non-deterministic.
  const referenceDate = useMemo(() => todayIso(), []);
  const [form, setForm] = useState<WageForm>(DEFAULT_FORM);

  const update: UpdateForm = (key, value) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const errors = useMemo(() => validateForm(form), [form]);
  // Lifted out of the outcome: the rate curve resamples this same input
  // across a range of salaries, so it needs the input rather than the result.
  const input = useMemo(() => toWageInput(form, referenceDate), [form, referenceDate]);
  const outcome = useMemo<ComputeOutcome | null>(() => {
    // No usable gross yet: the empty state, not an error.
    if (!input) return null;
    // Something else is malformed — say so instead of showing a number that
    // silently ignores what the user typed.
    if (Object.keys(errors).length > 0) {
      return {
        ok: false,
        message: "Corrija os campos assinalados para ver o resultado.",
      };
    }
    return computeSafely(input);
  }, [errors, input]);

  return (
    <div className="calculator">
      <form className="panel form" onSubmit={(event) => event.preventDefault()}>
        <h2 className="visually-hidden">Os seus dados</h2>

        <TextField
          id="gross"
          large
          label="Vencimento base mensal"
          suffix="€"
          placeholder="1 500,00"
          value={form.gross}
          error={errors.gross}
          hint="Bruto, antes de descontos e sem subsídio de alimentação. Trabalho dependente — não serve para recibos verdes."
          onChange={(value) => update("gross", value)}
        />

        <div className="field-row">
          <SelectField
            id="category"
            label="Situação"
            value={form.category}
            options={CATEGORY_OPTIONS}
            onChange={(value) => update("category", value as TaxpayerCategory)}
          />
          <TextField
            id="dependents"
            label="Dependentes"
            inputMode="numeric"
            value={form.dependents}
            error={errors.dependents}
            onChange={(value) => update("dependents", value)}
          />
        </div>

        <AdvancedPanel
          form={form}
          errors={errors}
          update={update}
          referenceDate={referenceDate}
        />
      </form>

      <ResultPanel outcome={outcome} input={input} />
    </div>
  );
}
