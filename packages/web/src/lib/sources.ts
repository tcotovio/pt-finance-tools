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
): SourceEntry[] {
  const params = getMacroprudentialParameters(assessmentDate);
  const shock = getInterestRateShock(assessmentDate);

  return [
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
