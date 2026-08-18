/**
 * Application shell (spec §22 layout). Holds selection state and workspace persistence; every
 * number displayed comes from `calculatePropulsion`. No physics in this file.
 */
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { calculatePropulsion } from './model/calculatePropulsion';
import { CONSTANTS } from './model/constants';
import { CELL_V_FULL, CELL_V_MIN, CELL_V_NOMINAL, voltsPerCell } from './model/battery';
import type { Battery, BenchTest, Motor, Propeller } from './model/types';
import {
  SEED_BATTERIES,
  SEED_MOTORS,
  SEED_PROPELLERS,
  availableDiameters,
  availablePitches,
  nearestRealPropeller,
} from './data/hardware';
import { generateDemoBenchTests, isDemoTest } from './data/demoBenchTests';
import {
  benchTestsToCsv,
  downloadFile,
  emptyWorkspace,
  loadWorkspace,
  parseWorkspace,
  saveWorkspace,
  serializeWorkspace,
} from './storage/persistence';
import { OperatingPoint, StickySummary } from './components/OperatingPoint';
import { ComparePanel } from './components/ComparePanel';
import { ExplorePanel } from './components/ExplorePanel';
import { RecordTest, TestHistory } from './components/BenchPanel';
import { HardwareEditor } from './components/HardwareEditor';
import { MotorPicker } from './components/MotorPicker';

type Tab = 'explore' | 'compare' | 'record' | 'history' | 'hardware' | 'model';

