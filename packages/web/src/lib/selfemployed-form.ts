// The recibos verdes form's state, and its translation into an engine input.
//
// One translation here is not a straight mapping and is worth naming: the form
// asks a single "tipo de atividade" where the engine takes two fields. That is
// deliberate in both directions. The engine keeps them apart because they come
// from different statutes — CIRS art. 101.º picks the retention rate, the
// Código Contributivo picks the coefficient — and a merged type could not
// express a doctor (professional for retention, services for the coefficient).
// The form merges them because in practice they correlate, and asking twice
// would make the common case harder to fill in than the rare one.

import type {
  Region,
  RetentionCategory,
  SelfEmployedActivity,
  SelfEmployedInput,
} from "@pt-finance-tools/engine";
import { parseAmount } from "./format.js";

/** What the form asks, and what each answer means to each statute. */
export type ActivityPreset =
  | "professional-services"
  | "other-services"
  | "goods"
  | "hospitality"
  | "intellectual-property";

interface PresetMeaning {
  label: string;
  activity: SelfEmployedActivity;
  retentionCategory: RetentionCategory;
  hint: string;
}

export const ACTIVITY_PRESETS: Record<ActivityPreset, PresetMeaning> = {
  "professional-services": {
    label: "Serviços — profissão da tabela",
    activity: "services",
    retentionCategory: "professional",
    hint: "Médicos, advogados, engenheiros, designers e as restantes atividades da tabela do artigo 151.º. Retenção de 23 %.",
  },
  "other-services": {
    label: "Serviços — outra atividade",
    activity: "services",
    retentionCategory: "other-services",
    hint: "Prestação de serviços fora daquela tabela, incluindo comissões. Retenção de 11,5 %.",
  },
  goods: {
    label: "Produção e venda de bens",
    activity: "goods",
    retentionCategory: "other-services",
    hint: "A Segurança Social conta 20 % do faturado, não 70 %.",
  },
  hospitality: {
    label: "Hotelaria, restauração e bebidas",
    activity: "hospitality",
    retentionCategory: "other-services",
    hint: "É prestação de serviços, mas a Segurança Social aplica-lhe o coeficiente dos bens: 20 %.",
  },
  "intellectual-property": {
    label: "Propriedade intelectual ou industrial",
    activity: "intellectual-property",
    retentionCategory: "intellectual-property",
    hint: "Direitos de autor e afins. Retenção de 16,5 %, e por omissão fica fora da base da Segurança Social — pode optar por incluí-la em «O meu caso».",
  },
};

export interface SelfEmployedForm {
  invoicing: string;
  preset: ActivityPreset;
  /** Whether the three quarter fields are in use rather than the monthly one. */
  irregularQuarter: boolean;
  quarter1: string;
  quarter2: string;
  quarter3: string;
  /** Only meaningful for the propriedade intelectual preset. */
  includeIntellectualProperty: boolean;
  chargesVat: boolean;
  /** Only reaches the answer when `chargesVat` is on — it picks the taxa normal. */
  region: Region;
  retentionDispensed: boolean;
  clientDoesNotWithhold: boolean;
  soleTrader: boolean;
  accumulatesEmployment: boolean;
  firstActivityDeferral: boolean;
}

const MAX_INVOICING = 1_000_000;

export const DEFAULT_SELF_EMPLOYED_FORM: SelfEmployedForm = {
  invoicing: "",
  preset: "professional-services",
  irregularQuarter: false,
  quarter1: "",
  quarter2: "",
  quarter3: "",
  // Defaults to the art. 53.º exemption, which is where most people who reach
  // for this tool actually are — under 15 000 € of turnover. It is the same
  // threshold that governs the retention dispensa, so the two toggles below
  // move together in reality even though the form keeps them separate.
  includeIntellectualProperty: false,
  chargesVat: false,
  region: "continente",
  retentionDispensed: false,
  clientDoesNotWithhold: false,
  soleTrader: false,
  accumulatesEmployment: false,
  firstActivityDeferral: false,
};

