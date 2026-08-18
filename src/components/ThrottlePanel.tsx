/**
 * Throttle-response panel (Mark's ask, 2026-08-18).
 *
 * The Explore tab holds voltage fixed and sweeps the propeller family. This does the opposite:
 * holds motor, battery and the SELECTED propeller fixed, and sweeps the average motor voltage
 * from low stick to the full pack voltage. An ESC's PWM throttle sets that average voltage, so
 * the X axis reads directly as throttle position.
 *
 * Same approximation as the pack-voltage slider (MODEL.md §2): it ignores ESC switching losses
 * and low-duty non-linearity. The shape is right; the last few percent near the bottom of the
 * stick are the least trustworthy part of the curve.
 */
import { useMemo, useState, type ReactElement } from 'react';
import type { Battery, Motor, Propeller } from '../model/types';
import {
  METRICS,
  METRIC_KEYS,
  voltageSweep,
  type MetricKey,
} from '../model/sweep';
import { XYChart } from './XYChart';
import { fmt, fmtInt } from '../units/units';

interface Props {
  motor: Motor;
  battery: Battery;
  propeller: Propeller;
  airDensityKgM3: number;
  /** Full-throttle pack voltage — the top of the sweep (the sidebar slider's setting). */
  packVoltageV: number;
}

export function ThrottlePanel({
  motor,
  battery,
  propeller,
  airDensityKgM3,
  packVoltageV,
}: Props): ReactElement {
  const [xKey, setXKey] = useState<MetricKey>('throttlePct');
  const [yKey, setYKey] = useState<MetricKey>('rpm');
  const [y2Key, setY2Key] = useState<MetricKey | 'none'>('thrustKgF');

  const points = useMemo(
    () =>
      voltageSweep({
        motor,
        battery,
        propeller,
        packVoltageMaxV: packVoltageV,
        airDensityKgM3,
        steps: 30,
      }),
    [motor, battery, propeller, packVoltageV, airDensityKgM3],
  );

  const series = useMemo(
    () => [{ label: `${propeller.diameterIn}×${propeller.pitchIn}`, points }],
    [points, propeller],
  );

  const top = points[points.length - 1];
  const firstSpin = points[0];

  const metricOption = (k: MetricKey) => (
    <option key={k} value={k}>
      {METRICS[k].label}
      {METRICS[k].unit ? ` (${METRICS[k].unit})` : ''}
    </option>
  );

  return (
    <section className="panel">
      <h2>Throttle response</h2>
      <p className="subject">
        {motor.manufacturer} {motor.model} · {battery.name} · {propeller.manufacturer}{' '}
        {propeller.diameterIn}×{propeller.pitchIn} — one propeller, voltage swept from low stick
        to {packVoltageV.toFixed(1)} V
      </p>

      {points.length === 0 ? (
        <p className="no-result">
          No operating point anywhere in this voltage range — check the motor's winding
          resistance is known, and the warnings on the main readout.
        </p>
      ) : (
        <>
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
              <select value={y2Key} onChange={(e) => setY2Key(e.target.value as MetricKey | 'none')}>
                <option value="none">none</option>
                {METRIC_KEYS.map(metricOption)}
              </select>
            </label>
          </div>

          <XYChart series={series} xKey={xKey} yKey={yKey} y2Key={y2Key} />

          {top && (
            <p className="footnote">
              Full throttle: <strong>{fmtInt(top.result.rpm)}</strong> rpm ·{' '}
              <strong>{fmt(top.result.thrustKgF)}</strong> kg ·{' '}
              <strong>{fmt(top.result.currentA, 1)}</strong> A ·{' '}
              <strong>{fmtInt(top.result.inputPowerW)}</strong> W
              {firstSpin && firstSpin.throttlePct! > 11 && (
                <>
                  {' '}
                  · below ≈{fmt(firstSpin.throttlePct, 0)}% throttle the prop does not turn (the
                  motor's no-load losses exceed what this voltage can supply) — the curve starts
                  where the prop starts.
                </>
              )}
            </p>
          )}

          <p className="footnote">
            The throttle axis is average motor voltage as a fraction of the pack: an ESC's PWM
            chops the supply, so half stick ≈ half voltage. This is the same approximation as
            the sidebar's pack-voltage slider, swept instead of set — it ignores ESC switching
            losses, so the bottom end of the curve is the least trustworthy part. Points that
            exceed a motor or battery rating are marked red; they live at the top of the curve,
            which is why full throttle on a fresh pack is where limits get found.
          </p>
        </>
      )}
    </section>
  );
}
