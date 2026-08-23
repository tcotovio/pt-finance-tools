// Every source behind a result, gathered in one place so the number on screen
// can be fact-checked.
//
// Provenance used to be one line naming the withholding table, which was the
// biggest source but never the only one: a month with a meal allowance also
// leans on the exemption ceilings, one with IRS Jovem on the regime's
// parameters, and the loan side on four separate instruments. Listing only the
// headline dataset understated what the answer actually rests on.
//
// Each entry says what it is, what it was used for, whether it has been
// independently cross-checked, and where to go and check it.

import {
  CONSUMER_MARKET,
  WAGE_MARKET,
  getInterestRateShock,
  getMacroprudentialParameters,
  MORTGAGE_MARKET,
  type ConsumerLoanResult,
  type EuriborSnapshot,
  type MaxLoanResult,
  type PurchaseCosts,
  type SelfEmployedResult,
  type WageResult,
} from "@pt-finance-tools/engine";
import { irsJovemRegimeFor, mealLimitsFor } from "./reference.js";

export interface SourceEntry {
  key: string;
  /** What the source is, in the user's terms. */
  label: string;
  /** What the calculation used it for. */
  usedFor: string;
  /** The provenance string the dataset carries, minus its URL. */
  citation: string;
  url?: string;
  /**
   * Whether the dataset has been independently cross-checked. Absent for
   * sources where the notion does not apply — a live market statistic is not
   * "verified", it is just quoted.
   */
  verified?: boolean;
}

/**
 * Pull the first URL out of a provenance string, and the text without it.
 *
 * The datasets punctuate their sources differently — some parenthesise the
 * URL, some append it after an em-dash — so this handles the URL wherever it
 * sits rather than assuming one house style. Leftover punctuation is cleaned
 * up, so no citation ends in a dangling "—" or "()".
 */
export function splitCitation(source: string): { citation: string; url?: string } {
  const match = source.match(/https?:\/\/[^\s)]+/);
  if (!match) return { citation: source.trim() };

  const url = match[0];
  const citation = source
    .replace(`(${url})`, "")
    .replace(url, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s*[—–-]\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return { citation, url };
}

/** Sources behind a monthly wage result. */
export function wageSources(
  result: WageResult,
  referenceDate: string,
): SourceEntry[] {
  const entries: SourceEntry[] = [];

  entries.push({
    key: "withholding",
    label: "Tabelas de retenção na fonte",
    usedFor: "O IRS retido sobre o vencimento, os subsídios e o trabalho suplementar.",
    verified: result.datasetVerified,
    ...splitCitation(result.datasetSource),
  });

  if (result.mealAllowance) {
    const limits = mealLimitsFor(referenceDate);
    if (limits) {
      entries.push({
        key: "meal",
        label: "Limites de isenção do subsídio de alimentação",
        usedFor: "A parte isenta do subsídio, e o excesso que entra no IRS e na Segurança Social.",
        verified: limits.verified,
        ...splitCitation(limits.source),
      });
    }
  }

  if (result.irsJovem) {
    const regime = irsJovemRegimeFor(referenceDate);
    if (regime) {
      entries.push({
        key: "irs-jovem",
        label: "Parâmetros do IRS Jovem",
        usedFor: "A percentagem isenta por ano de rendimentos e o limite anual de 55 × IAS.",
        verified: regime.verified,
        ...splitCitation(regime.source),
      });
    }
  }

  entries.push({
    key: "wage-market",
    label: `Remuneração média em Portugal — ${WAGE_MARKET.period}`,
    usedFor:
      "A comparação do seu vencimento base com a média nacional. Não entra em nenhum cálculo.",
    ...splitCitation(WAGE_MARKET.source),
  });

  return entries;
}

