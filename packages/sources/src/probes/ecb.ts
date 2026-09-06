// Asking the ECB Data Portal what the newest observation is.
//
// The calendar in `schedule.ts` predicts when something newer should exist; a
// probe checks. For the two ECB-backed datasets the answer also carries the
// values, which is what lets `refresh` write the new snapshot instead of
// merely announcing that someone should.
//
// The payload is read by the engine's `parseEcbSeries` — the same function the
// app uses for its live Euribor fetch, pinned by the same captured fixture. A
// portal that changes shape therefore breaks one parser, in one place, with one
// test to fix.

import { parseEcbSeries, type EcbObservation } from "@pt-finance-tools/engine";
import type { Period } from "../period.js";

/** What a probe found upstream. */
export interface ProbeResult {
  /** The newest edition the publisher actually has out. */
  latest: Period;
  /**
   * The observation itself, when the feed hands over values rather than just a
   * date. Only these sources can be refreshed without a human reading a PDF.
   */
  observation?: EcbObservation;
}

/** A machine check against a publisher. */
export interface Probe {
  /** One line for the report, so a reader knows what was actually queried. */
  describe(): string;
  run(options?: ProbeOptions): Promise<ProbeResult>;
}

export interface ProbeOptions {
  /** Injectable for tests; defaults to the global. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const BASE = "https://data-api.ecb.europa.eu/service/data";
const DEFAULT_TIMEOUT_MS = 15_000;

/** The URL a series id resolves to, exported so the report can print it. */
export function ecbSeriesUrl(series: string): string {
  return `${BASE}/${series}?lastNObservations=1&format=jsondata`;
}

/**
 * A probe for one ECB series, identified as `DATAFLOW/KEY`.
 *
 * Asks for the last observation rather than a named month: the question here
 * is "what is the newest thing you have", which is exactly the opposite of the
 * app's live fetch, where the Instrução names the month and anything else is
 * the wrong number.
 *
 * Throws on a failed request or an unreadable payload. The caller turns that
 * into a `probe-failed` line; nothing downstream writes data from a throw.
 */
export function ecbSeriesProbe(series: string): Probe {
  return {
    describe: () => `ECB Data Portal ${series}`,
    async run(options: ProbeOptions = {}): Promise<ProbeResult> {
      const fetchImpl = options.fetchImpl ?? globalThis.fetch;
      const url = ecbSeriesUrl(series);
      const response = await fetchImpl(url, {
        signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
        headers: { accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error(`${url} answered ${response.status}.`);
      }
      const observation = parseEcbSeries(await response.json());
      if (!observation) {
        throw new Error(`${url} returned a payload this parser could not read.`);
      }
      return { latest: observation.month, observation };
    },
  };
}
