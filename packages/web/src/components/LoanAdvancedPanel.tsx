// "O meu caso" for the loan side — the inputs that change the answer but that
// most people either do not have yet (an appraisal) or would rather not think
// about first (their other credit).

import type {
  EuriborTenor,
  LoanPurpose,
  LoanRateType,
  Region,
} from "@pt-finance-tools/engine";
import type {
  LoanForm,
  LoanFormErrors,
  UpdateLoanForm,
} from "../lib/loan-form.js";
import {
  IMT_2026,
  MORTGAGE_MARKET,
  STATE_GUARANTEE_2024,
  imtTerritory,
} from "@pt-finance-tools/engine";
import type { EuriborState } from "../lib/euribor-feed.js";
import { formatEuroCompact, formatRate } from "../lib/format.js";
import { LawReference } from "./LawReference.js";
import {
  SegmentedField,
  SelectField,
  TextField,
  ToggleField,
  type SelectOption,
} from "./fields.js";

const PURPOSE_OPTIONS: readonly SelectOption[] = [
  { value: "own-permanent-residence", label: "Habitação própria" },
  { value: "other", label: "Outra finalidade" },
];

const RATE_TYPE_OPTIONS: readonly SelectOption[] = [
  { value: "variable", label: "Variável" },
  { value: "mixed", label: "Mista" },
  { value: "fixed", label: "Fixa" },
];

const REGION_OPTIONS: readonly SelectOption[] = [
  { value: "continente", label: "Continente" },
  { value: "madeira", label: "Madeira" },
  { value: "acores", label: "Açores" },
];

const TENOR_OPTIONS: readonly SelectOption[] = [
  { value: "3m", label: "Euribor 3 meses" },
  { value: "6m", label: "Euribor 6 meses" },
  { value: "12m", label: "Euribor 12 meses" },
];

/** Where the index came from, in words the user can act on. */
const ORIGIN_LABEL: Record<EuriborState["origin"], string> = {
  live: "valor do Banco Central Europeu",
  cache: "valor guardado neste dispositivo",
  bundled: "valor incluído na aplicação",
};

interface LoanAdvancedPanelProps {
  form: LoanForm;
  errors: LoanFormErrors;
  update: UpdateLoanForm;
  euribor: EuriborState;
  indexRate: number;
}

