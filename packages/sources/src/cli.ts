// `sources check` and `sources refresh`.
//
// Two commands with deliberately different postures. `check` is safe to run
// anywhere, including with no network, and answers a question. `refresh`
// changes the repository, and only for the sources whose values can be fetched
// and validated end to end — it writes a dataset or it explains why it did not.

import { writeFileSync } from "node:fs";
import { isoDate } from "./period.js";
import { manifest } from "./manifest.js";
import { actionable, buildReport } from "./report.js";
import { renderMarkdown, renderTable, worstStatus } from "./render.js";
import type { Status } from "./schedule.js";
import { applyPlan, planConsumerRefresh, planEuriborRefresh } from "./refresh/index.js";

interface Flags {
  probe: boolean;
  json?: string;
  markdown?: string;
  today: string;
  only?: string[];
  warnOnly: boolean;
  dryRun: boolean;
  failOn: Status[];
}

/**
 * What a non-zero exit means by default.
 *
 * Deliberately not "anything that is not current". A daily job that goes red
 * the moment a source becomes *due* would be red most of the time — a law that
 * nobody has re-read in six months is a prompt, and a prompt that fails the
 * build every morning is a prompt everybody learns to ignore. So the exit code
 * is reserved for the two states that mean something is actually broken: we
 * are serving data that has been superseded outright, or the machine check
 * could not run at all. The rest is what the tracking issue is for.
 */
const FAILING_BY_DEFAULT: Status[] = ["overdue", "probe-failed"];

function parseFlags(argv: readonly string[]): Flags {
  const flags: Flags = {
    probe: argv.includes("--probe"),
    today: isoDate(new Date()),
    warnOnly: argv.includes("--warn-only"),
    dryRun: argv.includes("--dry-run"),
    failOn: FAILING_BY_DEFAULT,
  };
  for (const arg of argv) {
    const [name, value] = arg.split("=", 2);
    if (!value) continue;
    if (name === "--today") flags.today = value;
    if (name === "--json") flags.json = value;
    if (name === "--markdown") flags.markdown = value;
    if (name === "--only") flags.only = value.split(",");
    if (name === "--fail-on") flags.failOn = value.split(",") as Status[];
  }
  return flags;
}

async function check(flags: Flags): Promise<number> {
  const report = await buildReport({
    today: flags.today,
    probe: flags.probe,
    only: flags.only,
  });

  console.log(renderTable(report));
  if (flags.json) writeFileSync(flags.json, JSON.stringify(report, null, 2), "utf8");
  if (flags.markdown) writeFileSync(flags.markdown, renderMarkdown(report, flags.today), "utf8");

  const outstanding = actionable(report);
  console.log(
    outstanding.length === 0
      ? `\nAll ${report.length} sources are the newest edition that should exist.`
      : `\n${outstanding.length} of ${report.length} sources need attention (worst: ${worstStatus(report)}).`,
  );

  const failing = outstanding.filter((line) => flags.failOn.includes(line.status));
  if (failing.length > 0 && !flags.warnOnly) {
    console.error(
      `\nFailing on: ${failing.map((line) => `${line.id} (${line.status})`).join(", ")}.`,
    );
    return 1;
  }
  return 0;
}

/** The datasets whose values can be fetched, validated and written unattended. */
const REFRESHABLE = {
  euribor: planEuriborRefresh,
  "consumer-market": planConsumerRefresh,
} as const;

async function refresh(flags: Flags): Promise<number> {
  const entries = manifest().filter(
    (entry) => entry.id in REFRESHABLE && (!flags.only || flags.only.includes(entry.id)),
  );

  let failures = 0;
  let changes = 0;

  for (const entry of entries) {
    const plan = REFRESHABLE[entry.id as keyof typeof REFRESHABLE];
    try {
      const proposed = await plan(entry.shipped, { today: flags.today });
      if (!proposed) {
        console.log(`${entry.id}: already on ${entry.shipped}, nothing newer published.`);
        continue;
      }
      changes += 1;
      if (flags.dryRun) {
        console.log(`${entry.id}: would move ${proposed.from} → ${proposed.to} (dry run).`);
        continue;
      }
      applyPlan(proposed);
      console.log(`${entry.id}: ${proposed.from} → ${proposed.to}, written.`);
    } catch (error) {
      failures += 1;
      console.error(
        `${entry.id}: refused to refresh — ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (changes > 0 && !flags.dryRun) {
    console.log(
      "\nRebuild and run the tests before committing: a new vintage is data, " +
        "and the suite is what says the data is usable.",
    );
  }
  return failures > 0 ? 1 : 0;
}

async function main(): Promise<number> {
  const [command = "check", ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);

  if (command === "check") return check(flags);
  if (command === "refresh") return refresh(flags);

  console.error(`Unknown command "${command}". Expected "check" or "refresh".`);
  return 2;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error);
    process.exitCode = 2;
  },
);
