// Interest-rate shock for the DSTI stress test — Instrução n.º 23/2023 do
// Banco de Portugal (BO n.º 9/2023, 2.º Suplemento, 9 October 2023), which
// revoked Instrução n.º 3/2018.
//
// The 2018 instrument used a flat 3 p.p., set when ECB reference rates were
// near zero. The 2023 revision cut the shock roughly in half and made it
// depend on the contract's term — the values below.
//
// Kept separate from BDP_2026 because it is a separate legal instrument on
// its own revision cycle: Recomendação 1/2026 art. 6.º n.º 2 points at it
// rather than restating the numbers, so a future re-issue of either one is a
// change to exactly one dataset.

import type { InterestRateShock } from "../types.js";

export const INTEREST_RATE_SHOCK_2023: InterestRateShock = {
  effectiveFrom: "2023-10-16",

  /**
   * Art. 1.º, for a variable-rate contract: consider the impact of an
   * increase in the indexante of at least
   *
   *   a) "0,5 pontos percentuais, se o contrato de crédito tiver prazo igual
   *      ou inferior a 5 anos";
   *   b) "1 ponto percentual, se o contrato de crédito tiver prazo superior a
   *      5 anos e igual ou inferior a 10 anos";
   *   c) "1,5 pontos percentuais, se o contrato de crédito tiver prazo
   *      superior a 10 anos."
   *
   * Bands are ordered ascending; `upToYears: null` is the open-ended top one.
   * The bound is inclusive ("igual ou inferior a"), so a 10-year contract
   * takes 1 p.p., not 1,5.
   */
  bands: [
    { upToYears: 5, shock: 0.005 },
    { upToYears: 10, shock: 0.01 },
    { upToYears: null, shock: 0.015 },
  ],

  /**
   * Art. 1.º n.º 4: the indexante itself is the simple arithmetic mean of
   * the daily quotes in the month before the assessment — which is why the
   * Euribor feed must expose a monthly average, not a spot rate.
   */
  indexAveragingMonths: 1,

  source:
    "Instrução n.º 23/2023 do Banco de Portugal, BO n.º 9/2023 2.º Suplemento " +
    "(https://www.bportugal.pt/instrucao/232023)",
  verified: false,
};
