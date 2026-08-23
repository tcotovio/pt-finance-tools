// Recibos verdes: what is left of the invoice this month.
//
// Two fields on the surface — what you invoice and what the activity is —
// because those two decide both the retention rate and the coefficient. Every
// other rule is a toggle behind "O meu caso", and each of them is a real
// statutory switch rather than a preference.

import { useMemo, useState } from "react";
import type { SelfEmployedResult } from "@pt-finance-tools/engine";
import { selfEmployedNet } from "@pt-finance-tools/engine";
import {
  ACTIVITY_PRESETS,
  DEFAULT_SELF_EMPLOYED_FORM,
  toSelfEmployedInput,
  validateSelfEmployedForm,
  type ActivityPreset,
  type SelfEmployedForm,
  type UpdateSelfEmployedForm,
} from "../lib/selfemployed-form.js";
import { todayIso } from "../lib/format.js";
import { SelfEmployedResultPanel } from "./SelfEmployedResultPanel.js";
import {
  SelectField,
  TextField,
  ToggleField,
  type SelectOption,
} from "./fields.js";

export type SelfEmployedOutcome =
  | { ok: true; result: SelfEmployedResult }
  | { ok: false; message: string };

const PRESET_OPTIONS: readonly SelectOption[] = (
  Object.keys(ACTIVITY_PRESETS) as ActivityPreset[]
).map((key) => ({ value: key, label: ACTIVITY_PRESETS[key].label }));

export function SelfEmployedCalculator() {
  const referenceDate = useMemo(() => todayIso(), []);
  const [form, setForm] = useState<SelfEmployedForm>(
    DEFAULT_SELF_EMPLOYED_FORM,
  );

  const update: UpdateSelfEmployedForm = (key, value) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const errors = useMemo(() => validateSelfEmployedForm(form), [form]);
  const input = useMemo(
    () => toSelfEmployedInput(form, referenceDate),
    [form, referenceDate],
  );

  const outcome = useMemo<SelfEmployedOutcome | null>(() => {
    if (!input) return null;
    if (Object.keys(errors).length > 0) {
      return {
        ok: false,
        message: "Corrija os campos assinalados para ver o resultado.",
      };
    }
    try {
      return { ok: true, result: selfEmployedNet(input) };
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível calcular com estes dados.",
      };
    }
  }, [errors, input]);

  return (
    <div className="calculator">
      <form className="panel form" onSubmit={(event) => event.preventDefault()}>
        <h2 className="visually-hidden">Os seus dados</h2>

        <TextField
          id="se-invoicing"
          large
          label="Quanto fatura por mês"
          suffix="€"
          placeholder="2 000,00"
          value={form.invoicing}
          error={errors.invoicing}
          hint="Sem IVA. É sobre este valor que incide a retenção."
          onChange={(value) => update("invoicing", value)}
        />

        <SelectField
          id="se-preset"
          label="Tipo de atividade"
          value={form.preset}
          options={PRESET_OPTIONS}
          hint={ACTIVITY_PRESETS[form.preset].hint}
          onChange={(value) => update("preset", value as ActivityPreset)}
        />

        <details className="advanced">
          <summary>
            <span className="advanced-title">O meu caso</span>
            <span className="advanced-sub">
              Trimestre, IVA, dispensa de retenção, acumulação
            </span>
          </summary>

          <div className="advanced-body">
            <section className="field-group">
              <h3 className="group-title">O trimestre</h3>
              <ToggleField
                id="se-irregular"
                label="O trimestre passado não foi regular"
                checked={form.irregularQuarter}
                onChange={(checked) => update("irregularQuarter", checked)}
                hint="A Segurança Social deste mês é calculada sobre o trimestre anterior, não sobre o que fatura agora. Se os três meses foram diferentes, indique-os."
              />
              {form.irregularQuarter ? (
                <div className="field-row">
                  <TextField
                    id="se-q1"
                    label="Mês 1"
                    suffix="€"
                    value={form.quarter1}
                    error={errors.quarter1}
                    onChange={(value) => update("quarter1", value)}
                  />
                  <TextField
                    id="se-q2"
                    label="Mês 2"
                    suffix="€"
                    value={form.quarter2}
                    error={errors.quarter2}
                    onChange={(value) => update("quarter2", value)}
                  />
                  <TextField
                    id="se-q3"
                    label="Mês 3"
                    suffix="€"
                    value={form.quarter3}
                    error={errors.quarter3}
                    onChange={(value) => update("quarter3", value)}
                  />
                </div>
              ) : null}
            </section>

            <section className="field-group">
              <h3 className="group-title">O IRS</h3>
              <ToggleField
                id="se-dispensed"
                label="Dispensado de retenção"
                checked={form.retentionDispensed}
                onChange={(checked) => update("retentionDispensed", checked)}
                hint="Quem prevê faturar menos de 15 000 € no ano pode dispensar a retenção (art. 101.º-B). É uma previsão sua, por isso a simulação pergunta em vez de deduzir."
              />
              <ToggleField
                id="se-client"
                label="Fatura a particulares"
                checked={form.clientDoesNotWithhold}
                onChange={(checked) => update("clientDoesNotWithhold", checked)}
                hint="Só quem tem contabilidade organizada retém. A um cliente particular não há retenção nenhuma, independentemente do valor."
              />
            </section>

            <section className="field-group">
              <h3 className="group-title">A Segurança Social</h3>
              <ToggleField
                id="se-first-year"
                label="Primeiro ano de atividade"
                checked={form.firstActivityDeferral}
                onChange={(checked) => update("firstActivityDeferral", checked)}
                hint="Quem abre atividade pela primeira vez só começa a contribuir no 12.º mês seguinte. Não se aplica a um reinício."
              />
              <ToggleField
                id="se-accumulates"
                label="Também é trabalhador por conta de outrem"
                checked={form.accumulatesEmployment}
                onChange={(checked) => update("accumulatesEmployment", checked)}
                hint="Nesse caso só contribui sobre a parte que exceder 4 × IAS. Exige ainda que o salário seja superior a 1 × IAS, o que esta simulação não verifica."
              />
              <ToggleField
                id="se-sole-trader"
                label="Empresário em nome individual ou EIRL"
                checked={form.soleTrader}
                onChange={(checked) => update("soleTrader", checked)}
                hint="Contribui a 25,2 % em vez de 21,4 %."
              />
            </section>

            <section className="field-group">
              <h3 className="group-title">O IVA</h3>
              <ToggleField
                id="se-vat"
                label="Cobra IVA"
                checked={form.chargesVat}
                onChange={(checked) => update("chargesVat", checked)}
                hint="Fora da isenção do artigo 53.º, ou seja, com mais de 15 000 € de faturação no ano anterior. Não muda o que fica para si — muda o que o cliente paga."
              />
            </section>
          </div>
        </details>
      </form>

      <SelfEmployedResultPanel outcome={outcome} />
    </div>
  );
}
