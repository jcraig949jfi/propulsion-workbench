/**
 * Minimal SVG chart. Hand-rolled rather than pulling in a plotting library: spec §11 asks for
 * something lightweight and explicitly says not to over-invest in visual design, and a
 * dependency-free chart keeps the GitHub Pages bundle small and the build reproducible.
 *
 * No physics here. It plots numbers it is handed.
 */
import type { ReactElement } from 'react';

export interface ChartPoint {
  label: string;
  value: number;
  flagged?: boolean;
}

interface Props {
  points: ChartPoint[];
  yLabel: string;
  kind?: 'bar' | 'line';
  height?: number;
}

export function Chart({ points, yLabel, kind = 'bar', height = 220 }: Props): ReactElement {
  const usable = points.filter((p) => Number.isFinite(p.value));
  if (usable.length === 0) {
    return <p className="muted">No plottable values — check the warnings above.</p>;
  }

  // Intrinsic width. Paired with `min-width` on the <svg> and an overflow-x wrapper, this gives
  // both behaviours from one number: on a wide screen the SVG scales up to fill the container,
  // and on a phone it keeps its intrinsic size and the container scrolls. Squeezing 30 props
  // into 360 px would render the labels at about two pixels tall.
  const perPoint = usable.length > 14 ? 44 : 56;
  const width = Math.max(300, usable.length * perPoint + 70);
  const padL = 62;
  const padB = 42;
  const padT = 12;
  const max = Math.max(...usable.map((p) => p.value));
  const min = Math.min(0, ...usable.map((p) => p.value));
  const span = max - min || 1;
  const plotH = height - padB - padT;
  const plotW = width - padL - 12;

  const x = (i: number) => padL + (plotW * (i + 0.5)) / usable.length;
  const y = (v: number) => padT + plotH * (1 - (v - min) / span);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => min + f * span);

  return (
    <div className="chart-scroll">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="chart"
        style={{ minWidth: width }}
        role="img"
        aria-label={yLabel}
      >
      <text x={6} y={padT + 4} className="chart-axis-label">
        {yLabel}
      </text>

      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={width - 12} y1={y(t)} y2={y(t)} className="chart-grid" />
          <text x={padL - 8} y={y(t) + 4} className="chart-tick" textAnchor="end">
            {t >= 1000 ? Math.round(t).toLocaleString() : t.toFixed(2)}
          </text>
        </g>
      ))}

      {kind === 'line' && (
        <polyline
          className="chart-line"
          points={usable.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')}
        />
      )}

      {usable.map((p, i) => {
        const barW = Math.min(34, plotW / usable.length - 8);
        return (
          <g key={`${p.label}-${i}`}>
            {kind === 'bar' ? (
              <rect
                x={x(i) - barW / 2}
                y={y(p.value)}
                width={barW}
                height={Math.max(1, y(min) - y(p.value))}
                className={p.flagged ? 'chart-bar flagged' : 'chart-bar'}
              />
            ) : (
              <circle cx={x(i)} cy={y(p.value)} r={3.5} className="chart-dot" />
            )}
            <text x={x(i)} y={height - padB + 16} className="chart-tick" textAnchor="middle">
              {p.label}
            </text>
          </g>
        );
      })}
      </svg>
    </div>
  );
}
