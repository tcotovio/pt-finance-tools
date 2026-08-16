import { describe, expect, it } from "vitest";
import { ENGINE_VERSION } from "./index.js";

describe("engine scaffolding", () => {
  it("exposes a version so the test harness is wired up", () => {
    expect(ENGINE_VERSION).toBe("0.0.1");
  });
});
