/**
 * Bench-test recording, prediction-error table and test history (spec §12, §13, §14).
 *
 * The error arithmetic comes from the model layer (`predictionError`), not from here.
 */
import { useMemo, useState, type ReactElement } from 'react';
import type { BenchTest, Battery, ErrorRow, Motor, Propeller, PropulsionResult } from '../model/types';
import { predictionError } from '../model/calculatePropulsion';
import { fmt, kgfToNewtons } from '../units/units';
import { Chart } from './Chart';

export function errorRows(predicted: PropulsionResult, measured: BenchTest['measured']): ErrorRow[] {
  const rows: Array<[string, number | undefined, number | undefined, string]> = [
    ['RPM', predicted.rpm, measured.rpm, 'rpm'],
    ['Thrust', predicted.thrustKgF, measured.thrustKgF, 'kg'],
    ['Current', predicted.currentA, measured.currentA, 'A'],
    ['Voltage', predicted.loadedVoltageV, measured.voltageV, 'V'],
  ];
  return rows.map(([metric, p, m, units]) => ({
    metric,
    predicted: p,
    measured: m,
    units,
    ...predictionError(p, m),
  }));
}

interface RecordProps {
  motor: Motor;
  battery: Battery;
  propeller: Propeller;
  predicted: PropulsionResult;
  onSave: (t: BenchTest) => void;
}

