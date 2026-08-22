// What Portuguese workers are actually paid — the reference the wage result
// puts beside the user's own salary.
//
// Source: INE, "Estatísticas do Emprego — Remuneração bruta mensal média por
// trabalhador", 2.º trimestre de 2026, published 14 August 2026. Compiled from
// Segurança Social and CGA records covering 4,9 million jobs, so it is
// administrative data rather than a survey.
//
// WHICH FIGURE, AND WHY IT MATTERS. The release publishes three:
//
//   * total 1 835 € — everything paid in the month, including subsídios and
//     overtime;
//   * regular 1 436 € — the part paid every month;
//   * base 1 342 € — base salary alone.
//
// The calculator's headline input is "vencimento base mensal", so the BASE
// figure is the like-for-like comparison. Using the total would flatter every
// user by comparing their base salary against other people's base plus
// extras — and the total is seasonal besides, since the Christmas subsidy
// pushes the fourth quarter far above the rest (1 877 € in Q4 2025 against
// 1 611 € in Q1 2026).
//
// IT IS A MEAN, NOT A MEDIAN. High earners pull it upward, so more than half
// of workers earn less than this. The UI says so, because "below average"
// reads as "below the middle" to almost everyone, and here it is not the same
// thing. A true median would need a distribution INE does not publish
// quarterly — the four-yearly Structure of Earnings Survey has one, but its
// most recent wave is 2022 and using it in 2026 would misplace every user.

import type { WageMarket } from "../types.js";

export const WAGE_MARKET_2026_Q2: WageMarket = {
  period: "2026-Q2",
  /** Base salary alone — the comparator for this calculator's own input. */
  baseMean: 1342,
  /** The part paid every month, base plus regular supplements. */
  regularMean: 1436,
  /** Everything paid in the month, subsídios and overtime included. */
  totalMean: 1835,
  source:
    "INE, Estatísticas do Emprego — Remuneração bruta mensal média por " +
    "trabalhador, 2.º trimestre de 2026 " +
    "(https://www.ine.pt/xportal/xmain?xpid=INE&xpgid=ine_destaques&DESTAQUESdest_boui=771912798&DESTAQUESmodo=2)",
  retrievedAt: "2026-08-22",
};
