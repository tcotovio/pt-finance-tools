// Writing the dataset modules the engine ships.
//
// A generator that produces a file of numbers and nothing else would strip out
// exactly what makes these datasets trustworthy: the paragraphs above each one
// saying what it is, why it is bundled, and what would make it wrong. So the
// prose lives here, in the template, and is carried into every new vintage —
// with the vintage-specific parts as substitutions rather than as text a robot
// paraphrases.
//
// `generate.test.ts` regenerates the currently shipped modules from their own
// recorded values and asserts the output matches the files in the repo byte for
// byte. That is what keeps this honest: the templates cannot drift from what a
// human wrote without the test saying so.

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** `2026-07` → `July 2026`, for the one line of prose that names the month. */
export function monthLabel(month: string): string {
  const [year, index] = month.split("-");
  const name = MONTH_NAMES[Number(index) - 1];
  if (!name || !year) throw new Error(`Not a YYYY-MM month: "${month}".`);
  return `${name} ${year}`;
}

/** `2026-07` → `EURIBOR_2026_07`; `2026-Q2` → `WAGE_MARKET_2026_Q2`. */
export function constantName(prefix: string, period: string): string {
  return `${prefix}_${period.replace(/-/g, "_")}`;
}

/** `euribor`, `2026-07` → `euribor-2026-07.ts`. */
export function moduleFile(prefix: string, period: string): string {
  return `${prefix}-${period.toLowerCase()}.ts`;
}

/**
 * A rate as the dataset writes it.
 *
 * The ECB quotes percentages, and dividing by 100 in binary floating point
 * turns 2.2261 into 0.022261000000000003 — which would land in a source file
 * and stay there. Rounding to twelve significant figures is far finer than any
 * published rate and removes the dust.
 */
export function formatRate(rate: number): string {
  return String(Number(rate.toPrecision(12)));
}

export interface EuriborModuleInput {
  month: string;
  rates: { "3m": number; "6m": number; "12m": number };
  retrievedAt: string;
}

/** The bundled Euribor fallback, as a module. */
export function renderEuriborModule(input: EuriborModuleInput): string {
  return `// Bundled Euribor fallback — ${monthLabel(input.month)} monthly averages.
//
// The app fetches live values from the ECB, but it is an offline-capable PWA
// with no backend, so it also has to work when the feed is unreachable: this
// snapshot ships in the bundle and is used when the network fails and nothing
// is cached. It is a *fallback*, not the source of truth — the UI always says
// which of the three it used and whether the month is the right one.
//
// Values are the ECB's own monthly averages for the three tenors Portuguese
// mortgages index to (series FM.M.U2.EUR.RT.MM.EURIBOR{3M,6M,1Y}D_.HSTA).
//
// A note on the equivalence, since the whole point is legal compliance:
// Instrução 23/2023 art. 1.º n.º 4 asks for the simple arithmetic mean of the
// month's daily quotes, and the ECB publishes exactly a monthly average of
// the daily series. They are taken to be the same figure. If the ECB ever
// switched to a weighted or business-day-adjusted average, this assumption
// would need re-checking — which is why it is written down here rather than
// left implicit.

import type { EuriborSnapshot } from "../types.js";

export const ${constantName("EURIBOR", input.month)}: EuriborSnapshot = {
  month: "${input.month}",
  rates: {
    "3m": ${formatRate(input.rates["3m"])},
    "6m": ${formatRate(input.rates["6m"])},
    "12m": ${formatRate(input.rates["12m"])},
  },
  source:
    "European Central Bank Data Portal, series FM.M.U2.EUR.RT.MM.EURIBOR*.HSTA " +
    "(https://data-api.ecb.europa.eu/service/data/FM/M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA)",
  retrievedAt: "${input.retrievedAt}",
};
`;
}

export interface ConsumerModuleInput {
  month: string;
  averageRate: number;
  retrievedAt: string;
}

/** The consumer-credit market reference, as a module. */
export function renderConsumerModule(input: ConsumerModuleInput): string {
  return `// What Portuguese consumer credit actually costs.
//
// Source: ECB MFI Interest Rate Statistics, series MIR.M.PT.B.A2B.A.R.A.2250
// .EUR.N — the annualised agreed rate on new consumer loans to households in
// Portugal, compiled from what the banks report to Banco de Portugal.
//
// UNLIKE THE MORTGAGE SPREAD, THIS ONE IS USABLE DIRECTLY. The spread could
// not be derived because a mortgage rate is an index plus a margin, and the
// published average mixed products priced off different things. Consumer
// credit is quoted and agreed as a single fixed rate, so the observed average
// IS the quantity the form needs — no subtraction, no inference, nothing to
// go wrong in the derivation.
//
// It seeds the form's default rate and is shown as context beside the user's
// own. It is not an input to any limit: the ceilings come from the
// Recomendação, not from what the market charges.

import type { ConsumerCreditMarket } from "../types.js";

export const ${constantName("CONSUMER_MARKET", input.month)}: ConsumerCreditMarket = {
  month: "${input.month}",
  /** Annualised agreed rate on new consumer credit, as a fraction. */
  averageRate: ${formatRate(input.averageRate)},
  source:
    "European Central Bank, MFI Interest Rate Statistics, série " +
    "MIR.M.PT.B.A2B.A.R.A.2250.EUR.N — crédito aos consumidores, novas " +
    "operações, Portugal (https://data-api.ecb.europa.eu)",
  retrievedAt: "${input.retrievedAt}",
};
`;
}
