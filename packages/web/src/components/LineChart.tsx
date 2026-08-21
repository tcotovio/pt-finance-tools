// A two-or-three series line chart, in plain SVG.
//
// Both curves in this app answer a "how does X move as Y rises" question, so
// they share one component rather than two near-copies. Design decisions worth
// stating, because they are rules rather than taste:
//
//   * ONE axis. Every series in a given chart is in the same unit — rates with
//     rates, euros with euros — so there is never a second y-scale to mislead.
//   * Identity never rests on colour. Every chart carries a legend, and the
//     same numbers are reachable as a table underneath. That is also the
//     required relief for the third slot, whose contrast against the light
//     surface sits below 3:1.
//   * Hover is part of the chart, not an extra: a crosshair with a tooltip
//     reading every series at that x, because a line chart without one forces
//     the reader to eyeball values off a grid.
//   * The marks stay thin (2px), the grid recessive, and only the marker point
//     is labelled directly — never a number on every point.

import { useId, useMemo, useState } from "react";

export interface ChartSeries {
  /** Stable key; also picks the colour slot, in fixed order. */
  key: string;
  label: string;
  points: { x: number; y: number }[];
  /** Rendered dashed — for a counterfactual rather than a real quantity. */
  dashed?: boolean;
}

export interface LineChartProps {
  caption: string;
  series: ChartSeries[];
  formatX: (value: number) => string;
  formatY: (value: number) => string;
  /** A vertical rule with a label — "you are here". */
  marker?: { x: number; label: string };
  /** Axis descriptions, for the table view and the accessible summary. */
  xTitle: string;
  yTitle: string;
}

/**
 * Round an axis maximum up to a number a person would choose.
 *
 * Without this the top tick is whatever the data happened to reach —
 * "266 826 €" — which reads as a measurement rather than a scale. Ticks are
 * landmarks; they should be round.
 */
function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10].find((s) => normalized <= s) ?? 10;
  return step * magnitude;
}

const WIDTH = 560;
const HEIGHT = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 52 };

export function LineChart({
  caption,
  series,
  formatX,
  formatY,
  marker,
  xTitle,
  yTitle,
}: LineChartProps) {
  const id = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const geometry = useMemo(() => {
    const xs = series.flatMap((s) => s.points.map((p) => p.x));
    const ys = series.flatMap((s) => s.points.map((p) => p.y));
    if (xs.length === 0) return null;

    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    // Always anchor the value axis at zero: a truncated axis exaggerates every
    // slope on it, which is the oldest way to mislead with a line chart.
    const yMin = 0;
    // Rounded up so the top tick is a round number, and the marks never touch
    // the frame.
    const yMax = niceCeil(Math.max(...ys) || 1);

    const plotW = WIDTH - PAD.left - PAD.right;
    const plotH = HEIGHT - PAD.top - PAD.bottom;
    const toX = (x: number) =>
      PAD.left + (xMax === xMin ? 0 : ((x - xMin) / (xMax - xMin)) * plotW);
    const toY = (y: number) =>
      PAD.top + plotH - ((y - yMin) / (yMax - yMin)) * plotH;

    return { xMin, xMax, yMin, yMax, toX, toY, plotW, plotH };
  }, [series]);

  if (!geometry || series.length === 0) return null;

  const { toX, toY, yMax, xMin, xMax } = geometry;
  const longest = series.reduce((a, b) =>
    a.points.length >= b.points.length ? a : b,
  );
  const ticksY = [0, yMax / 2, yMax];
  const ticksX = [xMin, (xMin + xMax) / 2, xMax];

  const path = (s: ChartSeries) =>
    s.points
      .map((p, i) => `${i === 0 ? "M" : "L"}${toX(p.x)} ${toY(p.y)}`)
      .join(" ");

  const hovered = hoverIndex === null ? null : longest.points[hoverIndex];

  const onMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    // The SVG scales to its container, so map back through the viewBox.
    const svgX = ((event.clientX - rect.left) / rect.width) * WIDTH;
    let best = 0;
    let bestDistance = Infinity;
    longest.points.forEach((p, i) => {
      const distance = Math.abs(toX(p.x) - svgX);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    });
    setHoverIndex(best);
  };

  const summary = series
    .map((s) => {
      const last = s.points[s.points.length - 1];
      return `${s.label}: de ${formatY(s.points[0].y)} a ${formatY(last.y)}`;
    })
    .join("; ");

  return (
    <figure className="line-chart">
      <figcaption className="line-chart-caption">{caption}</figcaption>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="line-chart-svg"
        role="img"
        aria-label={`${caption}. ${xTitle} no eixo horizontal, ${yTitle} no vertical. ${summary}.`}
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {ticksY.map((value) => (
          <g key={value}>
            <line
              className="chart-grid"
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={toY(value)}
              y2={toY(value)}
            />
            <text className="chart-tick" x={PAD.left - 8} y={toY(value) + 4} textAnchor="end">
              {formatY(value)}
            </text>
          </g>
        ))}

        {ticksX.map((value) => (
          <text
            key={value}
            className="chart-tick"
            x={toX(value)}
            y={HEIGHT - 8}
            textAnchor="middle"
          >
            {formatX(value)}
          </text>
        ))}

        {marker ? (
          <g>
            <line
              className="chart-marker"
              x1={toX(marker.x)}
              x2={toX(marker.x)}
              y1={PAD.top}
              y2={HEIGHT - PAD.bottom}
            />
            <text
              className="chart-marker-label"
              x={toX(marker.x)}
              y={PAD.top - 4}
              textAnchor="middle"
            >
              {marker.label}
            </text>
          </g>
        ) : null}

        {series.map((s, index) => (
          <path
            key={s.key}
            className={`chart-line is-slot-${index + 1}${s.dashed ? " is-dashed" : ""}`}
            d={path(s)}
            fill="none"
          />
        ))}

        {hovered ? (
          <line
            className="chart-crosshair"
            x1={toX(hovered.x)}
            x2={toX(hovered.x)}
            y1={PAD.top}
            y2={HEIGHT - PAD.bottom}
          />
        ) : null}

        {hovered
          ? series.map((s, index) => {
              const point = s.points[hoverIndex!];
              if (!point) return null;
              return (
                <circle
                  key={s.key}
                  className={`chart-dot is-slot-${index + 1}`}
                  cx={toX(point.x)}
                  cy={toY(point.y)}
                  r={4}
                />
              );
            })
          : null}
      </svg>

      <ul className="chart-legend">
        {series.map((s, index) => (
          <li key={s.key}>
            <span
              className={`chart-swatch is-slot-${index + 1}${s.dashed ? " is-dashed" : ""}`}
              aria-hidden="true"
            />
            <span className="chart-legend-label">{s.label}</span>
            {hovered ? (
              <span className="chart-legend-value num">
                {formatY(s.points[hoverIndex!]?.y ?? 0)}
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      <p className="chart-hover-hint">
        {hovered
          ? `${xTitle}: ${formatX(hovered.x)}`
          : "Passe o rato sobre o gráfico para ver os valores."}
      </p>

      <details className="chart-table">
        <summary>Ver os números</summary>
        <div className="chart-table-scroll">
          <table id={`${id}-table`}>
            <thead>
              <tr>
                <th scope="col">{xTitle}</th>
                {series.map((s) => (
                  <th scope="col" key={s.key}>
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {longest.points.map((point, i) => (
                <tr key={point.x}>
                  <th scope="row" className="num">
                    {formatX(point.x)}
                  </th>
                  {series.map((s) => (
                    <td key={s.key} className="num">
                      {s.points[i] ? formatY(s.points[i].y) : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