export type SelfEmployedFormErrors = Partial<
  Record<keyof SelfEmployedForm, string>
>;

function validateAmount(
  raw: string,
  label: string,
): { value: number | null; error?: string } {
  if (raw.trim() === "") return { value: null };
  const value = parseAmount(raw);
  if (value === null) {
    return { value: null, error: "Introduza um valor, por exemplo 2000 ou 2.000,00." };
  }
  if (value < 0) return { value: null, error: `${label} não pode ser negativo.` };
  if (value > MAX_INVOICING) {
    return { value: null, error: "Valor demasiado alto para uma simulação mensal." };
  }
  return { value };
}

export function validateSelfEmployedForm(
  form: SelfEmployedForm,
): SelfEmployedFormErrors {
  const errors: SelfEmployedFormErrors = {};

  const invoicing = validateAmount(form.invoicing, "O valor faturado");
  if (invoicing.error) errors.invoicing = invoicing.error;

  if (form.irregularQuarter) {
    for (const key of ["quarter1", "quarter2", "quarter3"] as const) {
      const month = validateAmount(form[key], "O valor faturado");
      if (month.error) errors[key] = month.error;
    }
  }

  return errors;
}

/** The three quarter months, when all three are usable. */
function quarterOf(
  form: SelfEmployedForm,
): readonly [number, number, number] | undefined {
  if (!form.irregularQuarter) return undefined;

  // A half-filled quarter is not a quarter. An unanswered month is not a month
  // of no income, and treating it as zero would understate the base by up to
  // two thirds — silently, and in the direction that flatters the answer. So a
  // blank field drops the whole override and the monthly stand-in applies,
  // which the result panel then labels as an assumption.
  //
  // A month that genuinely had no invoicing is still expressible: type 0. That
  // parses, so it is kept, and it is the user saying so rather than the form
  // guessing.
  const months = [form.quarter1, form.quarter2, form.quarter3].map((raw) =>
    raw.trim() === "" ? null : parseAmount(raw),
  );
  if (months.some((m) => m === null)) return undefined;
  return [months[0] as number, months[1] as number, months[2] as number];
}

/**
 * Build the engine input, or `null` when there is nothing to compute yet.
 *
 * A zero invoice is computable and meaningful — the 20 € floor is still owed —
 * so only an empty or unparseable field returns null.
 */
export function toSelfEmployedInput(
  form: SelfEmployedForm,
  referenceDate: string,
): SelfEmployedInput | null {
  if (form.invoicing.trim() === "") return null;
  const monthlyInvoicing = parseAmount(form.invoicing);
  if (monthlyInvoicing === null || monthlyInvoicing < 0) return null;

  const preset = ACTIVITY_PRESETS[form.preset];
  const input: SelfEmployedInput = {
    monthlyInvoicing,
    activity: preset.activity,
    retentionCategory: preset.retentionCategory,
    referenceDate,
  };

  const quarter = quarterOf(form);
  if (quarter) input.quarter = quarter;
  // Same rule as the region: only sent where it means something. The opt-in
  // exists solely for propriedade intelectual, and carrying it on a services
  // input would suggest the engine consults it there.
  if (preset.activity === "intellectual-property" && form.includeIntellectualProperty) {
    input.includeIntellectualProperty = true;
  }
  // Both together, or neither. Sending the region on its own would be
  // harmless but misleading in the input the tests read: under the exemption
  // there is no taxa normal to select, so there is nothing for it to mean.
  if (form.chargesVat) {
    input.chargesVat = true;
    if (form.region !== "continente") input.region = form.region;
  }
  if (form.retentionDispensed) input.retentionDispensed = true;
  if (form.clientDoesNotWithhold) input.clientDoesNotWithhold = true;
  if (form.soleTrader) input.soleTrader = true;
  if (form.accumulatesEmployment) input.accumulatesEmployment = true;
  if (form.firstActivityDeferral) input.firstActivityDeferral = true;

  return input;
}

export type UpdateSelfEmployedForm = <K extends keyof SelfEmployedForm>(
  key: K,
  value: SelfEmployedForm[K],
) => void;
