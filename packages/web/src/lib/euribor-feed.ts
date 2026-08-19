// The Euribor feed: live from the ECB, cached in the browser, falling back to
// the snapshot compiled into the bundle.
//
// Three properties this has to keep, and they pull against each other:
//
//   * **Privacy.** The whole app's claim is that no financial data leaves the
//     device. This request sends none — it asks the ECB for a public monthly
//     average and nothing about the user goes with it.
//   * **Offline.** It is an installable PWA with no backend, so a failed
//     fetch must degrade rather than break: cache first, bundled snapshot
//     last, and the UI always says which one it used.
//   * **Legal correctness.** Instrução 23/2023 art. 1.º n.º 4 wants the
//     *previous month's* average. The ECB publishes monthly averages
//     directly, so there is no daily-quote averaging to do here — but a
//     snapshot from the wrong month is wrong even when it is fresh, which is
//     why `isCurrentFor` decides usability rather than a TTL.
//
// The ECB data portal sends `access-control-allow-origin: *`, so this works
// from the browser with no proxy.

import {
  EURIBOR_FALLBACK,
  MARKET_RATE_FALLBACK,
  isCurrentFor,
  referenceMonth,
  type EuriborSnapshot,
  type EuriborTenor,
  type MarketRateReference,
} from "@pt-finance-tools/engine";

/** Where the snapshot in hand came from. */
export type EuriborOrigin = "live" | "cache" | "bundled";

export interface EuriborState {
  snapshot: EuriborSnapshot;
  origin: EuriborOrigin;
  /** Whether its month is the one the Instrução requires for this date. */
  current: boolean;
}

/** ECB series id per tenor (FM = financial markets, MM = monthly average). */
const SERIES: Record<EuriborTenor, string> = {
  "3m": "M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA",
  "6m": "M.U2.EUR.RT.MM.EURIBOR6MD_.HSTA",
  "12m": "M.U2.EUR.RT.MM.EURIBOR1YD_.HSTA",
};

const BASE = "https://data-api.ecb.europa.eu/service/data/FM";
/**
 * Average annualised agreed rate on new PT house-purchase loans. Shown as
 * context beside the user's rate; never used in a calculation.
 */
const MARKET_RATE_SERIES = "MIR/M.PT.B.A2C.A.R.A.2250.EUR.N";
const MARKET_RATE_BASE = "https://data-api.ecb.europa.eu/service/data";
const CACHE_KEY = "euribor-snapshot-v1";
const MARKET_CACHE_KEY = "market-rate-v1";
const FETCH_TIMEOUT_MS = 6000;

/** One observation pulled out of an SDMX-JSON response. */
export interface EcbObservation {
  month: string;
  rate: number;
}

/**
 * Parse the ECB's SDMX-JSON into the last observation.
 *
 * The shape is awkward on purpose — observations are keyed by *position*, and
 * the period labels live in a parallel `structure.dimensions.observation`
 * array — so this is kept pure and tested against a checked-in fixture rather
 * than being written inline in the fetch.
 *
 * Returns `null` for anything malformed. A feed that changed shape should
 * degrade to the cache or the bundled snapshot, not throw into the UI.
 */
export function parseEcbSeries(payload: unknown): EcbObservation | null {
  if (typeof payload !== "object" || payload === null) return null;
  const body = payload as Record<string, unknown>;

  const dataSets = body.dataSets;
  const structure = body.structure;
  if (!Array.isArray(dataSets) || dataSets.length === 0) return null;
  if (typeof structure !== "object" || structure === null) return null;

  const series = (dataSets[0] as Record<string, unknown>)?.series;
  if (typeof series !== "object" || series === null) return null;
  const firstSeries = Object.values(series as Record<string, unknown>)[0];
  const observations = (firstSeries as Record<string, unknown>)?.observations;
  if (typeof observations !== "object" || observations === null) return null;

  const periods = (
    structure as {
      dimensions?: { observation?: { values?: { id?: string }[] }[] };
    }
  ).dimensions?.observation?.[0]?.values;
  if (!Array.isArray(periods) || periods.length === 0) return null;

  // Observation keys are string indices into the period list; take the last
  // one that actually carries a value.
  const entries = Object.entries(observations as Record<string, unknown>)
    .map(([index, value]) => ({
      index: Number(index),
      value: Array.isArray(value) ? value[0] : null,
    }))
    .filter((entry) => Number.isInteger(entry.index) && typeof entry.value === "number")
    .sort((a, b) => a.index - b.index);

  const last = entries[entries.length - 1];
  if (!last) return null;

  const month = periods[last.index]?.id;
  if (typeof month !== "string" || !/^\d{4}-\d{2}$/.test(month)) return null;

  // The ECB quotes percentages; the engine works in fractions throughout.
  return { month, rate: (last.value as number) / 100 };
}

async function fetchSeries(
  tenor: EuriborTenor,
  month: string,
  signal: AbortSignal,
): Promise<EcbObservation | null> {
  // Ask for the specific month rather than "the latest": the Instrução names
  // a month, and pinning it means a late ECB publication shows up as a
  // missing observation instead of silently substituting a different month.
  const url = `${BASE}/${SERIES[tenor]}?startPeriod=${month}&endPeriod=${month}&format=jsondata`;
  const response = await fetch(url, { signal });
  if (!response.ok) return null;
  return parseEcbSeries(await response.json());
}

