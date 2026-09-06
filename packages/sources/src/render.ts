// Turning the report into something a person reads.
//
// Two renderings of the same lines: a table for whoever runs the command, and
// Markdown for the tracking issue the scheduled run keeps up to date. The
// Markdown is written to be *replaced* every week rather than appended to, so
// the issue always shows current state instead of a pile of history nobody
// reads.

import type { SourceReport } from "./report.js";
import type { Status } from "./schedule.js";

const MARKS: Record<Status, string> = {
  current: "ok",
  due: "DUE",
  overdue: "OVERDUE",
  "review-due": "REVIEW",
  "probe-failed": "PROBE?",
};

const HEADLINES: Record<Status, string> = {
  current: "up to date",
  due: "a newer edition should exist",
  overdue: "more than one edition behind",
  "review-due": "nobody has checked this in a while",
  "probe-failed": "the machine check could not run",
};

/** The status of a whole report: its worst line. */
export function worstStatus(report: readonly SourceReport[]): Status {
  const order: Status[] = ["overdue", "probe-failed", "due", "review-due", "current"];
  return order.find((status) => report.some((line) => line.status === status)) ?? "current";
}

function pad(text: string, width: number): string {
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}

/** A fixed-width table for a terminal. */
export function renderTable(report: readonly SourceReport[]): string {
  const rows = report.map((line) => [
    MARKS[line.status],
    line.id,
    line.shipped,
    line.expected ?? "—",
    line.expectedFrom === "probe" ? "probe" : line.expectedFrom === "calendar" ? "calendar" : "review",
    `${line.daysSinceChecked}d`,
  ]);
  const header = ["", "source", "shipped", "expected", "from", "checked"];
  const widths = header.map((_, column) =>
    Math.max(header[column]!.length, ...rows.map((row) => row[column]!.length)),
  );

  const lines = [
    header.map((cell, i) => pad(cell, widths[i]!)).join("  "),
    widths.map((width) => "-".repeat(width)).join("  "),
    ...rows.map((row) => row.map((cell, i) => pad(cell, widths[i]!)).join("  ")),
  ];

  const notes = report
    .filter((line) => line.probeError || (line.status !== "current" && line.url))
    .map((line) =>
      line.probeError
        ? `  ${line.id}: probe failed — ${line.probeError}`
        : `  ${line.id}: ${HEADLINES[line.status]} — ${line.url}`,
    );

  return [...lines, ...(notes.length ? ["", ...notes] : [])].join("\n");
}

/** The issue body: what to do, and what nobody needs to touch. */
export function renderMarkdown(report: readonly SourceReport[], today: string): string {
  const todo = report.filter((line) => line.status !== "current");
  const fine = report.filter((line) => line.status === "current");

  const section = (line: SourceReport): string => {
    const where = line.url ? `[${line.instrument}](${line.url})` : line.instrument;
    const detail = line.probeError
      ? `The machine check failed: \`${line.probeError}\``
      : line.expected
        ? `We ship **${line.shipped}**; **${line.expected}** should exist ` +
          `(${line.expectedFrom === "probe" ? "confirmed with the publisher" : "from the publication calendar"}).`
        : `Nothing has been confirmed with the publisher for **${line.daysSinceChecked} days**.`;
    return [
      `### ${MARKS[line.status]} — ${line.label}`,
      "",
      detail,
      "",
      `- Publisher: ${line.publisher}`,
      `- Source: ${where}`,
      line.probeGap ? `- No machine check: ${line.probeGap}` : "",
      "",
    ]
      .filter(Boolean)
      .join("\n");
  };

  return [
    `_Last run: ${today}._`,
    "",
    todo.length === 0
      ? "Every source is the newest edition its publisher should have out. Nothing to do."
      : `${todo.length} of ${report.length} sources need attention.`,
    "",
    ...todo.map(section),
    "<details><summary>Sources with nothing outstanding</summary>",
    "",
    ...fine.map((line) => `- \`${line.id}\` — ships ${line.shipped}, checked ${line.daysSinceChecked} days ago`),
    "",
    "</details>",
    "",
    "---",
    "",
    "Run `npm run sources:check -- --probe` locally to reproduce this, and " +
      "`npm run sources:refresh` to pull the ECB-backed datasets forward.",
  ].join("\n");
}
