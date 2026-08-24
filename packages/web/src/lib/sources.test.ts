import { describe, expect, it } from "vitest";
import {
  computeNetWageForDate,
  maxLoanForDate,
  selfEmployedNet,
  EURIBOR_FALLBACK,
  type MaxLoanInput,
  type SelfEmployedInput,
  type WageInput,
} from "@pt-finance-tools/engine";
import {
  loanSources,
  selfEmployedSources,
  splitCitation,
  wageSources,
} from "./sources.js";

const REFERENCE = "2026-08-19";
const wage = (extra: Partial<WageInput> = {}): WageInput => ({
  grossMonthly: 1500,
  region: "continente",
  category: "unmarried",
  dependents: 0,
  referenceDate: REFERENCE,
  ...extra,
});

const loanInput: MaxLoanInput = {
  borrower: { monthlyIncome: 2000, age: 30 },
  purpose: "own-permanent-residence",
  propertyPrice: 250_000,
  annualRate: 0.038,
  termYears: 30,
  assessmentDate: "2026-09-01",
};

describe("splitCitation", () => {
  it("separates the URL from the citation text", () => {
    const { citation, url } = splitCitation(
      "Despacho n.º 233-A/2026 (https://example.gov.pt/doc.pdf)",
    );
    expect(url).toBe("https://example.gov.pt/doc.pdf");
    expect(citation).toBe("Despacho n.º 233-A/2026");
  });

  it("handles a URL appended after a dash, not just a parenthesised one", () => {
    // The datasets punctuate differently; the extractor must not assume one
    // house style, and must not leave a dangling dash behind.
    const { citation, url } = splitCitation(
      "Despacho n.º 233-A/2026 (DR 2.ª série) — https://example.gov.pt/a.pdf",
    );
    expect(url).toBe("https://example.gov.pt/a.pdf");
    expect(citation).toBe("Despacho n.º 233-A/2026 (DR 2.ª série)");
  });

  it("leaves a citation with no URL intact", () => {
    const { citation, url } = splitCitation("CIRS art. 2.º n.º 3 b) 2)");
    expect(citation).toBe("CIRS art. 2.º n.º 3 b) 2)");
    expect(url).toBeUndefined();
  });

  it("does not leave double spaces where the URL was", () => {
    const { citation } = splitCitation("A (https://x.pt/a) e B");
    expect(citation).not.toMatch(/\s{2}/);
  });
});

describe("wageSources", () => {
  it("always cites the withholding tables first", () => {
    const result = computeNetWageForDate(wage());
    const entries = wageSources(result, REFERENCE);
    expect(entries[0].key).toBe("withholding");
    expect(entries[0].url).toContain("http");
    expect(entries[0].verified).toBe(true);
  });

  it("always cites the wage reference, and marks it as context only", () => {
    // It is shown beside the result, never used to compute it — and like the
    // loan-side market statistics it carries no verified flag, because a
    // quoted statistic is not cross-checked in the sense the badge means.
    const entries = wageSources(computeNetWageForDate(wage()), REFERENCE);
    const market = entries.find((e) => e.key === "wage-market");
    expect(market).toBeDefined();
    expect(market!.usedFor).toMatch(/não entra em nenhum cálculo/i);
    expect(market!.verified).toBeUndefined();
    expect(market!.url).toContain("ine.pt");
  });

  it("adds the meal allowance limits only when one was paid", () => {
    const withMeal = computeNetWageForDate(
      wage({ mealAllowance: { dailyAmount: 12, days: 22, method: "card" } }),
    );
    const keys = wageSources(withMeal, REFERENCE).map((e) => e.key);
    expect(keys).toContain("meal");
  });

  it("adds the IRS Jovem parameters only when the regime is on", () => {
    const withJovem = computeNetWageForDate(
      wage({ irsJovem: { yearOfIncome: 1 } }),
    );
    const keys = wageSources(withJovem, REFERENCE).map((e) => e.key);
    expect(keys).toContain("irs-jovem");
    expect(wageSources(computeNetWageForDate(wage()), REFERENCE).map((e) => e.key))
      .not.toContain("irs-jovem");
  });

  it("propagates a dataset's own verified flag", () => {
    // Madeira ships unverified — Axis B has no source covering it — and the
    // list must say so rather than inheriting the Continente's badge.
    const madeira = computeNetWageForDate(wage({ region: "madeira" }));
    expect(wageSources(madeira, REFERENCE)[0].verified).toBe(false);
  });

  it("gives every entry something to check", () => {
    const result = computeNetWageForDate(
      wage({
        mealAllowance: { dailyAmount: 12, days: 22, method: "card" },
        irsJovem: { yearOfIncome: 1 },
      }),
    );
    for (const entry of wageSources(result, REFERENCE)) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.usedFor.length).toBeGreaterThan(0);
      expect(entry.citation.length).toBeGreaterThan(0);
    }
  });
});

