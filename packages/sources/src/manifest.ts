// Every source the app leans on, and what would make it out of date.
//
// The vintage is NOT written down here — it is read off the dataset the engine
// actually ships, so this file cannot drift from the data the way a hand-kept
// inventory does. What it adds is the part the dataset does not know about
// itself: who publishes it, on what rhythm, and when a person last went and
// looked.
//
// `checkedOn` is that last part, and it is deliberately a date rather than a
// boolean. `verified` (in the engine) answers "was this transcribed correctly";
// this answers "was the publisher consulted recently", and a dataset can be
// impeccably transcribed from a document that has since been replaced.
//
// Adding a dataset to the engine without adding it here fails
// `manifest.test.ts`, so the inventory cannot quietly go incomplete.

import * as engine from "@pt-finance-tools/engine";
import type { Schedule } from "./schedule.js";
import type { Period } from "./period.js";
import { ecbSeriesProbe, type Probe } from "./probes/ecb.js";

export interface SourceEntry {
  /** Stable id, used in reports, issue bodies and `--only` filters. */
  id: string;
  /** The engine export this describes. */
  exportName: string;
  /** What it is, in the app's own words. */
  label: string;
  /** The document or series upstream. */
  instrument: string;
  /** Publisher, for grouping a report by who has to be visited. */
  publisher: string;
  /** How upstream publishes — the calendar the freshness check runs on. */
  schedule: Schedule;
  /** ISO date the publisher was last consulted for this dataset. */
  checkedOn: string;
  /** The edition we ship, read from the dataset itself. */
  shipped: Period;
  /** Where to go and look. Taken from the dataset's own citation when it has one. */
  url?: string;
  /** A machine check, for the sources that expose a feed. */
  probe?: Probe;
  /** Why there is no probe — printed in the report, so the gap is visible. */
  probeGap?: string;
}

/** A dataset as this file needs to read it: a vintage and a citation. */
interface DatedDataset {
  source: string;
  effectiveFrom?: string;
  month?: string;
  period?: string;
  retrievedAt?: string;
}

/** The engine's exports, by name, narrowed to the ones that carry provenance. */
export function datasetExports(): Map<string, DatedDataset> {
  const found = new Map<string, DatedDataset>();
  for (const [name, value] of Object.entries(engine as Record<string, unknown>)) {
    if (value !== null && typeof value === "object" && "source" in value) {
      found.set(name, value as DatedDataset);
    }
  }
  return found;
}

/**
 * The edition a dataset represents.
 *
 * Three shapes, because the datasets are versioned in three units: a monthly
 * snapshot carries `month`, the wage reference a `period`, and everything
 * statutory an `effectiveFrom` date whose year is the edition.
 */
export function vintageOf(dataset: DatedDataset): Period {
  if (dataset.month) return dataset.month;
  if (dataset.period) return dataset.period;
  if (dataset.effectiveFrom) return dataset.effectiveFrom.slice(0, 4);
  throw new Error("Dataset carries no month, period or effectiveFrom.");
}

/** The first URL in a citation, which is where a reviewer has to go. */
export function urlOf(dataset: DatedDataset): string | undefined {
  return dataset.source.match(/https?:\/\/[^\s)]+/)?.[0];
}

/** ECB Data Portal series ids, spelled out where they are used. */
const ECB_EURIBOR_3M = "FM/M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA";
const ECB_CONSUMER_RATE = "MIR/M.PT.B.A2B.A.R.A.2250.EUR.N";

/**
 * The registry, minus the vintages, which {@link manifest} fills in from the
 * engine.
 *
 * On the cadences: the tax datasets are annual because the Orçamento do Estado
 * re-indexes them every January, and their despachos land in the second half of
 * December — hence a 12-15 window, so the alarm rings while there is still time
 * to transcribe before the tables take effect. The ones that move only when a
 * law does get a review interval instead: 180 days for the ones that have sat
 * unchanged for years, 90 for the Banco de Portugal Recomendação, which is
 * reviewed far more often than it is amended.
 */
