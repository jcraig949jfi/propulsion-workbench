/**
 * Configurable XY chart (v2) — the "pick your own axes" chart.
 *
 * v1's chart was locked to one arrangement: propeller configuration on X, one metric on Y.
 * This one takes X, Y and an optional SECOND Y from the caller, plus a series-grouping key.
 * That covers what was actually being asked for:
 *
 *   - "let me choose what's on an axis"  -> xKey / yKey are just metric keys
 *   - "even multiple axes"               -> y2Key draws a second series against its own
 *                                           right-hand scale, so thrust and current can be read
 *                                           together instead of toggled between
 *   - two things varying at once         -> seriesBy splits the family into one line per
 *                                           diameter (or per pitch), which is how a 2-D sweep
 *                                           gets shown on a 2-D chart honestly
 *
 * Deliberately still dependency-free SVG. No physics here; it plots what it is handed.
 */
import type { ReactElement } from 'react';
import { METRICS, type MetricKey, type Series, type SweepPoint } from '../model/sweep';

const SERIES_COLOURS = [
  'var(--accent)',
  '#e06c2b',
  '#12866f',
  '#8a4fd3',
  '#b5182b',
  '#6b7a1f',
  '#0f7fb5',
  '#c2166b',
];

interface Props {
  series: Series[];
  xKey: MetricKey;
  yKey: MetricKey;
  y2Key?: MetricKey | 'none';
  height?: number;
  markOverLimit?: boolean;
}

interface Scale {
  min: number;
  max: number;
  to: (v: number) => number;
}

function makeScale(values: number[], lo: number, hi: number, invert = false): Scale {
  const finite = values.filter(Number.isFinite);
  let min = finite.length ? Math.min(...finite) : 0;
  let max = finite.length ? Math.max(...finite) : 1;
  if (min === max) {
    // A flat series would otherwise divide by zero; give it a visible band instead.
    const pad = Math.abs(min) * 0.05 || 1;
    min -= pad;
    max += pad;
  }
  return {
    min,
    max,
    to: (v: number) => {
      const t = (v - min) / (max - min);
      return invert ? hi - t * (hi - lo) : lo + t * (hi - lo);
    },
  };
}

function ticks(scale: Scale, n = 4): number[] {
  return Array.from({ length: n + 1 }, (_, i) => scale.min + ((scale.max - scale.min) * i) / n);
}

function fmtTick(v: number, digits: number): string {
  if (Math.abs(v) >= 1000) return Math.round(v).toLocaleString();
  return v.toFixed(digits);
}