/** Sources behind a maximum-loan result. */
export function loanSources(
  result: MaxLoanResult,
  assessmentDate: string,
  euribor: EuriborSnapshot,
  costs: PurchaseCosts | null = null,
): SourceEntry[] {
  const params = getMacroprudentialParameters(assessmentDate);
  const shock = getInterestRateShock(assessmentDate);

  const entries: SourceEntry[] = [
    {
      key: "recomendacao",
      label: "Limites do Banco de Portugal",
      usedFor: "A taxa de esforço máxima, o limite de financiamento do imóvel e o prazo máximo por idade.",
      verified: params.verified,
      ...splitCitation(result.sources.macroprudential),
    },
    {
      key: "shock",
      label: "Choque de taxa de juro",
      usedFor: "O agravamento aplicado à prestação no teste da taxa de esforço.",
      verified: shock.verified,
      ...splitCitation(result.sources.shock),
    },
    {
      key: "euribor",
      label: `Euribor — média de ${euribor.month}`,
      usedFor: "O indexante somado ao spread para obter a taxa do contrato.",
      ...splitCitation(euribor.source),
    },
    {
      key: "market",
      label: `Estatísticas do mercado — ${MORTGAGE_MARKET.month}`,
      usedFor: "A comparação da sua prestação e da sua taxa com o mercado. Não entra em nenhum cálculo.",
      ...splitCitation(MORTGAGE_MARKET.source),
    },
  ];

  // The guarantee only appears when it actually moved the ceiling. Listing it
  // otherwise would suggest the answer leaned on a regime it did not use.
  if (result.sources.guarantee) {
    entries.push({
      key: "state-guarantee",
      label: "Garantia pessoal do Estado",
      usedFor:
        "O financiamento até 100 % do imóvel, acima dos 90 % recomendados pelo Banco de Portugal.",
      verified: false,
      ...splitCitation(result.sources.guarantee),
    });
  }

  // The cost datasets, only once there is a transaction to cost. Each keeps
  // its own `verified` flag: none of the three has an independent
  // implementation to check against yet, so a costed answer is honestly
  // reported as unverified rather than borrowing the loan side's badge.
  if (costs) {
    const labels: Record<string, { label: string; usedFor: string }> = {
      imt: {
        label: "Tabelas do IMT",
        usedFor:
          "O imposto municipal sobre a transmissão, pelo escalão em que o imóvel cai.",
      },
      "stamp-duty": {
        label: "Imposto do selo",
        usedFor:
          "A verba 1.1 sobre a compra e a verba 17.1 sobre o capital do empréstimo.",
      },
      registration: {
        label: "Escritura e registos",
        usedFor: "O custo do balcão único, e a redução para jovens.",
      },
    };
    for (const ref of costs.source) {
      const meta = labels[ref.key];
      if (!meta) continue;
      entries.push({
        key: `cost-${ref.key}`,
        label: meta.label,
        usedFor: meta.usedFor,
        verified: ref.verified,
        ...splitCitation(ref.citation),
      });
    }
  }

  return entries;
}

/**
 * Sources behind a consumer-credit result.
 *
 * Three rather than four: there is no Euribor here, because consumer credit is
 * quoted as a single rate rather than an index plus a margin.
 */
export function consumerSources(
  result: ConsumerLoanResult,
  assessmentDate: string,
): SourceEntry[] {
  const params = getMacroprudentialParameters(assessmentDate);
  const shock = getInterestRateShock(assessmentDate);

  return [
    {
      key: "recomendacao",
      label: "Limites do Banco de Portugal",
      usedFor:
        "A taxa de esforço máxima e o prazo máximo para esta finalidade de crédito.",
      verified: params.verified,
      ...splitCitation(result.sources.macroprudential),
    },
    {
      key: "shock",
      label: "Choque de taxa de juro",
      usedFor:
        result.dsti.shock > 0
          ? "O agravamento aplicado à prestação no teste da taxa de esforço."
          : "Não aplicado: só a taxa variável e a mista são testadas com uma subida do indexante.",
      verified: shock.verified,
      ...splitCitation(result.sources.shock),
    },
    {
      key: "consumer-market",
      label: `Taxa média do mercado — ${CONSUMER_MARKET.month}`,
      usedFor:
        "A taxa que o formulário sugere por omissão. Não entra em nenhum limite.",
      ...splitCitation(CONSUMER_MARKET.source),
    },
  ];
}

/**
 * Sources behind a recibos verdes result.
 *
 * Four instruments where the categoria A calculator has one table, and that is
 * the point rather than an accident: the retention, the IVA threshold, the
 * contribution rules and the IAS the multiples are taken of are four separate
 * laws on four separate cycles. The result carries its own `SourceRef` list, so
 * this maps them to labels rather than re-deriving which datasets were used.
 */
export function selfEmployedSources(result: SelfEmployedResult): SourceEntry[] {
  const meta: Record<string, { label: string; usedFor: string }> = {
    "cirs-101": {
      label: "Retenção na fonte — categoria B",
      usedFor:
        result.retention.dispensed
          ? "A taxa que se aplicaria, e a regra que dispensa a retenção neste caso."
          : "A taxa retida sobre o valor faturado.",
    },
    "civa-53": {
      label: "Isenção de IVA — artigo 53.º",
      usedFor: result.vat.exempt
        ? "O limite abaixo do qual não cobra IVA. É também o limite a que a dispensa de retenção se refere."
        : "A taxa de IVA cobrada ao cliente.",
    },
    "cc-independentes": {
      label: "Contribuições — trabalhadores independentes",
      usedFor:
        "O coeficiente sobre o faturado, a base de incidência mensal e a taxa contributiva.",
    },
    ias: {
      label: "Indexante dos Apoios Sociais",
      usedFor: result.contribution.cappedByCeiling
        ? "O limite máximo da base de incidência, 12 × IAS, que travou o cálculo."
        : "Os limites da base de incidência: o máximo de 12 × IAS e o patamar de 4 × IAS na acumulação.",
    },
  };

  return result.sources.flatMap((ref) => {
    const label = meta[ref.key];
    if (!label) return [];
    return [
      {
        key: ref.key,
        ...label,
        verified: ref.verified,
        ...splitCitation(ref.citation),
      },
    ];
  });
}