const ENTRIES: readonly Omit<SourceEntry, "shipped" | "url">[] = [
  {
    id: "euribor",
    exportName: "EURIBOR_FALLBACK",
    label: "Euribor — média mensal (fallback do bundle)",
    instrument: "ECB Data Portal, séries FM.M.U2.EUR.RT.MM.EURIBOR{3M,6M,1Y}D_.HSTA",
    publisher: "European Central Bank",
    // The month's average is on the portal within the first business days of
    // the next month. Five days is comfortably after that without being so
    // late that a whole month goes by unnoticed.
    schedule: { kind: "periodic", unit: "month", lagDays: 5 },
    checkedOn: "2026-08-19",
    probe: ecbSeriesProbe(ECB_EURIBOR_3M),
  },
  {
    id: "consumer-market",
    exportName: "CONSUMER_MARKET",
    label: "Taxa média do crédito ao consumo",
    instrument: "ECB MFI Interest Rate Statistics, série MIR.M.PT.B.A2B.A.R.A.2250.EUR.N",
    publisher: "European Central Bank",
    // MIR statistics run about five weeks behind the reference month.
    schedule: { kind: "periodic", unit: "month", lagDays: 40 },
    checkedOn: "2026-08-22",
    probe: ecbSeriesProbe(ECB_CONSUMER_RATE),
  },
  {
    id: "mortgage-market",
    exportName: "MORTGAGE_MARKET",
    label: "Estatísticas do crédito à habitação (percentis, prestação, indexantes)",
    instrument: "BPstat domínio 186 — Crédito à habitação",
    publisher: "Banco de Portugal",
    schedule: { kind: "periodic", unit: "month", lagDays: 55 },
    checkedOn: "2026-08-20",
    probeGap:
      "BPstat is queried by numeric series id, and the ids behind these " +
      "percentile series are not recorded anywhere in the repo. Pin them in " +
      "`probes/bpstat.ts` and this becomes a machine check like the ECB ones.",
  },
  {
    id: "wage-market",
    exportName: "WAGE_MARKET",
    label: "Remuneração bruta mensal média por trabalhador",
    instrument: "INE, Estatísticas do Emprego — destaque trimestral",
    publisher: "Instituto Nacional de Estatística",
    // The quarterly release lands about six weeks after the quarter closes:
    // Q2 2026 was published on 14 August 2026.
    schedule: { kind: "periodic", unit: "quarter", lagDays: 45 },
    checkedOn: "2026-08-22",
    probeGap:
      "The figures live in a press-release destaque rather than in INE's " +
      "indicator API under a code we have pinned; the calendar above still " +
      "says when a new one is due.",
  },
  {
    id: "withholding-continente",
    exportName: "CONTINENTE_2026",
    label: "Tabelas de retenção na fonte — Continente",
    instrument: "Despacho do SEAF, tabelas de retenção IRS (Continente)",
    publisher: "Autoridade Tributária e Aduaneira",
    schedule: { kind: "annual", nextEditionFrom: "12-15" },
    checkedOn: "2026-08-18",
  },
  {
    id: "withholding-madeira",
    exportName: "MADEIRA_2026",
    label: "Tabelas de retenção na fonte — Madeira",
    instrument: "Despacho da Secretaria Regional das Finanças (JORAM)",
    publisher: "Região Autónoma da Madeira",
    schedule: { kind: "annual", nextEditionFrom: "12-15" },
    checkedOn: "2026-08-18",
  },
  {
    id: "imt",
    exportName: "IMT_2026",
    label: "Tabelas práticas do IMT",
    instrument: "Ofício circulado da AT, escalões do CIMT art. 17.º",
    publisher: "Autoridade Tributária e Aduaneira",
    schedule: { kind: "annual", nextEditionFrom: "12-15" },
    checkedOn: "2026-08-22",
  },
  {
    id: "ias",
    exportName: "IAS_2026",
    label: "Indexante dos Apoios Sociais",
    instrument: "Portaria anual que fixa o IAS",
    publisher: "Governo (Diário da República)",
    schedule: { kind: "annual", nextEditionFrom: "12-15" },
    checkedOn: "2026-08-18",
  },
  {
    id: "irs-jovem",
    exportName: "IRS_JOVEM_2026",
    label: "Parâmetros do IRS Jovem",
    instrument: "CIRS art. 12.º-B e despacho de retenção",
    publisher: "Autoridade Tributária e Aduaneira",
    schedule: { kind: "annual", nextEditionFrom: "12-15" },
    checkedOn: "2026-08-18",
  },
  {
    id: "meal-allowance",
    exportName: "MEAL_ALLOWANCE_2026",
    label: "Limites de isenção do subsídio de alimentação",
    instrument: "CIRS art. 2.º n.º 3 al. b), valores anuais",
    publisher: "Autoridade Tributária e Aduaneira",
    schedule: { kind: "annual", nextEditionFrom: "12-15" },
    checkedOn: "2026-08-18",
  },
  {
    id: "cirs-retention",
    exportName: "CIRS_RETENTION_2026",
    label: "Retenção da categoria B",
    instrument: "CIRS art. 101.º e 101.º-B",
    publisher: "Autoridade Tributária e Aduaneira",
    schedule: { kind: "annual", nextEditionFrom: "12-15" },
    checkedOn: "2026-08-30",
  },
  {
    id: "civa-exemption",
    exportName: "CIVA_EXEMPTION_2026",
    label: "Limiar de isenção do IVA (art. 53.º)",
    instrument: "CIVA art. 53.º, limiar anual",
    publisher: "Autoridade Tributária e Aduaneira",
    schedule: { kind: "annual", nextEditionFrom: "12-15" },
    checkedOn: "2026-08-30",
  },
  {
    id: "bdp-recomendacao",
    exportName: "BDP_2026",
    label: "Recomendação macroprudencial (limites ao crédito)",
    instrument: "Recomendação do Banco de Portugal sobre novos contratos de crédito",
    publisher: "Banco de Portugal",
    // Amended rarely but reviewed often, and an amendment changes what the
    // calculator is allowed to say — so the shortest review interval here.
    schedule: { kind: "on-change", reviewEveryDays: 90 },
    checkedOn: "2026-08-18",
  },
  {
    id: "interest-rate-shock",
    exportName: "INTEREST_RATE_SHOCK_2023",
    label: "Choque de taxa de juro (teste de esforço da DSTI)",
    instrument: "Instrução n.º 23/2023 do Banco de Portugal",
    publisher: "Banco de Portugal",
    schedule: { kind: "on-change", reviewEveryDays: 180 },
    checkedOn: "2026-08-18",
  },
  {
    id: "stamp-duty",
    exportName: "STAMP_DUTY_2024",
    label: "Imposto do Selo — verbas 1.1 e 17",
    instrument: "Tabela Geral do Imposto do Selo",
    publisher: "Autoridade Tributária e Aduaneira",
    schedule: { kind: "on-change", reviewEveryDays: 180 },
    checkedOn: "2026-08-22",
  },
  {
    id: "registration-fees",
    exportName: "REGISTRATION_FEES_2024",
    label: "Emolumentos de registo e Casa Pronta",
    instrument: "Regulamento Emolumentar dos Registos e Notariado",
    publisher: "IRN / Casa Pronta",
    schedule: { kind: "on-change", reviewEveryDays: 180 },
    checkedOn: "2026-08-22",
  },
  {
    id: "state-guarantee",
    exportName: "STATE_GUARANTEE_2024",
    label: "Garantia pessoal do Estado (jovens)",
    instrument: "Decreto-Lei n.º 44/2024 e portaria regulamentar",
    publisher: "Governo (Diário da República)",
    // Time-limited: it lapses at the end of 2026, and whether it is extended
    // is a question someone has to ask before then.
    schedule: { kind: "on-change", reviewEveryDays: 90 },
    checkedOn: "2026-08-22",
  },
  {
    id: "selfemployed-contributions",
    exportName: "SELF_EMPLOYED_CONTRIBUTIONS_2018",
    label: "Contribuições dos trabalhadores independentes",
    instrument: "Código dos Regimes Contributivos, regime dos independentes",
    publisher: "Segurança Social",
    // Unchanged since 2019; what moves each January is the IAS it is a
    // multiple of, and that is a separate entry above.
    schedule: { kind: "on-change", reviewEveryDays: 180 },
    checkedOn: "2026-08-30",
  },
];

/**
 * The registry, with each entry's shipped edition and citation URL filled in
 * from the engine.
 *
 * Throws when an entry names an export that no longer exists — a dataset
 * renamed without updating the manifest is a gap in the inventory, and a loud
 * failure here beats a source quietly dropping out of the report.
 */
export function manifest(): SourceEntry[] {
  const datasets = datasetExports();
  return ENTRIES.map((entry) => {
    const dataset = datasets.get(entry.exportName);
    if (!dataset) {
      throw new Error(
        `Manifest entry "${entry.id}" names export "${entry.exportName}", which the engine does not export.`,
      );
    }
    return {
      ...entry,
      shipped: vintageOf(dataset),
      url: urlOf(dataset),
    };
  });
}
