/**
 * Explore panel (v2) — range sweeps with configurable axes.
 *
 * The v1 Compare tab answered "how do these props rank?" by stepping one variable at a time.
 * This one lets both vary: choose a diameter WINDOW and a pitch WINDOW, and every real
 * catalogue prop inside becomes a point. Then choose what goes on each axis.
 *
 * Everything numeric comes from `sweep()` in the model layer; this file only arranges controls.
 */
import { useMemo, useState, type ReactElement } from 'react';
import type { Battery, Motor, Propeller } from '../model/types';
import {
  METRICS,
  METRIC_KEYS,
  clampRange,
  groupSeries,
  sweep,
  type MetricKey,
  type Range,
  type SeriesBy,
} from '../model/sweep';
import { availableDiameters, availablePitches } from '../data/hardware';
import { RangeControl } from './RangeControl';
import { XYChart } from './XYChart';
import { fmt } from '../units/units';

interface Props {
  motor: Motor;
  battery: Battery;
  propellers: Propeller[];
  airDensityKgM3: number;
  useFullyChargedVoltage: boolean;
  onSelect: (p: Propeller) => void;
  selectedId: string;
}

export function ExplorePanel({
  motor,
  battery,
  propellers,
  airDensityKgM3,
  useFullyChargedVoltage,
  onSelect,
  selectedId,
}: Props): ReactElement {
  const diameters = availableDiameters(propellers);
  const pitches = availablePitches(propellers);

  const [diameter, setDiameter] = useState<Range>(() => ({
    min: diameters[0] ?? 10,
    max: diameters[Math.min(4, diameters.length - 1)] ?? 14,
  }));
  const [pitch, setPitch] = useState<Range>(() => ({
    min: pitches[0] ?? 5,
    max: pitches[pitches.length - 1] ?? 12,
  }));

  const [xKey, setXKey] = useState<MetricKey>('pitch');
  const [yKey, setYKey] = useState<MetricKey>('thrustKgF');
  const [y2Key, setY2Key] = useState<MetricKey | 'none'>('currentA');
  const [seriesBy, setSeriesBy] = useState<SeriesBy>('diameter');

  const points = useMemo(
    () =>
      sweep({
        motor,
        battery,
        propellers,
        diameter: clampRange(diameters, diameter),
        pitch: clampRange(pitches, pitch),
        airDensityKgM3,
        useFullyChargedVoltage,
      }),
    [motor, battery, propellers, diameter, pitch, airDensityKgM3, useFullyChargedVoltage, diameters, pitches],
  );

  const series = useMemo(() => groupSeries(points, seriesBy, xKey), [points, seriesBy, xKey]);

  const overLimit = points.filter((p) => p.overLimit).length;
  const best = useMemo(() => {
    const usable = points.filter((p) => !p.overLimit && Number.isFinite(p.result.thrustN ?? NaN));
    if (usable.length === 0) return undefined;
    return usable.reduce((a, b) =>
      (b.result.staticThrustPerInputWattNPerW ?? 0) > (a.result.staticThrustPerInputWattNPerW ?? 0)
        ? b
        : a,
    );
  }, [points]);

  const metricOption = (k: MetricKey) => (
    <option key={k} value={k}>
      {METRICS[k].label}
      {METRICS[k].unit ? ` (${METRICS[k].unit})` : ''}
    </option>
  );

  return (
    <section className="panel">
      <h2>Explore a range</h2>
      <p className="subject">
        {motor.manufacturer} {motor.model} · {battery.name} — motor and battery fixed, propeller
        family swept
      </p>

      <div className="explore-ranges">
        <RangeControl
          label="Diameter"
          unit="″"
          values={diameters}
          range={diameter}
          onChange={setDiameter}
        />
        <RangeControl label="Pitch" unit="″" values={pitches} range={pitch} onChange={setPitch} />
      </div>

      <p className="footnote">
        <strong>{points.length}</strong> real propeller{points.length === 1 ? '' : 's'} in this
        window
        {overLimit > 0 && (
          <>
            {' '}
            · <span className="warn-text">{overLimit} exceed a rating</span> (marked red)
          </>
        )}
        {best && (
          <>
            {' '}
            · most thrust per watt within limits:{' '}
            <strong>
              {best.propeller.diameterIn}×{best.propeller.pitchIn}
            </strong>{' '}
            at {fmt(best.result.staticThrustPerInputWattNPerW, 4)} N/W
          </>
        )}
      </p>

      <div className="controls-row axis-controls">
        <label>
          X axis
          <select value={xKey} onChange={(e) => setXKey(e.target.value as MetricKey)}>
            {METRIC_KEYS.map(metricOption)}
          </select>
        </label>
        <label>
          Y axis (left)
          <select value={yKey} onChange={(e) => setYKey(e.target.value as MetricKey)}>
            {METRIC_KEYS.map(metricOption)}
          </select>
        </label>
        <label>
          Y axis (right)
          <select
            value={y2Key}
            onChange={(e) => setY2Key(e.target.value as MetricKey | 'none')}
          >
            <option value="none">none</option>
            {METRIC_KEYS.map(metricOption)}
          </select>
        </label>
        <label>
          One line per
          <select value={seriesBy} onChange={(e) => setSeriesBy(e.target.value as SeriesBy)}>
            <option value="diameter">diameter</option>
            <option value="pitch">pitch</option>
            <option value="none">nothing (single series)</option>
          </select>
        </label>
      </div>

      <XYChart series={series} xKey={xKey} yKey={yKey} y2Key={y2Key} />

      <p className="footnote">
        Both axes are yours to choose, and the right-hand axis plots a second quantity on its own
        scale (dashed) so you can read, say, thrust and current together instead of flipping
        between them. Splitting into one line per diameter is how a two-variable sweep gets shown
        honestly on a flat chart — each line holds diameter fixed while pitch varies along it.
      </p>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Prop</th>
              <th>RPM</th>
              <th>Thrust</th>
              <th>Current</th>
              <th className="col-optional">Power</th>
              <th className="col-optional">N/W</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {points.map(({ propeller, result, overLimit: bad }) => (
              <tr
                key={propeller.id}
                className={
                  (propeller.id === selectedId ? 'selected-row ' : '') + (bad ? 'error-row' : '')
                }
              >
                <td>
                  {propeller.diameterIn}×{propeller.pitchIn}
                </td>
                <td>{fmt(result.rpm, 0)}</td>
                <td>{fmt(result.thrustKgF)} kg</td>
                <td>{fmt(result.currentA, 1)} A</td>
                <td className="col-optional">{fmt(result.inputPowerW, 0)} W</td>
                <td className="col-optional">{fmt(result.staticThrustPerInputWattNPerW, 4)}</td>
                <td>
                  {propeller.id === selectedId ? (
                    <span className="muted">current</span>
                  ) : (
                    <button className="link-btn" onClick={() => onSelect(propeller)}>
                      select
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
