// "O meu caso" — everything past the two or three fields most people need.
//
// Progressive disclosure (PLAN.md §1): a native <details> keeps it collapsed
// by default, still reachable by keyboard, and open-able before JavaScript
// has anything to do with it.

import type {
  MealAllowanceMethod,
  Region,
} from "@pt-finance-tools/engine";
import type { FormErrors, TwelfthsChoice, UpdateForm, WageForm } from "../lib/form.js";
import { formatEuro, formatWholePercent, parseAmount } from "../lib/format.js";
import { irsJovemRegimeFor, mealLimitsFor } from "../lib/reference.js";
import { LawReference } from "./LawReference.js";
import {
  SegmentedField,
  SelectField,
  TextField,
  ToggleField,
  type SelectOption,
} from "./fields.js";

const REGION_OPTIONS: readonly SelectOption[] = [
  { value: "continente", label: "Continente" },
  // Madeira and the Açores have their own tables; not transcribed yet
  // (PLAN.md Phase 3), and the engine would refuse the calculation.
  { value: "madeira", label: "Madeira (em breve)", disabled: true },
  { value: "acores", label: "Açores (em breve)", disabled: true },
];

const MEAL_METHOD_OPTIONS: readonly SelectOption[] = [
  { value: "card", label: "Cartão" },
  { value: "cash", label: "Dinheiro" },
];

const TWELFTHS_OPTIONS: readonly SelectOption[] = [
  { value: "0", label: "Não" },
  { value: "0.5", label: "Metade" },
  { value: "1", label: "Sim" },
];

interface AdvancedPanelProps {
  form: WageForm;
  errors: FormErrors;
  update: UpdateForm;
  referenceDate: string;
}

