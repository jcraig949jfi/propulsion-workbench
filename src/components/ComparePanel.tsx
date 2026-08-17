/**
 * Propeller comparison and diameter/pitch sweeps (spec §10, §11) — the heart of the MVP.
 *
 * Motor and battery are held fixed; only the propeller varies. Every row is produced by calling
 * `calculatePropulsion`, the same function the single-point readout uses.
 */
import { useMemo, useState, type ReactElement } from 'react';
import type { Battery, Motor, Propeller } from '../model/types';
import { calculatePropulsion } from '../model/calculatePropulsion';
import { availableDiameters, availablePitches } from '../data/hardware';
import { fmt, fmtInt } from '../units/units';
import { Chart } from './Chart';

type Metric = 'rpm' | 'thrust' | 'current' | 'power';

const METRIC_LABEL: Record<Metric, string> = {
  rpm: 'RPM',
  thrust: 'Static thrust (kg)',
  current: 'Current (A)',
  power: 'Input power (W)',
};

interface Props {
  motor: Motor;
  battery: Battery;
  propellers: Propeller[];
  selected: Propeller;
  airDensityKgM3: number;
  useFullyChargedVoltage: boolean;
  onSelect: (p: Propeller) => void;
}

export function ComparePanel({
  motor,
  battery,
  propellers,
  selected,
  airDensityKgM3,
  useFullyChargedVoltage,
  onSelect,
}: Props): ReactElement {
  const [metric, setMetric] = useState<Metric>('thrust');
  const [sweep, setSweep] = useState<'all' | 'diameter' | 'pitch'>('diameter');

  const pool = useMemo(() => {
    if (sweep === 'diameter') {
      // Vary diameter at the selected pitch (or nearest available at each diameter).
      return availableDiameters(propellers)
        .map((d) => {
          const atD = propellers.filter((p) => p.diameterIn === d);
          return atD.reduce((best, p) =>
            Math.abs(p.pitchIn - selected.pitchIn) < Math.abs(best.pitchIn - selected.pitchIn)
              ? p
              : best,
          );
        })
        .filter(Boolean);
    }
    if (sweep === 'pitch') {
      return propellers
        .filter((p) => p.diameterIn === selected.diameterIn)
        .sort((a, b) => a.pitchIn - b.pitchIn);
    }
    return [...propellers].sort(
      (a, b) => a.diameterIn - b.diameterIn || a.pitchIn - b.pitchIn,
    );
  }, [propellers, sweep, selected.diameterIn, selected.pitchIn]);

  const rows = useMemo(
    () =>
      pool.map((p) => ({
        prop: p,
        result: calculatePropulsion({
          motor,
          battery,
          propeller: p,
          airDensityKgM3,
          useFullyChargedVoltage,
        }),
      })),
    [pool, motor, battery, airDensityKgM3, useFullyChargedVoltage],
  );

  const metricValue = (r: (typeof rows)[number]): number => {
    switch (metric) {
      case 'rpm':
        return r.result.rpm;
      case 'thrust':
        return r.result.thrustKgF ?? Number.NaN;
      case 'current':
        return r.result.currentA ?? Number.NaN;
      case 'power':
        return r.result.inputPowerW ?? Number.NaN;
    }
  };

  const points = rows.map((r) => ({
    label: `${r.prop.diameterIn}×${r.prop.pitchIn}`,
    value: metricValue(r),
    flagged: r.result.warnings.some((w) => w.severity === 'ERROR'),
  }));

  return (
    <section className="panel">
      <h2>Compare propellers</h2>
      <p className="subject">
        {motor.manufacturer} {motor.model} · {battery.name} — motor and battery held fixed
      </p>

      <div className="controls-row">
        <label>
          Sweep
          <select value={sweep} onChange={(e) => setSweep(e.target.value as typeof sweep)}>
            <option value="diameter">diameter (at ≈{selected.pitchIn}″ pitch)</option>
            <option value="pitch">pitch (at {selected.diameterIn}″ diameter)</option>
            <option value="all">whole catalogue</option>
          </select>
        </label>
        <label>
          Plot
          <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
            {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
              <option key={m} value={m}>
                {METRIC_LABEL[m]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Chart points={points} yLabel={METRIC_LABEL[metric]} kind={sweep === 'all' ? 'bar' : 'line'} />

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Prop</th>
              <th>RPM</th>
              <th>Thrust</th>
              <th>Current</th>
              <th>Power</th>
              <th>N/W</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ prop, result }) => {
              const bad = result.warnings.some((w) => w.severity === 'ERROR');
              return (
                <tr
                  key={prop.id}
                  className={
                    (prop.id === selected.id ? 'selected-row ' : '') + (bad ? 'error-row' : '')
                  }
                >
                  <td>
                    {prop.diameterIn}×{prop.pitchIn}
                    {prop.bladeCount && prop.bladeCount !== 2 ? ` (${prop.bladeCount}B)` : ''}
                  </td>
                  <td>{fmtInt(result.rpm)}</td>
                  <td>{fmt(result.thrustKgF)} kg</td>
                  <td>{fmt(result.currentA, 1)} A</td>
                  <td>{fmtInt(result.inputPowerW)} W</td>
                  <td>{fmt(result.staticThrustPerInputWattNPerW, 4)}</td>
                  <td>
                    {prop.id === selected.id ? (
                      <span className="muted">current</span>
                    ) : (
                      <button className="link-btn" onClick={() => onSelect(prop)}>
                        select
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="footnote">
        Rows highlighted in red exceed a rated limit. Every row is the same{' '}
        <code>calculatePropulsion()</code> call as the main readout, so if the model is
        uncalibrated these comparisons inherit that — relative ordering between similar props is
        more trustworthy than the absolute figures.
      </p>
    </section>
  );
}

export { availablePitches };
