// The freshness report: one line per source, and a verdict.
//
// Two modes, and the difference is what a caller is willing to wait for. The
// offline mode answers from the publication calendar alone, so it runs in
// milliseconds and works in a sandbox with no egress — that is the mode CI can
// afford on every change. The probing mode also asks the publishers that
// expose a feed, which turns a prediction into a fact and, for those sources,
// brings back the values `refresh` needs.

import { daysBetween } from "./period.js";
import { manifest, type SourceEntry } from "./manifest.js";
import { compareEditions, expectedLatest, statusFor, type Status } from "./schedule.js";
import type { ProbeResult } from "./probes/ecb.js";

export interface SourceReport {
  id: string;
  label: string;
  publisher: string;
  instrument: string;
  url?: string;
  /** The edition in the bundle. */
  shipped: string;
  /** The newest edition we believe exists, and where that belief came from. */
  expected: string | null;
  expectedFrom: "calendar" | "probe" | "none";
  status: Status;
  /** Days since a person last consulted the publisher for this dataset. */
  daysSinceChecked: number;
  /** Present when a probe ran and threw. */
  probeError?: string;
  /** Why no probe exists, for the sources that have none. */
  probeGap?: string;
  /** What a probe brought back, when it brought values. */
  observation?: ProbeResult["observation"];
}

export interface ReportOptions {
  today: string;
  /** Query the publishers that expose a feed. Off by default. */
  probe?: boolean;
  /** Restrict to these ids — useful when refreshing one source. */
  only?: readonly string[];
  fetchImpl?: typeof fetch;
  entries?: readonly SourceEntry[];
}

/**
 * Build the report.
 *
 * A probe's answer replaces the calendar's guess when it succeeds, and a probe
 * failure never downgrades a source to "current": the line says `probe-failed`
 * and carries the error, because "we could not check" and "it is fine" are
 * different things and only one of them is safe to be quiet about.
 */
export async function buildReport(options: ReportOptions): Promise<SourceReport[]> {
  const { today, probe = false, only, fetchImpl } = options;
  const entries = (options.entries ?? manifest()).filter(
    (entry) => !only || only.includes(entry.id),
  );

  return Promise.all(
    entries.map(async (entry): Promise<SourceReport> => {
      const base = {
        id: entry.id,
        label: entry.label,
        publisher: entry.publisher,
        instrument: entry.instrument,
        url: entry.url,
        shipped: entry.shipped,
        daysSinceChecked: daysBetween(entry.checkedOn, today),
        probeGap: entry.probeGap,
      };

      const calendar = expectedLatest(entry.schedule, today);
      const fromCalendar: SourceReport = {
        ...base,
        expected: calendar,
        expectedFrom: calendar === null ? "none" : "calendar",
        status: statusFor(entry.schedule, entry.shipped, today, entry.checkedOn),
      };

      if (!probe || !entry.probe) return fromCalendar;

      try {
        const result = await entry.probe.run({ fetchImpl });
        return {
          ...fromCalendar,
          expected: result.latest,
          expectedFrom: "probe",
          // The publisher's own answer replaces the calendar's guess outright:
          // if the ECB has August out, we are behind, whatever lag we assumed
          // — and two editions behind is graded as harshly here as it would be
          // offline.
          status: compareEditions(entry.schedule, entry.shipped, result.latest, today),
          observation: result.observation,
        };
      } catch (error) {
        return {
          ...fromCalendar,
          status: "probe-failed",
          probeError: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );
}

/** The lines that need someone to do something. */
export function actionable(report: readonly SourceReport[]): SourceReport[] {
  return report.filter((line) => line.status !== "current");
}
