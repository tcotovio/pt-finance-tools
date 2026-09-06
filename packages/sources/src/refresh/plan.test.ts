// Planning a refresh, against a stubbed portal.
//
// The ECB is unreachable from CI's sandbox and from most contributors' first
// run, so the decisions — is there a newer month, are all three tenors there,
// is this a rate or a percentage someone forgot to divide — are tested against
// payloads shaped like the captured fixture rather than against the network.

import { describe, expect, it } from "vitest";
import { planConsumerRefresh, planEuriborRefresh } from "./index.js";

/** An SDMX-JSON payload carrying one observation, as the portal sends it. */
function payload(month: string, percent: number): unknown {
  return {
    dataSets: [{ series: { "0:0:0": { observations: { "0": [percent, 0, 0] } } } }],
    structure: { dimensions: { observation: [{ values: [{ id: month }] }] } },
  };
}

/** A fetch that answers from a map of series-substring → payload. */
function stubFetch(answers: Record<string, unknown>): typeof fetch {
  return (async (url: string) => {
    const match = Object.entries(answers).find(([key]) => String(url).includes(key));
    if (!match) throw new Error(`No stub for ${url}`);
    return { ok: true, json: async () => match[1] } as Response;
  }) as unknown as typeof fetch;
}

const AUGUST = {
  EURIBOR3MD: payload("2026-08", 2.4401),
  EURIBOR6MD: payload("2026-08", 2.6612),
  EURIBOR1YD: payload("2026-08", 2.8703),
};

describe("planEuriborRefresh", () => {
  it("writes a module for the new month with all three tenors", async () => {
    const plan = await planEuriborRefresh("2026-07", {
      today: "2026-09-06",
      fetchImpl: stubFetch(AUGUST),
    });

    expect(plan).not.toBeNull();
    expect(plan!.from).toBe("2026-07");
    expect(plan!.to).toBe("2026-08");
    expect(plan!.contents).toContain('month: "2026-08"');
    expect(plan!.contents).toContain('"3m": 0.024401');
    expect(plan!.contents).toContain('"6m": 0.026612');
    expect(plan!.contents).toContain('"12m": 0.028703');
    expect(plan!.contents).toContain('retrievedAt: "2026-09-06"');
    expect(plan!.newPath).toMatch(/euribor-2026-08\.ts$/);
    expect(plan!.oldPath).toMatch(/euribor-2026-07\.ts$/);
  });

  it("does nothing when the portal has nothing newer", async () => {
    const plan = await planEuriborRefresh("2026-08", {
      fetchImpl: stubFetch(AUGUST),
    });
    expect(plan).toBeNull();
  });

  it("refuses when a tenor answers for a different month", async () => {
    // A half-published month would otherwise produce a snapshot mixing August's
    // 3M with July's 12M, which is worse than no snapshot at all.
    const plan = planEuriborRefresh("2026-07", {
      fetchImpl: stubFetch({ ...AUGUST, EURIBOR1YD: payload("2026-07", 2.8551) }),
    });
    await expect(plan).rejects.toThrow(/refusing to mix months/);
  });

  it("refuses a rate that was never divided by 100", async () => {
    const plan = planEuriborRefresh("2026-07", {
      fetchImpl: stubFetch({ ...AUGUST, EURIBOR6MD: payload("2026-08", 266.12) }),
    });
    await expect(plan).rejects.toThrow(/not a plausible monthly average/);
  });

  it("refuses a payload it cannot read", async () => {
    const plan = planEuriborRefresh("2026-07", {
      fetchImpl: stubFetch({ EURIBOR3MD: { unexpected: "shape" } }),
    });
    await expect(plan).rejects.toThrow(/no readable observation/);
  });
});

describe("planConsumerRefresh", () => {
  it("writes the new month's average", async () => {
    const plan = await planConsumerRefresh("2026-06", {
      today: "2026-09-06",
      fetchImpl: stubFetch({ "MIR/": payload("2026-07", 8.74) }),
    });
    expect(plan!.to).toBe("2026-07");
    expect(plan!.contents).toContain("averageRate: 0.0874");
    expect(plan!.rename.toConstant).toBe("CONSUMER_MARKET_2026_07");
  });

  it("refuses a rate outside anything a consumer loan is priced at", async () => {
    const plan = planConsumerRefresh("2026-06", {
      fetchImpl: stubFetch({ "MIR/": payload("2026-07", 874) }),
    });
    await expect(plan).rejects.toThrow(/not a plausible TAA/);
  });
});
