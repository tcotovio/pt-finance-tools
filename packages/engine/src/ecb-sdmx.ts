// Reading the ECB Data Portal's SDMX-JSON.
//
// Two very different callers need this, which is why it lives in the engine
// rather than beside either of them: the PWA fetches the Euribor month live on
// every visit, and the source-freshness tooling asks the same portal whether a
// newer observation has been published than the one we ship. One parser, one
// fixture, one set of tests — a portal that changes shape breaks both in the
// same place instead of one of them silently.
//
// Pure: it parses a payload someone else fetched. No `fetch` in the engine.

/** One observation pulled out of an SDMX-JSON response. */
export interface EcbObservation {
  /** The period label, `YYYY-MM` for the monthly series used here. */
  month: string;
  /** The value as a fraction — the portal's percentage divided by 100. */
  rate: number;
}

/**
 * Parse the ECB's SDMX-JSON into the last observation it carries.
 *
 * The shape is awkward on purpose — observations are keyed by *position*, and
 * the period labels live in a parallel `structure.dimensions.observation`
 * array — so this is kept pure and tested against a checked-in fixture rather
 * than being written inline in a fetch.
 *
 * Returns `null` for anything malformed. A feed that changed shape should
 * degrade to the cache or the bundled snapshot, not throw into the UI; the
 * tooling turns the same `null` into a reported probe failure rather than
 * writing a dataset it could not read.
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
