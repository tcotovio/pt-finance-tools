// IAS_2026, and the one invariant that keeps it from drifting.

import { describe, expect, it } from "vitest";
import { IAS_2026 } from "./ias-2026.js";
import { IRS_JOVEM_2026 } from "./irs-jovem-2026.js";
import { SELF_EMPLOYED_CONTRIBUTIONS_2018 as CONTRIBUTIONS } from "./selfemployed-contributions-2018.js";

describe("IAS_2026", () => {
  it("is the value Portaria n.º 480-A/2025/1 fixed", () => {
    expect(IAS_2026.value).toBe(537.13);
    expect(IAS_2026.effectiveFrom).toBe("2026-01-01");
  });

  // The IRS Jovem dataset carries its own copy, which predates this file. Two
  // homes for one number is exactly the shape of a future bug — next January
  // one gets updated and the other does not, and the IRS Jovem cap silently
  // keeps using last year's IAS behind a "Dados verificados" badge. Until the
  // field is folded into a reference, this pins them together.
  it("matches the copy inside IRS_JOVEM_2026", () => {
    expect(IRS_JOVEM_2026.ias).toBe(IAS_2026.value);
  });

  it("gives the IRS Jovem annual ceiling of 29 542,15 €", () => {
    expect(IRS_JOVEM_2026.capMultiplier * IAS_2026.value).toBeCloseTo(
      29542.15,
      2,
    );
  });

  it("gives a contribution ceiling of 6 445,56 € and a 4 × IAS threshold of 2 148,52 €", () => {
    expect(CONTRIBUTIONS.ceilingMultiplier * IAS_2026.value).toBeCloseTo(
      6445.56,
      2,
    );
    expect(
      CONTRIBUTIONS.accumulationThresholdMultiplier * IAS_2026.value,
    ).toBeCloseTo(2148.52, 2);
  });
});
