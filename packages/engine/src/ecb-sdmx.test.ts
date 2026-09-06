// The ECB parser, tested against a real captured response.
//
// The fixture is an actual SDMX-JSON payload from the ECB data portal
// (3-month Euribor, July 2026), trimmed to the parts the parser reads. If the
// feed's shape ever changes, this is what catches it — for the app's live
// Euribor fetch and for the freshness probe alike, since both read the portal
// through this one function.

import { describe, expect, it } from "vitest";
import ecbResponse from "./fixtures/ecb-euribor-3m.json" with { type: "json" };
import { parseEcbSeries } from "./ecb-sdmx.js";

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
