// Crédito ao consumo: rendimento and prazo on the surface, the rest behind
// "O meu caso" — the same shape as the other two tools.
//
// Only the income is needed before an answer appears. There is no property to
// value here, so the DSTI ceiling is the only limit there is.

import { useMemo, useState } from "react";
import type {
  ConsumerCreditKind,
  ConsumerLoanResult,
} from "@pt-finance-tools/engine";
import { maxConsumerLoanForDate, CONSUMER_MARKET } from "@pt-finance-tools/engine";
import {
  DEFAULT_CONSUMER_FORM,
  toConsumerLoanInput,
  validateConsumerForm,
  type ConsumerForm,
  type UpdateConsumerForm,
} from "../lib/consumer-form.js";
import { todayIso, formatRate } from "../lib/format.js";
import { ConsumerResultPanel } from "./ConsumerResultPanel.js";
import { LawReference } from "./LawReference.js";
import { SegmentedField, TextField, ToggleField, type SelectOption } from "./fields.js";

const KIND_OPTIONS: readonly SelectOption[] = [
  { value: "personal", label: "Pessoal" },
  { value: "auto", label: "Automóvel" },
  { value: "personal-earmarked", label: "Educação, saúde ou energia" },
];

const RATE_TYPE_OPTIONS: readonly SelectOption[] = [
  { value: "fixed", label: "Fixa" },
  { value: "variable", label: "Variável" },
];

export type ConsumerOutcome =
  | { ok: true; result: ConsumerLoanResult }
  | { ok: false; message: string };

export function ConsumerCalculator() {
  const assessmentDate = useMemo(() => todayIso(), []);
  const [form, setForm] = useState<ConsumerForm>(DEFAULT_CONSUMER_FORM);

  const update: UpdateConsumerForm = (key, value) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const errors = useMemo(() => validateConsumerForm(form), [form]);
  const input = useMemo(
    () => toConsumerLoanInput(form, assessmentDate),
    [assessmentDate, form],
  );

  const outcome = useMemo<ConsumerOutcome | null>(() => {
    if (!input) return null;
    if (Object.keys(errors).length > 0) {
      return {
        ok: false,
        message: "Corrija os campos assinalados para ver o resultado.",
      };
    }
    try {
      return { ok: true, result: maxConsumerLoanForDate(input) };
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
          id="consumer-income"
          large
          label="Rendimento mensal"
          suffix="€"
          placeholder="1 500,00"
          value={form.income}
          error={errors.income}
          hint="Líquido. Use o rendimento anual a dividir por 12, tenha 14 meses ou passe recibos verdes."
          onChange={(value) => update("income", value)}
        />

        <SegmentedField
          name="consumer-kind"
          legend="Para que é o crédito"
          value={form.kind}
          options={KIND_OPTIONS}
          onChange={(value) => update("kind", value as ConsumerCreditKind)}
          hint={
            <>
              <span>
                A finalidade decide o prazo máximo: 7 anos no crédito pessoal e
                10 no automóvel. O crédito pessoal para educação, saúde ou
                transição energética também pode ir a 10 anos, mas só se o banco
                comprovar a finalidade.
              </span>
              <LawReference id="bdp-1-2026-consumo" />
            </>
          }
        />

        <TextField
          id="consumer-term"
          label="Prazo"
          inputMode="numeric"
          suffix="anos"
          value={form.termYears}
          error={errors.termYears}
          onChange={(value) => update("termYears", value)}
        />

        <details className="advanced">
          <summary>
            <span className="advanced-title">O meu caso</span>
            <span className="advanced-sub">
              Taxa, outros créditos, idade
            </span>
          </summary>

          <div className="advanced-body">
            <section className="field-group">
              <h3 className="group-title">A taxa</h3>
              <TextField
                id="consumer-rate"
                label="Taxa de juro anual"
                suffix="%"
                value={form.annualRate}
                error={errors.annualRate}
                hint={`Por omissão, a taxa média das novas operações de crédito aos consumidores em Portugal: ${formatRate(
                  CONSUMER_MARKET.averageRate,
                )} em ${CONSUMER_MARKET.month} (BCE). Substitua-a pela do seu contrato.`}
                onChange={(value) => update("annualRate", value)}
              />
              <SegmentedField
                name="consumer-rate-type"
                legend="Tipo de taxa"
                value={form.rateType}
                options={RATE_TYPE_OPTIONS}
                onChange={(value) => update("rateType", value as "fixed" | "variable")}
                hint="O crédito ao consumo é quase sempre a taxa fixa. Só a taxa variável é testada com uma subida do indexante."
              />
            </section>

            <section className="field-group">
              <h3 className="group-title">A sua situação</h3>
              <TextField
                id="consumer-existing-debt"
                label="Prestações que já paga"
                suffix="€"
                placeholder="0,00"
                value={form.existingDebt}
                error={errors.existingDebt}
                hint="Total mensal de outros créditos, incluindo o da casa."
                onChange={(value) => update("existingDebt", value)}
              />
              <TextField
                id="consumer-age"
                label="Idade"
                inputMode="numeric"
                suffix="anos"
                value={form.age}
                error={errors.age}
                onChange={(value) => update("age", value)}
              />
              <ToggleField
                id="consumer-retired"
                label="Já reformado(a)"
                checked={form.retired}
                onChange={(checked) => update("retired", checked)}
                hint="Quem já está reformado não sofre a redução de rendimento aplicada aos contratos que passam dos 70 anos."
              />
            </section>
          </div>
        </details>
      </form>

      <ConsumerResultPanel outcome={outcome} input={input} />
    </div>
  );
}