export function LoanAdvancedPanel({
  form,
  errors,
  update,
  euribor,
  indexRate,
}: LoanAdvancedPanelProps) {
  const market = MORTGAGE_MARKET;
  // Read off the dataset rather than written into the copy, so the January the
  // brackets re-index the hint re-indexes with them.
  const youngCeiling =
    IMT_2026.tables[imtTerritory(form.region)][
      "young-own-permanent-residence"
    ][0]?.upTo ?? 0;
  const guaranteeCeiling = STATE_GUARANTEE_2024.maxTransactionValue;
  const spread = Number(form.spread.replace(",", ".")) || 0;
  const composedRate = indexRate + spread / 100;

  return (
    <details className="advanced">
      <summary>
        <span className="advanced-title">O meu caso</span>
        <span className="advanced-sub">
          Taxa e indexante, finalidade, outros créditos, impostos e comissões
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
          <SegmentedField
            name="loan-rate-type"
            legend="Tipo de taxa"
            value={form.rateType}
            options={RATE_TYPE_OPTIONS}
            onChange={(value) => update("rateType", value as LoanRateType)}
            hint={
              <>
                <span>
                  A taxa mista — fixa nos primeiros anos, indexada depois — é
                  hoje a mais comum em Portugal. É testada pela mais alta das
                  duas prestações: a do período fixo, ou a que se pagaria
                  depois com o indexante agravado. Na taxa fixa não há
                  indexante que possa subir, por isso é testada à taxa do
                  próprio contrato.
                </span>
                <LawReference id="instrucao-23-2023" />
              </>
            }
          />

          {form.rateType === "mixed" ? (
            <div className="field-row">
              <TextField
                id="loan-fixed-rate"
                label="Taxa fixa inicial"
                suffix="%"
                value={form.annualRate}
                error={errors.annualRate}
                onChange={(value) => update("annualRate", value)}
              />
              <TextField
                id="loan-fixed-period"
                label="Durante"
                inputMode="numeric"
                suffix="anos"
                value={form.fixedPeriodYears}
                error={errors.fixedPeriodYears}
                onChange={(value) => update("fixedPeriodYears", value)}
              />
            </div>
          ) : null}

          {form.rateType !== "fixed" ? (
            <>
              <SelectField
                id="loan-tenor"
                label={
                  form.rateType === "mixed"
                    ? "Indexante (depois do período fixo)"
                    : "Indexante"
                }
                value={form.tenor}
                options={TENOR_OPTIONS}
                onChange={(value) => update("tenor", value as EuriborTenor)}
                hint={
                  <span>
                    Média de {euribor.snapshot.month}:{" "}
                    <span className="num">{formatRate(indexRate)}</span> —{" "}
                    {ORIGIN_LABEL[euribor.origin]}.
                    {euribor.current
                      ? " É o mês que a lei manda usar."
                      : " Ainda não é o mês exigido pela lei, por isso o resultado é uma estimativa."}{" "}
                    Em {market.month},{" "}
                    {Math.round(
                      market.indexShareOfNewBusiness["6m"] * 100,
                    )}{" "}
                    % dos novos contratos a taxa variável seguiam a Euribor a 6
                    meses, contra{" "}
                    {Math.round(
                      market.indexShareOfNewBusiness["12m"] * 100,
                    )}{" "}
                    % a 12 meses.
                  </span>
                }
              />
              <TextField
                id="loan-spread"
                label="Spread"
                suffix="%"
                value={form.spread}
                error={errors.spread}
                hint="A margem do banco sobre o indexante. O valor por omissão é uma estimativa, não uma proposta: substitua-o pelo spread que lhe for indicado."
                onChange={(value) => update("spread", value)}
              />
              <p className="field-hint">
                {form.rateType === "mixed"
                  ? "Taxa depois do período fixo: "
                  : "Taxa do contrato: "}
                <span className="num">{formatRate(composedRate)}</span>{" "}
                (indexante + spread). Não se pode subtrair a Euribor à
                média do mercado para obter um spread: cada contrato leva a
                Euribor da data em que foi assinado, não a de hoje. A
                comparação com o mercado está no resultado, ao lado da sua
                prestação.
              </p>
            </>
          ) : (
            <TextField
              id="loan-rate"
              label="Taxa de juro anual"
              suffix="%"
              value={form.annualRate}
              error={errors.annualRate}
              hint="A taxa fixada no contrato, para todo o prazo."
              onChange={(value) => update("annualRate", value)}
            />
          )}
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
          <SelectField
            id="loan-region"
            label="Onde fica o imóvel"
            value={form.region}
            options={REGION_OPTIONS}
            onChange={(value) => update("region", value as Region)}
            hint="Os escalões do IMT são 25 % mais altos nas Regiões Autónomas, por isso o mesmo preço paga menos imposto na Madeira e nos Açores."
          />
          {form.mode === "price" ? (
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
          ) : null}
          <TextField
            id="loan-vpt"
            label="Valor patrimonial tributário"
            suffix="€"
            placeholder="Não é superior ao preço"
            value={form.vpt}
            error={errors.vpt}
            hint={
              <>
                <span>
                  Só interessa se for <em>superior</em> ao preço: o IMT e o
                  selo da compra incidem sobre o maior dos dois. Repare que é o
                  contrário do limite de financiamento, que toma o menor entre
                  o preço e a avaliação.
                </span>
                <LawReference id="cimt-12" />
              </>
            }
            onChange={(value) => update("vpt", value)}
          />
        </section>

        <section className="field-group">
          <h3 className="group-title">Impostos e encargos</h3>
          <ToggleField
            id="loan-young"
            label="Primeira casa, até aos 35 anos"
            checked={form.youngFirstHome}
            onChange={(checked) => update("youngFirstHome", checked)}
            hint={
              <>
                <span>
                  Isenta o IMT e o imposto do selo até {formatEuroCompact(
                    youngCeiling,
                  )}
                  , e reduz os emolumentos do registo. Marque se{" "}
                  <strong>todas</strong> estas forem verdade: tem 35 anos ou
                  menos, é a sua primeira casa, é para habitação própria e
                  permanente, não foi proprietário de outra habitação nos
                  últimos três anos, e não é dependente para efeitos de IRS. O
                  banco e a Autoridade Tributária confirmam — a simulação
                  acredita em si.
                </span>
                <LawReference id="cimt-9" />
              </>
            }
          />
          <ToggleField
            id="loan-guarantee"
            label="Garantia do Estado (financiamento a 100 %)"
            checked={form.stateGuarantee}
            onChange={(checked) => update("stateGuarantee", checked)}
            hint={
              <>
                <span>
                  Com a fiança do Estado o banco <em>pode</em> financiar a
                  totalidade da compra, sem entrada. Exige ter entre 18 e 35
                  anos, ser a primeira habitação própria e permanente,
                  rendimento coletável até ao 8.º escalão do IRS, e um imóvel
                  até {formatEuroCompact(guaranteeCeiling)}. Não é um direito:
                  ultrapassa os 90 % que o Banco de Portugal recomenda, e cada
                  banco decide caso a caso.
                </span>
                <LawReference id="dl-44-2024" />
              </>
            }
          />
          <TextField
            id="loan-bank-fees"
            label="Comissões do banco"
            suffix="€"
            placeholder="0,00"
            value={form.bankFees}
            error={errors.bankFees}
            hint="Avaliação, dossier, formalização. Nenhuma lei as fixa, por isso a simulação não as inventa: ficam a zero até as escrever aqui. A FINE que o banco lhe entregar indica-as."
            onChange={(value) => update("bankFees", value)}
          />
        </section>
      </div>
    </details>
  );
}
