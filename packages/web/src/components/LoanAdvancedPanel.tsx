// "O meu caso" for the loan side — the inputs that change the answer but that
// most people either do not have yet (an appraisal) or would rather not think
// about first (their other credit).

import type { LoanPurpose } from "@pt-finance-tools/engine";
import type {
  LoanForm,
  LoanFormErrors,
  UpdateLoanForm,
} from "../lib/loan-form.js";
import { DEFAULT_ANNUAL_RATE } from "../lib/loan-form.js";
import { LawReference } from "./LawReference.js";
import {
  SegmentedField,
  TextField,
  ToggleField,
  type SelectOption,
} from "./fields.js";

const PURPOSE_OPTIONS: readonly SelectOption[] = [
  { value: "own-permanent-residence", label: "Habitação própria" },
  { value: "other", label: "Outra finalidade" },
];

interface LoanAdvancedPanelProps {
  form: LoanForm;
  errors: LoanFormErrors;
  update: UpdateLoanForm;
}

export function LoanAdvancedPanel({
  form,
  errors,
  update,
}: LoanAdvancedPanelProps) {
  return (
    <details className="advanced">
      <summary>
        <span className="advanced-title">O meu caso</span>
        <span className="advanced-sub">
          Taxa, finalidade, outros créditos, avaliação
        </span>
      </summary>

      <div className="advanced-body">
        <section className="field-group">
          <h3 className="group-title">O crédito</h3>
          <SegmentedField
            name="loan-purpose"
            legend="Finalidade"
            value={form.purpose}
            options={PURPOSE_OPTIONS}
            onChange={(value) => update("purpose", value as LoanPurpose)}
            hint="Habitação própria e permanente financia até 90 % do imóvel; as restantes finalidades até 80 %."
          />
          <TextField
            id="loan-rate"
            label="Taxa de juro anual"
            suffix="%"
            value={form.annualRate}
            error={errors.annualRate}
            hint={
              <>
                <span>
                  Euribor + spread. O valor por omissão ({DEFAULT_ANNUAL_RATE} %)
                  é uma estimativa, não uma proposta: substitua-o pela taxa que
                  o banco lhe indicar. A taxa de esforço é depois testada com
                  uma taxa agravada.
                </span>
                <LawReference id="instrucao-23-2023" />
              </>
            }
            onChange={(value) => update("annualRate", value)}
          />
        </section>

        <section className="field-group">
          <h3 className="group-title">A sua situação</h3>
          <TextField
            id="loan-existing-debt"
            label="Prestações que já paga"
            suffix="€"
            placeholder="0,00"
            value={form.existingDebt}
            error={errors.existingDebt}
            hint="Total mensal de outros créditos — automóvel, pessoal, cartões. Contam para a taxa de esforço pelo valor real, sem agravamento."
            onChange={(value) => update("existingDebt", value)}
          />
          <ToggleField
            id="loan-retired"
            label="Já reformado(a)"
            checked={form.retired}
            onChange={(checked) => update("retired", checked)}
            hint="Quem já está reformado não sofre a redução de rendimento que se aplica aos contratos que passam dos 70 anos."
          />
        </section>

        <section className="field-group">
          <h3 className="group-title">O imóvel</h3>
          <TextField
            id="loan-appraisal"
            label="Valor da avaliação"
            suffix="€"
            placeholder="Igual ao preço"
            value={form.appraisalValue}
            error={errors.appraisalValue}
            hint="Se a avaliação do banco for inferior ao preço, é ela que manda no limite de financiamento — e a diferença sai do seu bolso."
            onChange={(value) => update("appraisalValue", value)}
          />
        </section>
      </div>
    </details>
  );
}
