// The inventory has to stay complete, or the freshness check quietly stops
// covering whatever was added last.

import { describe, expect, it } from "vitest";
import { datasetExports, manifest, urlOf, vintageOf } from "./manifest.js";

const entries = manifest();

describe("the manifest", () => {
  it("covers every dataset the engine ships", () => {
    // Datasets are exported both by their dated name and through a stable
    // alias (EURIBOR_2026_07 / EURIBOR_FALLBACK), which are the same object —
    // so completeness is judged on the objects, not the names.
    const registered = new Set(
      entries.map((entry) => datasetExports().get(entry.exportName)),
    );
    const missing = [...datasetExports()]
      .filter(([, dataset]) => !registered.has(dataset))
      .map(([name]) => name);

    expect(
      missing,
      `Add these to packages/sources/src/manifest.ts so the freshness check covers them: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("gives every entry a unique id", () => {
    const ids = entries.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("reads the shipped vintage off the dataset rather than restating it", () => {
    // The point of this: a dataset bumped without touching the manifest still
    // reports its real edition, so the inventory cannot lie about the bundle.
    const euribor = entries.find((entry) => entry.id === "euribor")!;
    expect(euribor.shipped).toBe(datasetExports().get("EURIBOR_FALLBACK")!.month);
  });

  it("points every entry at somewhere to go and look", () => {
    // One exception, and it is deliberate: the state guarantee's citation
    // carries no URL because the DRE page for it could not be verified by
    // rendering (PLAN.md §9), and a link that 200s onto "página não
    // disponível" is worse than none.
    const linkless = entries.filter((entry) => !entry.url).map((entry) => entry.id);
    expect(linkless).toEqual(["state-guarantee"]);
  });

  it("was checked on a date that is not in the future", () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const entry of entries) {
      expect(entry.checkedOn <= today, `${entry.id} claims to have been checked on ${entry.checkedOn}`).toBe(true);
    }
  });

  it("explains every source that has no machine check", () => {
    for (const entry of entries) {
      if (entry.probe) continue;
      // A gap nobody wrote a reason for is a gap nobody will close.
      expect(typeof entry.schedule.kind).toBe("string");
      if (entry.schedule.kind === "periodic") {
        expect(entry.probeGap, `${entry.id} has no probe and no explanation`).toBeTruthy();
      }
    }
  });
});

describe("reading a dataset", () => {
  it("takes the vintage from whichever field the dataset versions itself by", () => {
    expect(vintageOf({ source: "x", month: "2026-07" })).toBe("2026-07");
    expect(vintageOf({ source: "x", period: "2026-Q2" })).toBe("2026-Q2");
    expect(vintageOf({ source: "x", effectiveFrom: "2026-01-01" })).toBe("2026");
  });

  it("pulls the first URL out of a citation", () => {
    expect(urlOf({ source: "Despacho n.º 1/2026 (https://example.pt/a)" })).toBe(
      "https://example.pt/a",
    );
    expect(urlOf({ source: "No link here" })).toBeUndefined();
  });
});
