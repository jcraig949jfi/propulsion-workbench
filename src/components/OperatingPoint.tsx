/**
 * Operating-point readout and warning panel (spec §9).
 *
 * Consumes PropulsionResult. Contains no equations — the only arithmetic here is unit display,
 * and even that is delegated to src/units.
 */
import type { ReactElement } from 'react';
import type { PropulsionResult, Warning } from '../model/types';
import { fmt, fmtInt, newtonsToOuncesForce, newtonsToPoundsForce } from '../units/units';

export function Warnings({ warnings }: { warnings: Warning[] }): ReactElement | null {
  if (warnings.length === 0) return null;
  const order = { ERROR: 0, WARNING: 1, INFO: 2 } as const;
  const sorted = [...warnings].sort((a, b) => order[a.severity] - order[b.severity]);
  return (
    <div className="warnings">
      {sorted.map((w, i) => (
        <div key={`${w.code}-${i}`} className={`warning ${w.severity.toLowerCase()}`}>
          <span className="warning-code">{w.severity}</span>
          <span className="warning-body">
            <strong>{w.code.replace(/_/g, ' ')}</strong> — {w.message}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Compact sticky readout, shown on narrow screens only (CSS-gated).
 *
 * On a phone the controls and the numbers cannot both be on screen, and the whole point of the
 * app is watching the numbers move as the prop changes — so the three that matter get pinned to
 * the top of the viewport while everything else scrolls underneath.
 */
export function StickySummary({
  result,
  propeller,
}: {
  result: PropulsionResult;
  propeller: { diameterIn: number; pitchIn: number };
}): ReactElement {
  const solved = result.diagnostics.converged && Number.isFinite(result.rpm);
  const errors = result.warnings.filter((w) => w.severity === 'ERROR').length;
  return (
    <div className={`sticky-summary${errors ? ' has-error' : ''}`}>
      <span className="ss-prop">
        {propeller.diameterIn}×{propeller.pitchIn}
      </span>
      {solved ? (
        <>
          <span className="ss-item">
            <b>{fmtInt(result.rpm)}</b> rpm
          </span>
          <span className="ss-item">
            <b>{fmt(result.thrustKgF)}</b> kg
          </span>
          <span className="ss-item">
            <b>{fmt(result.currentA, 1)}</b> A
          </span>
          <span className="ss-item ss-hide-xs">
            <b>{fmtInt(result.inputPowerW)}</b> W
          </span>
        </>
      ) : (
        <span className="ss-item">no operating point — see warnings</span>
      )}
      {errors > 0 && (
        <span className="ss-flag" title={`${errors} limit exceeded`}>
          ⚠ {errors}
        </span>
      )}
    </div>
  );
}

interface Props {
  result: PropulsionResult;
  title: string;
}

export function OperatingPoint({ result, title }: Props): ReactElement {
  const solved = result.diagnostics.converged && Number.isFinite(result.rpm);

  return (
    <section className="panel">
      <h2>Predicted operating point</h2>
      <p className="subject">{title}</p>

      {!solved ? (
        <p className="no-result">
          No operating point reported. The solver did not produce a usable answer, so nothing is
          shown rather than a number that looks precise. See the warnings below.
        </p>
      ) : (
        <>
          <dl className="readout">
            <div className="primary">
              <dt>RPM</dt>
              <dd>{fmtInt(result.rpm)}</dd>
            </div>
            <div className="primary">
              <dt>Static thrust</dt>
              <dd>
                {fmt(result.thrustKgF)} kg
                <span className="alt">
                  {fmt(result.thrustN, 2)} N · {fmt(newtonsToPoundsForce(result.thrustN ?? NaN))} lb ·{' '}
                  {fmt(newtonsToOuncesForce(result.thrustN ?? NaN), 1)} oz
                </span>
              </dd>
            </div>
            <div className="primary">
              <dt>Current</dt>
              <dd>{fmt(result.currentA, 1)} A</dd>
            </div>
            <div className="primary">
              <dt>Input power</dt>
              <dd>{fmtInt(result.inputPowerW)} W</dd>
            </div>
            <div>
              <dt>Loaded voltage</dt>
              <dd>{fmt(result.loadedVoltageV)} V</dd>
            </div>
            <div>
              <dt>Prop torque</dt>
              <dd>{fmt(result.torqueNm, 4)} N·m</dd>
            </div>
            <div>
              <dt>Shaft power</dt>
              <dd>{fmtInt(result.mechanicalPowerW)} W</dd>
            </div>
            <div>
              <dt>Motor efficiency</dt>
              <dd>
                {result.motorEfficiency === undefined
                  ? '—'
                  : `${fmt(result.motorEfficiency * 100, 1)} %`}
              </dd>
            </div>
            <div>
              <dt>Thrust per input watt</dt>
              <dd>{fmt(result.staticThrustPerInputWattNPerW, 4)} N/W</dd>
            </div>
            <div>
              <dt>Thrust per shaft watt</dt>
              <dd>{fmt(result.staticThrustPerShaftWattNPerW, 4)} N/W</dd>
            </div>
          </dl>

          <p className="footnote">
            Propulsive efficiency is not shown, and that is physics rather than an omission: it is
            thrust × airspeed ÷ shaft power, which is exactly zero on a static bench. Use thrust
            per watt to compare props here.
            {result.coefficientsUsed && (
              <>
                {' '}
                Coefficients used: C<sub>T</sub> = {fmt(result.coefficientsUsed.ct, 4)}, C
                <sub>P</sub> = {fmt(result.coefficientsUsed.cp, 4)} (
                {result.coefficientsUsed.source === 'PROP_DATA'
                  ? 'measured/published prop data'
                  : 'placeholder pitch model'}
                ). Solver: {result.diagnostics.iterations} iterations.
              </>
            )}
          </p>
        </>
      )}

      <Warnings warnings={result.warnings} />
    </section>
  );
}