describe("loanSources", () => {
  const entries = loanSources(
    maxLoanForDate(loanInput),
    loanInput.assessmentDate,
    EURIBOR_FALLBACK,
  );

  it("lists all four instruments behind the answer", () => {
    expect(entries.map((e) => e.key)).toEqual([
      "recomendacao",
      "shock",
      "euribor",
      "market",
    ]);
  });

  it("links the two that decide the limits", () => {
    expect(entries[0].url).toContain("bportugal.pt");
    expect(entries[1].url).toContain("bportugal.pt");
  });

  it("names the month of the index actually used", () => {
    expect(entries[2].label).toContain(EURIBOR_FALLBACK.month);
  });

  it("marks the market statistics as feeding no calculation", () => {
    // It is context beside the answer, not an input — and saying so is the
    // difference between a source list and a bibliography.
    expect(entries[3].usedFor).toMatch(/não entra em nenhum cálculo/i);
    expect(entries[3].verified).toBeUndefined();
  });

  it("reports the limits as verified, now that both axes pass", () => {
    expect(entries[0].verified).toBe(true);
    expect(entries[1].verified).toBe(true);
  });
});

describe("selfEmployedSources", () => {
  const result = (extra: Partial<SelfEmployedInput> = {}) =>
    selfEmployedNet({
      monthlyInvoicing: 2000,
      activity: "services",
      retentionCategory: "professional",
      referenceDate: REFERENCE,
      ...extra,
    });

  it("lists the four instruments the answer rests on", () => {
    expect(selfEmployedSources(result()).map((e) => e.key)).toEqual([
      "cirs-101",
      "civa-53",
      "cc-independentes",
      "ias",
    ]);
  });

  it("reports the retention and contribution datasets as verified", () => {
    const entries = selfEmployedSources(result());
    expect(entries.find((e) => e.key === "cirs-101")?.verified).toBe(true);
    expect(entries.find((e) => e.key === "cc-independentes")?.verified).toBe(
      true,
    );
  });

  // The badge is computed from these entries, so it has to agree with the
  // engine's own `verified`. Under the exemption no CIVA figure is applied,
  // and an entry that is cited but never computed from neither passes nor
  // fails — the same standing the market statistics already have.
  it("excludes the IVA dataset from the badge while the exemption applies", () => {
    const entries = selfEmployedSources(result());
    const civa = entries.find((e) => e.key === "civa-53");
    expect(civa?.verified).toBeUndefined();
    expect(civa?.usedFor).toMatch(/não entrou em nenhuma conta/i);
    expect(result().verified).toBe(true);
  });

  it("counts it once IVA is actually charged, and flags it unverified", () => {
    const withVat = result({ chargesVat: true });
    const civa = selfEmployedSources(withVat).find((e) => e.key === "civa-53");
    expect(civa?.verified).toBe(false);
    expect(withVat.verified).toBe(false);
  });
});
