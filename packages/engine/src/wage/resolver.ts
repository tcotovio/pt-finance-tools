// Selecting the right table and bracket from a versioned dataset.

import type {
  TaxpayerCategory,
  WithholdingBracket,
  WithholdingDataset,
  WithholdingTable,
} from "../types.js";

/** Find the table for a taxpayer category, or throw if the dataset lacks it. */
export function selectTable(
  dataset: WithholdingDataset,
  category: TaxpayerCategory,
): WithholdingTable {
  const table = dataset.tables.find((t) => t.category === category);
  if (!table) {
    throw new Error(
      `No withholding table for category "${category}" in ${dataset.region} ${dataset.year} dataset.`,
    );
  }
  return table;
}

/**
 * Find the bracket that applies to `grossMonthly`: the first bracket whose
 * `upTo` bound is >= the income, or the top (`upTo: null`) bracket.
 *
 * Assumes `table.brackets` is ordered by ascending `upTo` with the `null`
 * bracket last (as documented on {@link WithholdingTable}).
 */
export function selectBracket(
  table: WithholdingTable,
  grossMonthly: number,
): WithholdingBracket {
  for (const bracket of table.brackets) {
    if (bracket.upTo === null || grossMonthly <= bracket.upTo) {
      return bracket;
    }
  }
  throw new Error(
    `No bracket matched income ${grossMonthly} for category "${table.category}"; ` +
      `the table has no open-ended (upTo: null) top bracket.`,
  );
}
