// The report, and the one rule that matters most in it: a check that could not
// run is never reported as a check that passed.

import { describe, expect, it } from "vitest";
import { buildReport, actionable } from "./report.js";
import { renderMarkdown, renderTable, worstStatus } from "./render.js";
import type { SourceEntry } from "./manifest.js";

const base: SourceEntry = {
  id: "euribor",
  exportName: "EURIBOR_FALLBACK",
  label: "Euribor — média mensal",
  instrument: "ECB series",
  publisher: "European Central Bank",
  schedule: { kind: "periodic", unit: "month", lagDays: 5 },
  checkedOn: "2026-08-19",
  shipped: "2026-07",
  url: "https://data-api.ecb.europa.eu/",
};

const probing = (result: { latest: string } | Error): SourceEntry => ({
  ...base,
  probe: {
    describe: () => "stub",
    run: async () => {
      if (result instanceof Error) throw result;
      return result;
    },
  },
});

describe("buildReport", () => {
  it("answers from the calendar when not probing", async () => {
    const [line] = await buildReport({ today: "2026-09-06", entries: [base] });
    expect(line!.status).toBe("due");
    expect(line!.expected).toBe("2026-08");
    expect(line!.expectedFrom).toBe("calendar");
    expect(line!.daysSinceChecked).toBe(18);
  });

  it("lets the publisher's answer override the calendar's guess", async () => {
    // The calendar expected August; the portal says it has not published it
    // yet, so we are not behind after all.
    const [line] = await buildReport({
      today: "2026-09-06",
      probe: true,
      entries: [probing({ latest: "2026-07" })],
    });
    expect(line!.status).toBe("current");
    expect(line!.expectedFrom).toBe("probe");
  });

  it("reports a probe failure instead of silently passing", async () => {
    // The failure mode this guards against: the portal moves, every probe
    // errors, and the report goes green because nothing came back "newer".
    const [line] = await buildReport({
      today: "2026-09-06",
      probe: true,
      entries: [probing(new Error("503 from the portal"))],
    });
    expect(line!.status).toBe("probe-failed");
    expect(line!.probeError).toContain("503");
  });

  it("does not probe unless asked", async () => {
    const [line] = await buildReport({
      today: "2026-09-06",
      entries: [probing(new Error("should never run"))],
    });
    expect(line!.status).toBe("due");
  });

  it("filters to the ids asked for", async () => {
    const report = await buildReport({
      today: "2026-09-06",
      only: ["nothing-matches"],
      entries: [base],
    });
    expect(report).toEqual([]);
  });
});

describe("actionable", () => {
  it("keeps only the lines somebody has to act on", async () => {
    const report = await buildReport({
      today: "2026-09-06",
      entries: [base, { ...base, id: "fresh", shipped: "2026-08" }],
    });
    expect(actionable(report).map((line) => line.id)).toEqual(["euribor"]);
  });
});

describe("rendering", () => {
  it("puts the worst status first in the summary", async () => {
    const report = await buildReport({
      today: "2026-09-06",
      entries: [{ ...base, id: "fresh", shipped: "2026-08" }, { ...base, shipped: "2026-05" }],
    });
    expect(worstStatus(report)).toBe("overdue");
  });

  it("renders a table with a row per source", async () => {
    const report = await buildReport({ today: "2026-09-06", entries: [base] });
    const table = renderTable(report);
    expect(table).toContain("shipped");
    expect(table).toContain("euribor");
    expect(table).toContain("2026-07");
    expect(table).toContain("DUE");
  });

  it("renders an issue body that leads with what to do", async () => {
    const report = await buildReport({ today: "2026-09-06", entries: [base] });
    const markdown = renderMarkdown(report, "2026-09-06");
    expect(markdown).toContain("1 of 1 sources need attention");
    expect(markdown).toContain("We ship **2026-07**");
    expect(markdown).toContain("[ECB series](https://data-api.ecb.europa.eu/)");
  });

  it("says so plainly when there is nothing to do", async () => {
    const report = await buildReport({
      today: "2026-09-06",
      entries: [{ ...base, shipped: "2026-08" }],
    });
    expect(renderMarkdown(report, "2026-09-06")).toContain("Nothing to do.");
  });
});