export function XYChart({
  series,
  xKey,
  yKey,
  y2Key = 'none',
  height = 300,
  markOverLimit = true,
}: Props): ReactElement {
  const xM = METRICS[xKey];
  const yM = METRICS[yKey];
  const y2M = y2Key !== 'none' ? METRICS[y2Key] : undefined;

  const all = series.flatMap((s) => s.points);
  const xs = all.map((p) => xM.get(p)).filter((v): v is number => Number.isFinite(v));
  const ys = all.map((p) => yM.get(p)).filter((v): v is number => Number.isFinite(v));
  const y2s = y2M ? all.map((p) => y2M.get(p)).filter((v): v is number => Number.isFinite(v)) : [];

  if (xs.length === 0 || ys.length === 0) {
    return <p className="muted">Nothing plottable in this range — widen it, or check warnings.</p>;
  }

  const padL = 58;
  const padR = y2M ? 58 : 16;
  const padT = 14;
  const padB = 46;
  const width = Math.max(340, Math.min(880, all.length * 26 + padL + padR));

  const xScale = makeScale(xs, padL, width - padR);
  // When both Y metrics share a unit (volts vs volts), they MUST share one scale — otherwise
  // two independently auto-scaled axes draw a flat 11.1 V reference visually below a 11.05 V
  // sag line and the comparison lies. Different units keep independent scales as before.
  const sameUnit = y2M !== undefined && y2M.unit === yM.unit && y2M.unit !== '';
  const yScale = makeScale(sameUnit ? [...ys, ...y2s] : ys, padT, height - padB, true);
  const y2Scale = y2M ? (sameUnit ? yScale : makeScale(y2s, padT, height - padB, true)) : undefined;

  const path = (pts: SweepPoint[], get: (p: SweepPoint) => number | undefined, sc: Scale) =>
    pts
      .map((p) => ({ x: xM.get(p), y: get(p) }))
      .filter((d) => Number.isFinite(d.x) && Number.isFinite(d.y))
      .map((d, i) => (i === 0 ? 'M' : 'L') + xScale.to(d.x as number) + ',' + sc.to(d.y as number))
      .join(' ');

  return (
    <div className="chart-scroll">
      <svg
        viewBox={'0 0 ' + width + ' ' + height}
        className="chart"
        style={{ minWidth: width }}
        role="img"
        aria-label={yM.label + ' against ' + xM.label}
      >
        {ticks(yScale).map((t) => (
          <g key={'y' + t}>
            <line
              x1={padL}
              x2={width - padR}
              y1={yScale.to(t)}
              y2={yScale.to(t)}
              className="chart-grid"
            />
            <text x={padL - 6} y={yScale.to(t) + 4} className="chart-tick" textAnchor="end">
              {fmtTick(t, yM.digits)}
            </text>
          </g>
        ))}
        <text x={4} y={padT - 2} className="chart-axis-label">
          {yM.label}
          {yM.unit ? ' (' + yM.unit + ')' : ''}
        </text>

        {y2M && y2Scale ? (
          <>
            {ticks(y2Scale).map((t) => (
              <text
                key={'y2' + t}
                x={width - padR + 6}
                y={y2Scale.to(t) + 4}
                className="chart-tick chart-tick-alt"
              >
                {fmtTick(t, y2M.digits)}
              </text>
            ))}
            <text x={width - padR + 2} y={padT - 2} className="chart-axis-label chart-tick-alt">
              {y2M.label}
              {y2M.unit ? ' (' + y2M.unit + ')' : ''}
            </text>
          </>
        ) : null}

        {ticks(xScale, 4).map((t) => (
          <text
            key={'x' + t}
            x={xScale.to(t)}
            y={height - padB + 18}
            className="chart-tick"
            textAnchor="middle"
          >
            {fmtTick(t, xM.digits)}
          </text>
        ))}
        <text
          x={(padL + width - padR) / 2}
          y={height - 6}
          className="chart-axis-label"
          textAnchor="middle"
        >
          {xM.label}
          {xM.unit ? ' (' + xM.unit + ')' : ''}
        </text>

        {series.map((s, si) => {
          const colour = SERIES_COLOURS[si % SERIES_COLOURS.length];
          return (
            <g key={s.label}>
              <path d={path(s.points, yM.get, yScale)} fill="none" stroke={colour} strokeWidth={2} />
              {y2M && y2Scale ? (
                <path
                  d={path(s.points, y2M.get, y2Scale)}
                  fill="none"
                  stroke={colour}
                  strokeWidth={1.6}
                  strokeDasharray="5 4"
                />
              ) : null}
              {s.points.map((p, i) => {
                const x = xM.get(p);
                const y = yM.get(p);
                if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
                const bad = markOverLimit && p.overLimit;
                return (
                  <circle
                    key={i}
                    cx={xScale.to(x as number)}
                    cy={yScale.to(y as number)}
                    r={bad ? 5 : 3.5}
                    fill={bad ? 'var(--error)' : colour}
                  >
                    <title>
                      {p.propeller.diameterIn +
                        '×' +
                        p.propeller.pitchIn +
                        '  ' +
                        xM.label +
                        ' ' +
                        (x as number).toFixed(xM.digits) +
                        xM.unit +
                        '  ' +
                        yM.label +
                        ' ' +
                        (y as number).toFixed(yM.digits) +
                        yM.unit +
                        (bad ? '  — exceeds a rating' : '')}
                    </title>
                  </circle>
                );
              })}
            </g>
          );
        })}
      </svg>

      {series.length > 1 || y2M ? (
        <div className="chart-legend">
          {series.length > 1
            ? series.map((s, si) => (
                <span key={s.label} className="legend-item">
                  <i style={{ background: SERIES_COLOURS[si % SERIES_COLOURS.length] }} />
                  {s.label}
                </span>
              ))
            : null}
          {y2M ? (
            <span className="legend-item legend-dashed">
              <i /> dashed = {y2M.label} (right axis)
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
