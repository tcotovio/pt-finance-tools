// Cross-check (Axis A): the hand-transcribed BdP parameters vs verbatim text
// mechanically extracted from the two official PDFs.
//
// Same shape as the withholding-table source tests, but the source here is
// prose rather than a table, so the check is: pull the number back out of the
// quoted provision and diff it against the dataset. Editing `dstiLimit` to
// 0.50 without the law changing fails here, because the quote still says 45 %.

import { describe, expect, it } from "vitest";
import recomendacao from "./fixtures/bdp-2026-recomendacao.json" with { type: "json" };
import instrucao from "./fixtures/instrucao-23-2023.json" with { type: "json" };
import { BDP_2026 } from "./bdp-2026.js";
import { INTEREST_RATE_SHOCK_2023 } from "./interest-rate-shock-2023.js";

/** First percentage in a Portuguese provision, as a fraction. */
function percentIn(text: string): number {
  const match = text.match(/(\d+(?:,\d+)?)\s*%/);
  if (!match) throw new Error(`No percentage found in: ${text}`);
  return Number(match[1].replace(",", ".")) / 100;
}

/** First "N pontos percentuais" / "N ponto percentual" value, as a fraction. */
function percentagePointsIn(text: string): number {
  const match = text.match(/(\d+(?:,\d+)?)\s*pontos?\s+percentua/);
  if (!match) throw new Error(`No percentage points found in: ${text}`);
  return Number(match[1].replace(",", ".")) / 100;
}

/** First "N anos" value. */
function yearsIn(text: string): number {
  const match = text.match(/(\d+)\s*anos/);
  if (!match) throw new Error(`No year count found in: ${text}`);
  return Number(match[1]);
}

describe("BDP_2026 vs the extracted Recomendação 1/2026", () => {
  const p = recomendacao.provisions;

  it("cites the same instrument the fixture came from", () => {
    expect(BDP_2026.source).toContain("1/2026");
    expect(BDP_2026.source).toContain(recomendacao.sourceUrl);
  });

  it("DSTI ceiling matches art. 6.º n.º 1", () => {
    expect(BDP_2026.dstiLimit).toBeCloseTo(percentIn(p.dstiLimit.text), 10);
  });

  it("DSTI exception share matches art. 6.º n.º 2", () => {
    expect(BDP_2026.dstiExceptionShare).toBeCloseTo(
      percentIn(p.dstiExceptionShare.text),
      10,
    );
  });

  it("LTV for habitação própria e permanente matches art. 5.º n.º 1", () => {
    expect(BDP_2026.ltvLimit["own-permanent-residence"]).toBeCloseTo(
      percentIn(p.ltvOwnPermanentResidence.text),
      10,
    );
  });

  it("LTV for other purposes matches art. 5.º n.º 2", () => {
    expect(BDP_2026.ltvLimit.other).toBeCloseTo(percentIn(p.ltvOther.text), 10);
  });

  it("maturity ceilings match art. 7.º n.º 1", () => {
    expect(BDP_2026.maturity.yearsAtOrBelowThreshold).toBe(
      yearsIn(p.maturityYounger.text),
    );
    expect(BDP_2026.maturity.yearsAboveThreshold).toBe(
      yearsIn(p.maturityOlder.text),
    );
    // The threshold age is the *second* "anos" in each alínea — pin it from
    // the younger band's wording, which is where the 35 comes from.
    expect(p.maturityYounger.text).toContain(
      `idade inferior ou igual a ${BDP_2026.maturity.ageThreshold} anos`,
    );
  });

  it("consumer maturity ceilings match art. 7.º n.ºs 3–4", () => {
    expect(BDP_2026.consumerMaturityYears.personal).toBe(
      yearsIn(p.consumerMaturityPersonal.text),
    );
    expect(BDP_2026.consumerMaturityYears.auto).toBe(
      yearsIn(p.consumerMaturityAuto.text),
    );
    // The n.º 4 exception raises personal credit to the automóvel ceiling,
    // conditional on the institution verifying the purpose.
    expect(BDP_2026.consumerMaturityYears["personal-earmarked"]).toBe(10);
    expect(p.consumerMaturityEarmarked.text).toContain("educação");
    expect(p.consumerMaturityEarmarked.text).toContain("saúde");
    expect(p.consumerMaturityEarmarked.text).toContain("transição energética");
    expect(p.consumerMaturityEarmarked.text).toContain("devidamente comprovada");
  });

  it("income reduction matches art. 4.º n.º 5 al. b)", () => {
    expect(BDP_2026.incomeReduction.fraction).toBeCloseTo(
      percentIn(p.incomeReduction.text),
      10,
    );
    expect(BDP_2026.incomeReduction.age).toBe(yearsIn(p.incomeReduction.text));
  });

  it("takes effect on the date art. 11.º n.º 1 gives", () => {
    expect(p.effectiveFrom.text).toContain("1 de agosto de 2026");
    expect(BDP_2026.effectiveFrom).toBe("2026-08-01");
  });

  it("defers the rate shock to Instrução 23/2023, as the dataset says", () => {
    expect(p.shockDeferral.text).toContain("Instrução n.º 23/2023");
    expect(INTEREST_RATE_SHOCK_2023.source).toContain("23/2023");
  });
});

describe("INTEREST_RATE_SHOCK_2023 vs the extracted Instrução", () => {
  const p = instrucao.provisions;

  it("cites the same instrument the fixture came from", () => {
    expect(INTEREST_RATE_SHOCK_2023.source).toContain(instrucao.sourceUrl);
  });

  it("has one band per alínea, ordered ascending", () => {
    expect(INTEREST_RATE_SHOCK_2023.bands).toHaveLength(3);
    expect(INTEREST_RATE_SHOCK_2023.bands.map((b) => b.upToYears)).toEqual([
      5,
      10,
      null,
    ]);
  });

  it("shock values match the three alíneas", () => {
    const [short, medium, long] = INTEREST_RATE_SHOCK_2023.bands;
    expect(short.shock).toBeCloseTo(percentagePointsIn(p.shortTerm.text), 10);
    expect(medium.shock).toBeCloseTo(percentagePointsIn(p.mediumTerm.text), 10);
    expect(long.shock).toBeCloseTo(percentagePointsIn(p.longTerm.text), 10);
  });

  it("band bounds match the terms the alíneas name", () => {
    expect(p.shortTerm.text).toContain("igual ou inferior a 5 anos");
    expect(p.mediumTerm.text).toContain(
      "superior a 5 anos e igual ou inferior a 10 anos",
    );
    expect(p.longTerm.text).toContain("superior a 10 anos");
  });

  it("averages the indexante over the preceding month", () => {
    expect(p.indexAveraging.text).toContain("média aritmética simples");
    expect(p.indexAveraging.text).toContain("mês anterior");
    expect(INTEREST_RATE_SHOCK_2023.indexAveragingMonths).toBe(1);
  });
});