export function RecordTest({ motor, battery, propeller, predicted, onSave }: RecordProps): ReactElement {
  const [rpm, setRpm] = useState('');
  const [thrustKgf, setThrustKgf] = useState('');
  const [currentA, setCurrentA] = useState('');
  const [voltageV, setVoltageV] = useState('');
  const [notes, setNotes] = useState('');

  const num = (s: string): number | undefined => {
    const v = Number(s.trim());
    return s.trim() !== '' && Number.isFinite(v) ? v : undefined;
  };

  const measured = {
    rpm: num(rpm),
    thrustKgF: num(thrustKgf),
    thrustN: num(thrustKgf) !== undefined ? kgfToNewtons(num(thrustKgf)!) : undefined,
    currentA: num(currentA),
    voltageV: num(voltageV),
  };

  const anyMeasurement = Object.values(measured).some((v) => v !== undefined);
  const live = errorRows(predicted, measured);

  const save = () => {
    onSave({
      id: `bt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      motorId: motor.id,
      batteryId: battery.id,
      propellerId: propeller.id,
      predicted,
      measured,
      notes: notes.trim() || undefined,
    });
    setRpm('');
    setThrustKgf('');
    setCurrentA('');
    setVoltageV('');
    setNotes('');
  };

  return (
    <section className="panel">
      <h2>Record a bench test</h2>
      <p className="subject">
        {motor.manufacturer} {motor.model} · {battery.name} · {propeller.manufacturer}{' '}
        {propeller.model}
      </p>
      <div className="form-grid">
        <label>
          Measured RPM
          <input value={rpm} onChange={(e) => setRpm(e.target.value)} inputMode="decimal" />
        </label>
        <label>
          Measured thrust (kg)
          <input value={thrustKgf} onChange={(e) => setThrustKgf(e.target.value)} inputMode="decimal" />
        </label>
        <label>
          Measured current (A)
          <input value={currentA} onChange={(e) => setCurrentA(e.target.value)} inputMode="decimal" />
        </label>
        <label>
          Measured voltage (V)
          <input value={voltageV} onChange={(e) => setVoltageV(e.target.value)} inputMode="decimal" />
        </label>
        <label className="wide">
          Notes
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="pack state, temperature, tachometer used, anything odd"
          />
        </label>
      </div>

      {anyMeasurement && (
        <>
          <h3>Prediction vs measurement</h3>
          <ErrorTable rows={live} />
        </>
      )}

      <button className="primary-btn" onClick={save} disabled={!anyMeasurement}>
        Save test
      </button>
      {!anyMeasurement && <p className="muted">Enter at least one measurement to save.</p>}
    </section>
  );
}

export function ErrorTable({ rows }: { rows: ErrorRow[] }): ReactElement {
  const shown = rows.filter((r) => r.measured !== undefined);
  if (shown.length === 0) return <p className="muted">No measurements entered.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Metric</th>
            <th>Predicted</th>
            <th>Measured</th>
            <th>Error</th>
            <th>Error %</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.metric}>
              <td>{r.metric}</td>
              <td>
                {fmt(r.predicted, r.metric === 'RPM' ? 0 : 2)} {r.units}
              </td>
              <td>
                {fmt(r.measured, r.metric === 'RPM' ? 0 : 2)} {r.units}
              </td>
              <td>{fmt(r.absoluteError, r.metric === 'RPM' ? 0 : 2)}</td>
              <td className={(r.percentError ?? 0) >= 0 ? 'pos' : 'neg'}>
                {r.percentError === undefined
                  ? '—'
                  : `${r.percentError > 0 ? '+' : ''}${fmt(r.percentError, 1)} %`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="footnote">
        Error is predicted − measured, so a positive percentage means the model predicted high.
      </p>
    </div>
  );
}

interface HistoryProps {
  tests: BenchTest[];
  motors: Motor[];
  batteries: Battery[];
  propellers: Propeller[];
  onDelete: (id: string) => void;
}

export function TestHistory({ tests, motors, propellers, onDelete }: HistoryProps): ReactElement {
  const [filterMotor, setFilterMotor] = useState('');
  const [filterProp, setFilterProp] = useState('');

  const filtered = useMemo(
    () =>
      tests
        .filter((t) => !filterMotor || t.motorId === filterMotor)
        .filter((t) => !filterProp || t.propellerId === filterProp)
        .slice()
        .reverse(),
    [tests, filterMotor, filterProp],
  );

  const propName = (id: string) => {
    const p = propellers.find((x) => x.id === id);
    return p ? `${p.diameterIn}×${p.pitchIn}` : id;
  };

  const rpmErrorPoints = filtered
    .filter((t) => t.measured.rpm !== undefined && Number.isFinite(t.predicted.rpm))
    .map((t) => ({
      label: propName(t.propellerId),
      value: predictionError(t.predicted.rpm, t.measured.rpm).percentError ?? Number.NaN,
    }));

  return (
    <section className="panel">
      <h2>Test history ({tests.length})</h2>
      {tests.length === 0 ? (
        <p className="muted">
          No tests recorded yet. This log is what turns the calculator into an instrument — until
          it has entries, every prediction in this app is unvalidated.
        </p>
      ) : (
        <>
          <div className="form-grid">
            <label>
              Filter by motor
              <select value={filterMotor} onChange={(e) => setFilterMotor(e.target.value)}>
                <option value="">all</option>
                {motors.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.manufacturer} {m.model}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Filter by propeller
              <select value={filterProp} onChange={(e) => setFilterProp(e.target.value)}>
                <option value="">all</option>
                {propellers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.manufacturer} {p.model}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {rpmErrorPoints.length > 0 && (
            <>
              <h3>RPM prediction error by propeller</h3>
              <Chart points={rpmErrorPoints} yLabel="RPM error (%)" kind="bar" />
            </>
          )}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Prop</th>
                  <th>Pred. RPM</th>
                  <th>Meas. RPM</th>
                  <th>Pred. thrust</th>
                  <th>Meas. thrust</th>
                  <th>Pred. A</th>
                  <th>Meas. A</th>
                  <th>Notes</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id}>
                    <td>{new Date(t.timestamp).toLocaleDateString()}</td>
                    <td>{propName(t.propellerId)}</td>
                    <td>{fmt(t.predicted.rpm, 0)}</td>
                    <td>{fmt(t.measured.rpm, 0)}</td>
                    <td>{fmt(t.predicted.thrustKgF)}</td>
                    <td>{fmt(t.measured.thrustKgF)}</td>
                    <td>{fmt(t.predicted.currentA, 1)}</td>
                    <td>{fmt(t.measured.currentA, 1)}</td>
                    <td className="notes-cell">{t.notes ?? ''}</td>
                    <td>
                      <button className="link-btn" onClick={() => onDelete(t.id)}>
                        delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