export function AdvancedPanel({
  form,
  errors,
  update,
  referenceDate,
}: AdvancedPanelProps) {
  const mealLimits = mealLimitsFor(referenceDate);
  const jovemRegime = irsJovemRegimeFor(referenceDate);

  const mealLimitHint = mealLimits
    ? `Isento até ${formatEuro(mealLimits.perDay[form.mealMethod])} por dia; o excesso conta para o IRS e para a Segurança Social.`
    : undefined;

  const jovemYearOptions: readonly SelectOption[] = (
    jovemRegime?.exemptionByYear ?? []
  ).map((fraction, index) => ({
    value: String(index + 1),
    label: `${index + 1}.º ano — ${formatWholePercent(fraction)} isento`,
  }));

  return (
    <details className="advanced">
      <summary>
        <span className="advanced-title">O meu caso</span>
        <span className="advanced-sub">
          Isenção de horário, trabalho suplementar, subsídios, IRS Jovem
        </span>
      </summary>

      <div className="advanced-body">
        <section className="field-group">
          <h3 className="group-title">Isenção de horário de trabalho</h3>
          <TextField
            id="work-schedule-exemption"
            label="Valor mensal"
            suffix="€"
            placeholder="0,00"
            value={form.workScheduleExemption}
            error={errors.workScheduleExemption}
            hint={
              <>
                Retribuição específica de quem trabalha sem horário fixo
                (<LawReference id="ct-265" />). Soma-se ao vencimento para IRS
                e para a Segurança Social.
              </>
            }
            onChange={(value) => update("workScheduleExemption", value)}
          />
          {(parseAmount(form.workScheduleExemption) ?? 0) > 0 ? (
            <ToggleField
              id="subsidies-include-exemption"
              label="Os subsídios incluem a isenção de horário"
              checked={form.subsidiesIncludeExemption}
              onChange={(checked) =>
                update("subsidiesIncludeExemption", checked)
              }
              hint="Depende do contrato ou do IRCT aplicável. Afeta o valor dos subsídios de férias e de Natal, e portanto os duodécimos."
            />
          ) : null}
        </section>

        <section className="field-group">
          <h3 className="group-title">Trabalho suplementar</h3>
          <TextField
            id="overtime"
            label="Valor pago este mês"
            suffix="€"
            placeholder="0,00"
            value={form.overtime}
            error={errors.overtime}
            hint={
              <>
                Retido a metade da taxa do mês, desde a primeira hora
                (<LawReference id="cirs-99c-8" />). Não sobe o escalão do
                salário, mas desconta para a Segurança Social.
              </>
            }
            onChange={(value) => update("overtime", value)}
          />
        </section>

        <section className="field-group">
          <h3 className="group-title">Subsídio de alimentação</h3>
          <ToggleField
            id="meal"
            label="Recebo subsídio de alimentação"
            checked={form.meal}
            onChange={(checked) => update("meal", checked)}
          />
          {form.meal ? (
            <div className="field-row">
              <TextField
                id="meal-daily"
                label="Valor por dia"
                suffix="€"
                placeholder={mealLimits ? String(mealLimits.perDay[form.mealMethod]).replace(".", ",") : "0,00"}
                value={form.mealDailyAmount}
                error={errors.mealDailyAmount}
                onChange={(value) => update("mealDailyAmount", value)}
              />
              <TextField
                id="meal-days"
                label="Dias no mês"
                value={form.mealDays}
                error={errors.mealDays}
                onChange={(value) => update("mealDays", value)}
              />
              <SegmentedField
                name="meal-method"
                legend="Como é pago"
                value={form.mealMethod}
                options={MEAL_METHOD_OPTIONS}
                hint={mealLimitHint}
                onChange={(value) =>
                  update("mealMethod", value as MealAllowanceMethod)
                }
              />
            </div>
          ) : null}
        </section>

        <section className="field-group">
          <h3 className="group-title">Subsídios em duodécimos</h3>
          <p className="group-note">
            Pagos ao longo do ano em vez de por inteiro. São tributados
            autonomamente: não sobem o escalão do salário do mês.
          </p>
          <div className="field-row">
            <SegmentedField
              name="holiday-twelfths"
              legend="Subsídio de férias"
              value={form.holidayTwelfths}
              options={TWELFTHS_OPTIONS}
              onChange={(value) =>
                update("holidayTwelfths", value as TwelfthsChoice)
              }
            />
            <SegmentedField
              name="christmas-twelfths"
              legend="Subsídio de Natal"
              value={form.christmasTwelfths}
              options={TWELFTHS_OPTIONS}
              onChange={(value) =>
                update("christmasTwelfths", value as TwelfthsChoice)
              }
            />
          </div>
        </section>

        <section className="field-group">
          <h3 className="group-title">IRS Jovem</h3>
          <ToggleField
            id="irs-jovem"
            label="Tenho IRS Jovem"
            checked={form.irsJovem}
            onChange={(checked) => update("irsJovem", checked)}
            hint={
              jovemRegime ? (
                <>
                  Isenção parcial nos primeiros{" "}
                  {jovemRegime.exemptionByYear.length} anos de rendimentos do
                  trabalho, até{" "}
                  {formatEuro(jovemRegime.capMultiplier * jovemRegime.ias)}{" "}
                  isentos por ano (<LawReference id="cirs-12b" />).
                </>
              ) : undefined
            }
          />
          {form.irsJovem && jovemYearOptions.length > 0 ? (
            <SelectField
              id="irs-jovem-year"
              label="Ano de rendimentos"
              value={form.irsJovemYear}
              options={jovemYearOptions}
              error={errors.irsJovemYear}
              onChange={(value) => update("irsJovemYear", value)}
            />
          ) : null}
        </section>

        <section className="field-group">
          <h3 className="group-title">Região</h3>
          <SelectField
            id="region"
            label="Onde tem residência fiscal"
            value={form.region}
            options={REGION_OPTIONS}
            hint="As regiões autónomas têm tabelas próprias — ainda por transcrever."
            onChange={(value) => update("region", value as Region)}
          />
        </section>
      </div>
    </details>
  );
}
