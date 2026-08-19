// Where the month's gross actually goes: kept, IRS, Segurança Social.
//
// A part-to-whole with three slices and long Portuguese labels, so this is a
// horizontal stacked bar rather than a pie — shares are read against a shared
// baseline instead of by comparing angles, the labels sit beside their
// swatches, and it survives a phone-width column.
//
// The slices are the *actual* amounts (IRS net of any IRS Jovem relief), so
// they always sum to the gross. The colours are the validated categorical
// slots 1–3; identity never rests on colour alone — every slice is named and
// valued in the legend, and repeated in the table below.

import type { BreakdownSlice } from "../lib/breakdown.js";
import { formatEuro, formatPercent } from "../lib/format.js";

interface GrossSplitChartProps {
  split: BreakdownSlice[];
  gross: number;
}

/**
 * Only the headline slice carries a label inside the bar, and only when it is
 * wide enough to hold one at phone width. Labelling every slice either
 * crowds the narrow ones or crops them; the legend below carries the value
 * and share for all three, so nothing is gated behind the bar's geometry.
 */
const INLINE_LABEL_MIN_SHARE = 0.15;

export function GrossSplitChart({ split, gross }: GrossSplitChartProps) {
  const slices = split.filter((slice) => slice.amount > 0);
  if (gross <= 0 || slices.length === 0) return null;

  const description = slices
    .map(
      (slice) =>
        `${slice.label}: ${formatEuro(slice.amount)}, ${formatPercent(slice.share)}`,
    )
    .join("; ");

  return (
    <figure className="split-chart">
      <figcaption className="split-chart-caption">
        Destino dos {formatEuro(gross)} pagos
      </figcaption>

      <div
        className="split-bar"
        role="img"
        aria-label={`Repartição do valor pago. ${description}.`}
      >
        {slices.map((slice) => (
          <div
            key={slice.key}
            className={`split-segment is-${slice.key}`}
            style={{ flexGrow: slice.share }}
            title={`${slice.label}: ${formatEuro(slice.amount)} (${formatPercent(slice.share)})`}
          >
            {slice.key === "net" && slice.share >= INLINE_LABEL_MIN_SHARE ? (
              <span className="split-segment-value num">
                {formatPercent(slice.share)}
              </span>
            ) : null}
          </div>
        ))}
      </div>

      <ul className="split-legend">
        {slices.map((slice) => (
          <li key={slice.key}>
            <span
              className={`split-swatch is-${slice.key}`}
              aria-hidden="true"
            />
            <span className="split-legend-label">{slice.label}</span>
            <span className="split-legend-value num">
              {formatEuro(slice.amount)}
            </span>
            <span className="split-legend-share num">
              {formatPercent(slice.share)}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