/** Fetch every tenor for `month`, or `null` if any of them is unavailable. */
export async function fetchEuriborSnapshot(
  month: string,
): Promise<EuriborSnapshot | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const tenors = Object.keys(SERIES) as EuriborTenor[];
    const results = await Promise.all(
      tenors.map((tenor) => fetchSeries(tenor, month, controller.signal)),
    );

    const rates = {} as Record<EuriborTenor, number>;
    results.forEach((observation, index) => {
      if (observation && observation.month === month) {
        rates[tenors[index]] = observation.rate;
      }
    });

    // All or nothing: a snapshot missing a tenor would silently fall back to
    // a different month for that one field.
    if (tenors.some((tenor) => typeof rates[tenor] !== "number")) return null;

    return {
      month,
      rates,
      source:
        "European Central Bank Data Portal, series FM.M.U2.EUR.RT.MM.EURIBOR*.HSTA " +
        "(https://data-api.ecb.europa.eu)",
      retrievedAt: new Date().toISOString().slice(0, 10),
    };
  } catch {
    // Offline, blocked, timed out, or malformed — all the same to the caller.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Read a previously stored snapshot, if it is intact. */
export function readCache(storage: Storage | undefined = safeStorage()): EuriborSnapshot | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EuriborSnapshot;
    if (
      typeof parsed?.month === "string" &&
      typeof parsed?.rates?.["3m"] === "number" &&
      typeof parsed?.rates?.["6m"] === "number" &&
      typeof parsed?.rates?.["12m"] === "number"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeCache(
  snapshot: EuriborSnapshot,
  storage: Storage | undefined = safeStorage(),
): void {
  try {
    storage?.setItem(CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // A full or disabled storage is not a reason to fail the calculation.
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    // Storage can throw outright when cookies are blocked.
    return undefined;
  }
}

/**
 * The snapshot to calculate with, in order of preference: a cached one for
 * the right month, then a live fetch, then the bundled fallback.
 *
 * The cache is checked before the network deliberately — the required month
 * never changes within a month, so once the right snapshot is stored there is
 * nothing to gain from asking again.
 */
export async function loadEuribor(assessmentDate: string): Promise<EuriborState> {
  const month = referenceMonth(assessmentDate);

  const cached = readCache();
  if (cached && cached.month === month) {
    return { snapshot: cached, origin: "cache", current: true };
  }

  const live = await fetchEuriborSnapshot(month);
  if (live) {
    writeCache(live);
    return { snapshot: live, origin: "live", current: true };
  }

  // Whatever we have beats nothing: a stale cache is closer than the bundle.
  const best = cached ?? EURIBOR_FALLBACK;
  return {
    snapshot: best,
    origin: cached ? "cache" : "bundled",
    current: isCurrentFor(best, assessmentDate),
  };
}

/**
 * The latest published average, whenever it is from.
 *
 * Unlike Euribor this is not pinned to a month: MIR lags by a month or two
 * and nothing legal depends on it, so the most recent figure is the useful
 * one — the UI states which month it is.
 */
export async function fetchMarketRate(): Promise<MarketRateReference | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(
      `${MARKET_RATE_BASE}/${MARKET_RATE_SERIES}?lastNObservations=1&format=jsondata`,
      { signal: controller.signal },
    );
    if (!response.ok) return null;
    const observation = parseEcbSeries(await response.json());
    if (!observation) return null;
    return {
      month: observation.month,
      averageRate: observation.rate,
      source:
        "European Central Bank, MFI Interest Rate Statistics, series " +
        "MIR.M.PT.B.A2C.A.R.A.2250.EUR.N (https://data-api.ecb.europa.eu)",
      retrievedAt: new Date().toISOString().slice(0, 10),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Everything the rate inputs need: the index, and the market context. */
export interface RateContext {
  euribor: EuriborState;
  market: MarketRateReference;
  marketOrigin: EuriborOrigin;
}

export async function loadRateContext(
  assessmentDate: string,
): Promise<RateContext> {
  const [euribor, market] = await Promise.all([
    loadEuribor(assessmentDate),
    fetchMarketRate(),
  ]);

  if (market) {
    writeMarketCache(market);
    return { euribor, market, marketOrigin: "live" };
  }

  const cached = readMarketCache();
  return {
    euribor,
    market: cached ?? MARKET_RATE_FALLBACK,
    marketOrigin: cached ? "cache" : "bundled",
  };
}

function readMarketCache(
  storage: Storage | undefined = safeStorage(),
): MarketRateReference | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(MARKET_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MarketRateReference;
    return typeof parsed?.month === "string" &&
      typeof parsed?.averageRate === "number"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function writeMarketCache(
  reference: MarketRateReference,
  storage: Storage | undefined = safeStorage(),
): void {
  try {
    storage?.setItem(MARKET_CACHE_KEY, JSON.stringify(reference));
  } catch {
    // Same as the Euribor cache: not a reason to fail anything.
  }
}
