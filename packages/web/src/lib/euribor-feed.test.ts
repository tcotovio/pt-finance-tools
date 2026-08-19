// The ECB parser and the cache, tested against a real captured response.
//
// The fixture is an actual SDMX-JSON payload from the ECB data portal
// (3-month Euribor, July 2026), trimmed to the parts the parser reads. If the
// feed's shape ever changes, this is what catches it.

import { describe, expect, it } from "vitest";
import ecbResponse from "./fixtures/ecb-euribor-3m.json" with { type: "json" };
import { parseEcbSeries, readCache, writeCache } from "./euribor-feed.js";
import type { EuriborSnapshot } from "@pt-finance-tools/engine";

describe("parseEcbSeries", () => {
  it("pulls the month and rate out of a real ECB response", () => {
    const observation = parseEcbSeries(ecbResponse);
    expect(observation).toEqual({ month: "2026-07", rate: 0.024253913 });
  });

  it("converts the ECB's percentage into a fraction", () => {
    // The portal quotes 2.4253913 (percent); the engine works in fractions
    // everywhere, and mixing the two would be a 100× error.
    expect(parseEcbSeries(ecbResponse)!.rate).toBeCloseTo(0.024253913, 12);
  });

  it("takes the last observation when several are returned", () => {
    const multi = {
      dataSets: [
        {
          series: {
            "0:0:0": {
              observations: {
                "0": [2.1753, 0, 0],
                "1": [2.2261, 0, 0],
                "2": [2.339, 0, 0],
              },
            },
          },
        },
      ],
      structure: {
        dimensions: {
          observation: [
            { values: [{ id: "2026-04" }, { id: "2026-05" }, { id: "2026-06" }] },
          ],
        },
      },
    };
    expect(parseEcbSeries(multi)).toEqual({ month: "2026-06", rate: 0.02339 });
  });

  it("returns null rather than throwing on anything malformed", () => {
    // A feed that changed shape must degrade to the cache or the bundled
    // snapshot, never throw into the UI.
    expect(parseEcbSeries(null)).toBeNull();
    expect(parseEcbSeries("nope")).toBeNull();
    expect(parseEcbSeries({})).toBeNull();
    expect(parseEcbSeries({ dataSets: [] })).toBeNull();
    expect(parseEcbSeries({ dataSets: [{}], structure: {} })).toBeNull();
  });

  it("returns null when the period label is not a month", () => {
    const broken = {
      dataSets: [{ series: { s: { observations: { "0": [2.4, 0, 0] } } } }],
      structure: { dimensions: { observation: [{ values: [{ id: "2026" }] }] } },
    };
    expect(parseEcbSeries(broken)).toBeNull();
  });

  it("skips observations with no value", () => {
    const gap = {
      dataSets: [
        {
          series: {
            s: { observations: { "0": [2.4253913, 0, 0], "1": [null, 0, 0] } },
          },
        },
      ],
      structure: {
        dimensions: {
          observation: [{ values: [{ id: "2026-07" }, { id: "2026-08" }] }],
        },
      },
    };
    expect(parseEcbSeries(gap)).toEqual({ month: "2026-07", rate: 0.024253913 });
  });
});

/** A minimal in-memory Storage, so the cache is testable without a DOM. */
function fakeStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

const snapshot: EuriborSnapshot = {
  month: "2026-07",
  rates: { "3m": 0.024253913, "6m": 0.026467391, "12m": 0.02855087 },
  source: "test",
  retrievedAt: "2026-08-19",
};

describe("the cache", () => {
  it("round-trips a snapshot", () => {
    const storage = fakeStorage();
    writeCache(snapshot, storage);
    expect(readCache(storage)).toEqual(snapshot);
  });

  it("returns null when nothing is stored", () => {
    expect(readCache(fakeStorage())).toBeNull();
  });

  it("rejects stored junk instead of trusting it", () => {
    expect(readCache(fakeStorage({ "euribor-snapshot-v1": "{" }))).toBeNull();
    expect(
      readCache(fakeStorage({ "euribor-snapshot-v1": '{"month":"2026-07"}' })),
    ).toBeNull();
  });

  it("rejects a snapshot missing a tenor", () => {
    const partial = JSON.stringify({
      month: "2026-07",
      rates: { "3m": 0.02, "6m": 0.02 },
    });
    expect(readCache(fakeStorage({ "euribor-snapshot-v1": partial }))).toBeNull();
  });

  it("survives storage being unavailable", () => {
    // Cookies blocked, private mode, quota exceeded — none of which is a
    // reason to fail the calculation.
    const hostile = {
      ...fakeStorage(),
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    expect(readCache(hostile)).toBeNull();
    expect(() => writeCache(snapshot, hostile)).not.toThrow();
  });
});
