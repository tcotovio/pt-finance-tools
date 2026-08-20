// Where one value sits in a published distribution.
//
// The form follows the job: this is not change-over-time, so it is not a line;
// it is one value against a range, so it is a strip with the published
// percentiles marked and a "you are here" pointer. The p25–p75 box is drawn
// only when the series publishes those quartiles — a missing percentile stays
// missing rather than being interpolated into a box that looks measured.
//
// Colour carries nothing here: the strip is a neutral surface and the marker
// is the accent. Every number on it is also written out beneath, so the
// reading never depends on judging a position by eye.

import type { Percentiles } from "@pt-finance-tools/engine";
import { markerOffset, positionIn } from "../lib/market-position.js";

interface DistributionStripProps {
  caption: string;
  percentiles: Percentiles;
  /** The user's own value, placed on the strip. */
  value: number;
  format: (value: number) => string;
  /** What one contract in this distribution is, for the summary sentence. */
  subject: string;
  /** Provenance, rendered small beneath. */
  source: string;
}

export function DistributionStrip({
  caption,
  percentiles,
  value,
  format,
  subject,
  source,
}: DistributionStripProps) {
  const position = positionIn(value, percentiles);
  const offset = markerOffset(value, percentiles);
  const share = Math.round(position.percentile * 100);

  const boxStart =
    percentiles.p25 !== undefined
      ? markerOffset(percentiles.p25, percentiles)
      : undefined;
  const boxEnd =
    percentiles.p75 !== undefined
      ? markerOffset(percentiles.p75, percentiles)
      : undefined;
  const medianAt = markerOffset(percentiles.median, percentiles);

  const sentence = position.beyondPublished
    ? position.tail === "above"
      ? `Acima dos 90 % — ${format(percentiles.p90)} é o percentil 90.`
      : `Abaixo dos 10 % — ${format(percentiles.p10)} é o percentil 10.`
    : `Cerca de ${share} % ${subject} ficam abaixo deste valor.`;

  return (
    <figure className="distribution">
      <figcaption className="distribution-caption">{caption}</figcaption>

      <div
        className="distribution-track"
        role="img"
        aria-label={`${caption}. ${sentence} Percentil 10: ${format(
          percentiles.p10,
        )}; mediana: ${format(percentiles.median)}; percentil 90: ${format(
          percentiles.p90,
        )}. O seu valor: ${format(value)}.`}
      >
        {boxStart !== undefined && boxEnd !== undefined ? (
          <div
            className="distribution-box"
            style={{
              insetInlineStart: `${boxStart * 100}%`,
              inlineSize: `${(boxEnd - boxStart) * 100}%`,
            }}
          />
        ) : null}
        <div
          className="distribution-median"
          style={{ insetInlineStart: `${medianAt * 100}%` }}
        />
        <div
          className="distribution-marker"
          style={{ insetInlineStart: `${offset * 100}%` }}
        >
          <span className="distribution-marker-dot" />
        </div>
      </div>

      <div className="distribution-scale">
        <span>{format(percentiles.p10)}</span>
        <span className="distribution-scale-mid">
          mediana {format(percentiles.median)}
        </span>
        <span>{format(percentiles.p90)}</span>
      </div>

      <p className="distribution-reading">
        <strong className="num">{format(value)}</strong> — {sentence}
      </p>
      <p className="distribution-source">{source}</p>
    </figure>
  );
}
