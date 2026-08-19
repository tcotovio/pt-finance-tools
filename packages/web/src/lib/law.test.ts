import { describe, expect, it } from "vitest";
import { CONTINENTE_2026 } from "@pt-finance-tools/engine";
import { LAW_REFERENCES, lawReference } from "./law.js";

const entries = Object.entries(LAW_REFERENCES);

describe("law references", () => {
  it("gives every citation a label, a heading and an explanation", () => {
    for (const [id, reference] of entries) {
      expect(reference.label, id).not.toBe("");
      expect(reference.title, id).not.toBe("");
      // The explanation is the point: a bare citation helps nobody.
      expect(reference.summary.length, id).toBeGreaterThan(40);
    }
  });

  it("only links to https sources", () => {
    for (const [id, reference] of entries) {
      if ("url" in reference && reference.url) {
        expect(reference.url, id).toMatch(/^https:\/\//);
      }
    }
  });

  it("points the despacho at the PDF the dataset was transcribed from", () => {
    // Checked against the engine's own provenance rather than a copy of the
    // string: if the dataset is ever re-sourced, this fails instead of
    // quietly citing a document the numbers did not come from.
    const url = lawReference("despacho-233a-2026").url;
    expect(url).toBeDefined();
    expect(CONTINENTE_2026.source).toContain(url);
  });
});