export default function App(): ReactElement {
  const stored = useMemo(() => loadWorkspace(), []);

  const [motors, setMotors] = useState<Motor[]>([...SEED_MOTORS, ...(stored?.motors ?? [])]);
  const [batteries, setBatteries] = useState<Battery[]>([
    ...SEED_BATTERIES,
    ...(stored?.batteries ?? []),
  ]);
  const [propellers, setPropellers] = useState<Propeller[]>([
    ...SEED_PROPELLERS,
    ...(stored?.propellers ?? []),
  ]);
  const [benchTests, setBenchTests] = useState<BenchTest[]>(stored?.benchTests ?? []);

  // Defaults chosen so the first screen shows a combination that sits inside its ratings — a
  // wall of red on load reads as "broken app" rather than "over-propped setup". Change any
  // selector to see the limit warnings do their job.
  const [motorId, setMotorId] = useState(
    motors.find((m) => m.id === 'axi-2826-10')?.id ?? motors[0].id,
  );
  const [batteryId, setBatteryId] = useState(
    batteries.find((b) => b.cells === 3 && b.capacityMah === 5000)?.id ?? batteries[0].id,
  );
  const [propId, setPropId] = useState(
    propellers.find((p) => p.diameterIn === 11 && p.pitchIn === 5.5)?.id ?? propellers[0].id,
  );
  const [airDensity, setAirDensity] = useState(CONSTANTS.airDensitySeaLevelIsa.value);
  // Pack open-circuit voltage. Held as volts-per-cell so it survives a change of pack size.
  const [cellV, setCellV] = useState(CELL_V_NOMINAL);
  const [tab, setTab] = useState<Tab>('explore');
  // On a phone the sidebar's secondary controls push the tabs a full screen down, so they
  // collapse behind a toggle. On a desktop the sidebar is a column with space to spare, so
  // everything stays open and the toggle is hidden by CSS.
  const [showMore, setShowMore] = useState(
    () => typeof window === 'undefined' || window.matchMedia('(min-width: 901px)').matches,
  );
  const [importMessage, setImportMessage] = useState<string>();

  const motor = motors.find((m) => m.id === motorId) ?? motors[0];
  const battery = batteries.find((b) => b.id === batteryId) ?? batteries[0];
  const propeller = propellers.find((p) => p.id === propId) ?? propellers[0];

  // Persist only user-created records and tests — seeds live in source control.
  useEffect(() => {
    const seedIds = new Set([
      ...SEED_MOTORS.map((m) => m.id),
      ...SEED_BATTERIES.map((b) => b.id),
      ...SEED_PROPELLERS.map((p) => p.id),
    ]);
    saveWorkspace({
      ...emptyWorkspace(),
      motors: motors.filter((m) => !seedIds.has(m.id)),
      batteries: batteries.filter((b) => !seedIds.has(b.id)),
      propellers: propellers.filter((p) => !seedIds.has(p.id)),
      benchTests,
    });
  }, [motors, batteries, propellers, benchTests]);

  const packV = cellV * battery.cells;

  const result = useMemo(
    () =>
      calculatePropulsion({
        motor,
        battery,
        propeller,
        airDensityKgM3: airDensity,
        packVoltageV: packV,
      }),
    [motor, battery, propeller, airDensity, packV],
  );

  const diameters = availableDiameters(propellers);
  const pitches = availablePitches(propellers, propeller.diameterIn);

  const selectByGeometry = (d: number, p: number) => {
    const found = nearestRealPropeller(propellers, d, p);
    if (found) setPropId(found.id);
  };

  const exportJson = () =>
    downloadFile(
      `propulsion-workspace-${new Date().toISOString().slice(0, 10)}.json`,
      serializeWorkspace({
        ...emptyWorkspace(),
        motors,
        batteries,
        propellers,
        benchTests,
      }),
      'application/json',
    );

  const exportCsv = () =>
    downloadFile(
      `bench-tests-${new Date().toISOString().slice(0, 10)}.csv`,
      benchTestsToCsv(benchTests),
      'text/csv',
    );

  const importJson = (file: File) => {
    void file.text().then((text) => {
      const { workspace, errors } = parseWorkspace(text);
      if (!workspace) {
        setImportMessage(`Import refused: ${errors.join('; ')}`);
        return;
      }
      const known = new Set(benchTests.map((t) => t.id));
      setMotors((prev) => dedupeById([...prev, ...workspace.motors]));
      setBatteries((prev) => dedupeById([...prev, ...workspace.batteries]));
      setPropellers((prev) => dedupeById([...prev, ...workspace.propellers]));
      setBenchTests((prev) => [...prev, ...workspace.benchTests.filter((t) => !known.has(t.id))]);
      setImportMessage(
        `Imported ${workspace.benchTests.length} tests, ${workspace.motors.length} motors, ` +
          `${workspace.batteries.length} batteries, ${workspace.propellers.length} props.`,
      );
    });
  };

  const unexported = benchTests.length > 0;
  const demoLoaded = benchTests.some(isDemoTest);

  const loadDemo = () => {
    const demoMotor = motors.find((m) => m.id === 'example-700kv-outrunner') ?? motors[0];
    const demoBattery =
      batteries.find((b) => b.cells === 4 && b.capacityMah === 5000) ?? batteries[0];
    const demoProps = propellers.filter(
      (p) => p.diameterIn >= 10 && p.diameterIn <= 13 && p.manufacturer === 'APC',
    );
    const generated = generateDemoBenchTests({
      motor: demoMotor,
      battery: demoBattery,
      propellers: demoProps,
    });
    const existing = new Set(benchTests.map((t) => t.id));
    setBenchTests((prev) => [...prev, ...generated.filter((t) => !existing.has(t.id))]);
    setMotorId(demoMotor.id);
    setBatteryId(demoBattery.id);
    setTab('history');
  };

  const clearDemo = () => setBenchTests((prev) => prev.filter((t) => !isDemoTest(t)));

  return (
    <div className="app">
      <header>
        <h1>Propulsion Workbench</h1>
        <span className="tagline">
          static electric propulsion — calculate · compare · measure · calibrate
        </span>
      </header>

      <ModelBanner />

      {/* Phone only: keeps the answer on screen while the sliders are being worked. On a
          desktop the operating point is already visible beside the controls. */}
      <StickySummary result={result} propeller={propeller} />

      <main className="layout">
        <aside className="panel hardware">
          <h2>Hardware</h2>

          <MotorPicker motors={motors} selectedId={motorId} onSelect={setMotorId} />

          <label>
            Battery
            <select value={batteryId} onChange={(e) => setBatteryId(e.target.value)}>
              {batteries.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>


          <fieldset>
            <legend>Pack voltage</legend>
          <div className="voltage-control">
            <div className="voltage-head">
              <strong>{packV.toFixed(2)} V</strong> pack
              <span className="muted">
                {' '}
                · {voltsPerCell(battery, packV).toFixed(2)} V/cell · {battery.cells}S
              </span>
            </div>
            <input
              type="range"
              min={CELL_V_MIN}
              max={CELL_V_FULL}
              step={0.01}
              value={cellV}
              onChange={(e) => setCellV(Number(e.target.value))}
              aria-label="Pack voltage per cell"
            />
            <div className="range-ends">
              <span>{CELL_V_MIN.toFixed(1)} V/cell — flat</span>
              <span>{CELL_V_FULL.toFixed(1)} — fresh</span>
            </div>
            <div className="voltage-presets">
              {[
                ['Flat', 3.3],
                ['Nominal', CELL_V_NOMINAL],
                ['Fresh', CELL_V_FULL],
              ].map(([label, v]) => (
                <button
                  key={label as string}
                  className={Math.abs(cellV - (v as number)) < 0.005 ? 'preset on' : 'preset'}
                  onClick={() => setCellV(v as number)}
                >
                  {label as string}
                </button>
              ))}
            </div>
            <p className="footnote">
              Pack voltage as it sags through a flight — and, to first order, the same lever as
              throttle: an ESC chops the supply, so half throttle behaves roughly like half the
              voltage. An approximation, but nobody flies at full throttle all the time.
            </p>
          </div>
          </fieldset>

          <label>
            Propeller
            <select value={propId} onChange={(e) => setPropId(e.target.value)}>
              {[...propellers]
                .sort((a, b) => a.diameterIn - b.diameterIn || a.pitchIn - b.pitchIn)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.manufacturer} {p.diameterIn}×{p.pitchIn}
                    {p.bladeCount && p.bladeCount !== 2 ? ` (${p.bladeCount}B)` : ''}
                  </option>
                ))}
            </select>
          </label>

          <fieldset>
            <legend>Diameter — {propeller.diameterIn}″</legend>
            <input
              type="range"
              min={0}
              max={diameters.length - 1}
              step={1}
              value={Math.max(0, diameters.indexOf(propeller.diameterIn))}
              onChange={(e) => selectByGeometry(diameters[Number(e.target.value)], propeller.pitchIn)}
            />
            <div className="range-ends">
              <span>{diameters[0]}″</span>
              <span>{diameters[diameters.length - 1]}″</span>
            </div>
          </fieldset>

          <fieldset>
            <legend>Pitch — {propeller.pitchIn}″</legend>
            <input
              type="range"
              min={0}
              max={Math.max(0, pitches.length - 1)}
              step={1}
              value={Math.max(0, pitches.indexOf(propeller.pitchIn))}
              onChange={(e) =>
                selectByGeometry(propeller.diameterIn, pitches[Number(e.target.value)])
              }
            />
            <div className="range-ends">
              <span>{pitches[0]}″</span>
              <span>{pitches[pitches.length - 1]}″</span>
            </div>
            <p className="footnote">
              Sliders snap to real catalogue propellers (Mode A). No interpolated geometry is
              offered, because interpolating between two commercial props does not describe a prop
              you can buy or bench-test.
            </p>
          </fieldset>

          <button className="more-toggle" onClick={() => setShowMore((v) => !v)} aria-expanded={showMore}>
            {showMore ? 'Fewer options' : 'More options — conditions, data, demo'}
          </button>

          {showMore && (
            <>
          <fieldset>
            <legend>Conditions</legend>
            <label>
              Air density (kg/m³)
              <input
                type="number"
                step="0.005"
                value={airDensity}
                onChange={(e) => setAirDensity(Number(e.target.value) || CONSTANTS.airDensitySeaLevelIsa.value)}
              />
            </label>
          </fieldset>

          <fieldset>
            <legend>Data</legend>
            <button className="link-btn" onClick={exportJson}>
              Export workspace (JSON)
            </button>
            <button className="link-btn" onClick={exportCsv} disabled={benchTests.length === 0}>
              Export bench tests (CSV)
            </button>
            <label className="file-label">
              Import JSON
              <input
                type="file"
                accept="application/json,.json"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importJson(f);
                  e.target.value = '';
                }}
              />
            </label>
            {importMessage && <p className="footnote">{importMessage}</p>}
            {unexported && (
              <p className="footnote warn-text">
                {benchTests.length} test{benchTests.length === 1 ? '' : 's'} stored in this browser
                only. Export them — clearing site data would destroy them.
              </p>
            )}
          </fieldset>

          <fieldset>
            <legend>Demo</legend>
            {demoLoaded ? (
              <button className="link-btn" onClick={clearDemo}>
                Remove demo bench data
              </button>
            ) : (
              <button className="link-btn" onClick={loadDemo}>
                Load demo bench data
              </button>
            )}
            <p className="footnote">
              Adds a set of <strong>synthetic</strong> measurements so the record → error →
              history views can be seen working without running a motor first. They are generated
              from the model with a deliberate pitch-dependent bias, marked{' '}
              <code>[DEMO DATA]</code>, and removable in one click. Not real bench results.
            </p>
          </fieldset>
            </>
          )}
        </aside>

        <div className="main-column">
          <OperatingPoint
            result={result}
            title={`${motor.manufacturer} ${motor.model} · ${battery.name} · ${propeller.manufacturer} ${propeller.diameterIn}×${propeller.pitchIn}`}
          />

          <nav className="tabs">
            {(
              [
                ['explore', 'Explore range'],
                ['compare', 'Compare props'],
                ['record', 'Record test'],
                ['history', `Test history (${benchTests.length})`],
                ['hardware', 'Add hardware'],
                ['model', 'Model & provenance'],
              ] as Array<[Tab, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                className={tab === key ? 'tab active' : 'tab'}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </nav>

          {tab === 'explore' && (
            <ExplorePanel
              motor={motor}
              battery={battery}
              propellers={propellers}
              airDensityKgM3={airDensity}
              packVoltageV={packV}
              onSelect={(p) => setPropId(p.id)}
              selectedId={propeller.id}
            />
          )}

          {tab === 'compare' && (
            <ComparePanel
              motor={motor}
              battery={battery}
              propellers={propellers}
              selected={propeller}
              airDensityKgM3={airDensity}
              packVoltageV={packV}
              onSelect={(p) => setPropId(p.id)}
            />
          )}

          {tab === 'record' && (
            <RecordTest
              motor={motor}
              battery={battery}
              propeller={propeller}
              predicted={result}
              onSave={(t) => setBenchTests((prev) => [...prev, t])}
            />
          )}

          {tab === 'history' && (
            <TestHistory
              tests={benchTests}
              motors={motors}
              batteries={batteries}
              propellers={propellers}
              onDelete={(testId) => setBenchTests((prev) => prev.filter((t) => t.id !== testId))}
            />
          )}

          {tab === 'hardware' && (
            <HardwareEditor
              onAddMotor={(m) => {
                setMotors((prev) => [...prev, m]);
                setMotorId(m.id);
              }}
              onAddBattery={(b) => {
                setBatteries((prev) => [...prev, b]);
                setBatteryId(b.id);
              }}
              onAddPropeller={(p) => {
                setPropellers((prev) => [...prev, p]);
                setPropId(p.id);
              }}
            />
          )}

          {tab === 'model' && <ModelPanel />}
        </div>
      </main>
    </div>
  );
}

/**
 * The accuracy caveat. It has to be visible — it is the difference between "engineering tool"
 * and "confident nonsense" — but on a phone the full paragraph ate a third of the first screen
 * before any control was reachable. So it collapses to one line on narrow screens and stays
 * open on a desktop, where the space is free.
 */
function ModelBanner(): ReactElement {
  const [open, setOpen] = useState(
    () => typeof window === 'undefined' || window.matchMedia('(min-width: 901px)').matches,
  );
  return (
    <div className={`calibration-banner${open ? ' open' : ''}`}>
      <button className="banner-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <strong>Demonstration model</strong>
        <span className="banner-hint">
          {open ? 'hide' : 'trends solid · absolutes ±10–20% — tap for detail'}
        </span>
      </button>
      {open && (
        <p className="banner-body">
          The motor and battery physics are standard and sound; the propeller coefficients are a
          generic pitch-ratio model rather than data measured from a specific blade. So the{' '}
          <em>trends and comparisons</em> are meaningful — which prop pulls harder, where the
          current goes — while absolute thrust figures carry maybe ±10–20%, worse at coarse pitch.
          Bench-test and record results to calibrate it. See the Model tab for every constant and
          its origin.
        </p>
      )}
    </div>
  );
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
}

function ModelPanel(): ReactElement {
  return (
    <section className="panel">
      <h2>Model &amp; provenance</h2>
      <p>
        Every constant the physics model uses is listed below with its origin. Anything marked{' '}
        <strong>PLACEHOLDER</strong> is a plausible engineering value that has <em>not</em> been
        fitted to data — the calculator raises <code>MODEL_UNCALIBRATED</code> whenever it touches
        one, so an unfitted number can never be presented as if it were validated.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Constant</th>
              <th>Value</th>
              <th>Units</th>
              <th>Origin</th>
              <th>Explanation</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(CONSTANTS).map((c) => (
              <tr key={c.name} className={c.origin === 'PLACEHOLDER' ? 'error-row' : ''}>
                <td>
                  <code>{c.name}</code>
                </td>
                <td>{c.value}</td>
                <td>{c.units}</td>
                <td>{c.origin}</td>
                <td className="notes-cell">
                  {c.explanation}
                  {c.source && (
                    <>
                      <br />
                      <em>Source: {c.source}</em>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>What would make this trustworthy</h3>
      <ol className="prose-list">
        <li>
          Add reference cases from your Excel/Mathematica sheets to{' '}
          <code>src/model/fixtures/reference-cases.json</code>. The regression test currently
          reports the Milestone-1 gate as <strong>UNMET</strong> because that file is empty.
        </li>
        <li>
          Replace the four placeholder C<sub>T</sub>/C<sub>P</sub> constants with a fit to real
          data, or attach per-propeller <code>staticCoefficients</code> — which switches that prop
          from the placeholder model to measured data and silences its warning.
        </li>
        <li>
          Bench-test and record results. The history tab's error chart is what tells you whether
          the model is wrong, and in which direction.
        </li>
      </ol>

      <h3>Known limitations, stated rather than buried</h3>
      <ul className="prose-list">
        <li>
          Static thrust only — no forward-flight model, so propulsive efficiency is not reported
          (it is identically zero at zero airspeed).
        </li>
        <li>
          The placeholder C<sub>T</sub> rises linearly with pitch ratio. Real blades stall at zero
          advance, so predictions are likely optimistic for high-pitch props, and increasingly so
          the coarser the pitch.
        </li>
        <li>
          No-load current is treated as constant, whereas real I₀ grows with RPM — a small
          optimistic bias in shaft torque.
        </li>
        <li>ESC and wiring resistance defaults to zero until measured.</li>
        <li>Battery state of charge, IR rise with age, and cell imbalance are not modelled.</li>
      </ul>
    </section>
  );
}
