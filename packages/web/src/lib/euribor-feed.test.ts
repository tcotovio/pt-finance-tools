// The browser cache behind the Euribor feed.
//
// Reading the ECB's payload is the engine's job now (`ecb-sdmx.test.ts` pins
// the shape against a captured response), because the freshness tooling asks
// the same portal the same question. What is left here is the part that only
// exists in a browser: a cache that has to survive storage being hostile.

import { describe, expect, it } from "vitest";
import { readCache, writeCache } from "./euribor-feed.js";
import type { EuriborSnapshot } from "@pt-finance-tools/engine";

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
