/**
 * Hardware editor (spec §16). Lets Mark add his real motors, packs and props without touching
 * source. Anything he enters is marked MEASURED — it came from his datasheet or his bench, not
 * from this app's guesses — which is what clears the UNVERIFIED_INPUT_DATA warning.
 */
import { useState, type ReactElement } from 'react';
import type { Battery, Motor, Propeller } from '../model/types';

interface Props {
  onAddMotor: (m: Motor) => void;
  onAddBattery: (b: Battery) => void;
  onAddPropeller: (p: Propeller) => void;
}

const num = (s: string): number | undefined => {
  const v = Number(s.trim());
  return s.trim() !== '' && Number.isFinite(v) ? v : undefined;
};

const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}`;

export function HardwareEditor({ onAddMotor, onAddBattery, onAddPropeller }: Props): ReactElement {
  const [m, setM] = useState({
    manufacturer: '',
    model: '',
    kv: '',
    rm: '',
    i0: '',
    maxA: '',
    maxW: '',
    massG: '',
  });
  const [b, setB] = useState({ name: '', cells: '', mah: '', ir: '', maxA: '' });
  const [p, setP] = useState({ manufacturer: '', model: '', d: '', pitch: '', blades: '2' });

  const addMotor = () => {
    const kv = num(m.kv);
    if (!kv || !m.model.trim()) return;
    onAddMotor({
      id: id('motor'),
      manufacturer: m.manufacturer.trim() || '(unnamed)',
      model: m.model.trim(),
      kvRpmPerVolt: kv,
      resistanceOhm: num(m.rm),
      noLoadCurrentA: num(m.i0),
      maxCurrentA: num(m.maxA),
      maxPowerW: num(m.maxW),
      massG: num(m.massG),
      dataClass: 'MEASURED',
      provenance: { sourceName: 'entered by user', accessedDate: new Date().toISOString().slice(0, 10) },
    });
    setM({ manufacturer: '', model: '', kv: '', rm: '', i0: '', maxA: '', maxW: '', massG: '' });
  };

  const addBattery = () => {
    const cells = num(b.cells);
    const mah = num(b.mah);
    if (!cells || !mah) return;
    onAddBattery({
      id: id('batt'),
      name: b.name.trim() || `${cells}S ${mah} mAh`,
      cells,
      capacityMah: mah,
      nominalVoltageV: cells * 3.7,
      fullyChargedVoltageV: cells * 4.2,
      internalResistanceOhm: num(b.ir),
      maxContinuousCurrentA: num(b.maxA),
      dataClass: 'MEASURED',
      provenance: { sourceName: 'entered by user', accessedDate: new Date().toISOString().slice(0, 10) },
    });
    setB({ name: '', cells: '', mah: '', ir: '', maxA: '' });
  };

  const addProp = () => {
    const d = num(p.d);
    const pitch = num(p.pitch);
    if (!d || !pitch) return;
    onAddPropeller({
      id: id('prop'),
      manufacturer: p.manufacturer.trim() || '(unnamed)',
      model: p.model.trim() || `${d}x${pitch}`,
      diameterIn: d,
      pitchIn: pitch,
      bladeCount: num(p.blades) ?? 2,
      dataClass: 'MEASURED',
      provenance: { sourceName: 'entered by user', accessedDate: new Date().toISOString().slice(0, 10) },
    });
    setP({ manufacturer: '', model: '', d: '', pitch: '', blades: '2' });
  };

  return (
    <section className="panel">
      <h2>Add hardware</h2>
      <p className="footnote">
        Records you add are marked <strong>MEASURED</strong> and saved in this browser. Export
        regularly — browser storage should never be the only copy.
      </p>

      <h3>Motor</h3>
      <div className="form-grid">
        <label>
          Manufacturer
          <input value={m.manufacturer} onChange={(e) => setM({ ...m, manufacturer: e.target.value })} />
        </label>
        <label>
          Model
          <input value={m.model} onChange={(e) => setM({ ...m, model: e.target.value })} />
        </label>
        <label>
          Kv (rpm/V) *
          <input value={m.kv} onChange={(e) => setM({ ...m, kv: e.target.value })} inputMode="decimal" />
        </label>
        <label>
          Resistance Rm (Ω)
          <input value={m.rm} onChange={(e) => setM({ ...m, rm: e.target.value })} inputMode="decimal" />
        </label>
        <label>
          No-load current I₀ (A)
          <input value={m.i0} onChange={(e) => setM({ ...m, i0: e.target.value })} inputMode="decimal" />
        </label>
        <label>
          Max continuous current (A)
          <input value={m.maxA} onChange={(e) => setM({ ...m, maxA: e.target.value })} inputMode="decimal" />
        </label>
        <label>
          Max power (W)
          <input value={m.maxW} onChange={(e) => setM({ ...m, maxW: e.target.value })} inputMode="decimal" />
        </label>
        <label>
          Mass (g)
          <input value={m.massG} onChange={(e) => setM({ ...m, massG: e.target.value })} inputMode="decimal" />
        </label>
      </div>
      <p className="footnote">
        Rm is not optional in practice: without it the calculator cannot find a loaded operating
        point and will say so instead of guessing.
      </p>
      <button className="primary-btn" onClick={addMotor} disabled={!num(m.kv) || !m.model.trim()}>
        Add motor
      </button>

      <h3>Battery</h3>
      <div className="form-grid">
        <label>
          Name
          <input value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} />
        </label>
        <label>
          Cells (S) *
          <input value={b.cells} onChange={(e) => setB({ ...b, cells: e.target.value })} inputMode="decimal" />
        </label>
        <label>
          Capacity (mAh) *
          <input value={b.mah} onChange={(e) => setB({ ...b, mah: e.target.value })} inputMode="decimal" />
        </label>
        <label>
          Internal resistance (Ω)
          <input value={b.ir} onChange={(e) => setB({ ...b, ir: e.target.value })} inputMode="decimal" />
        </label>
        <label>
          Max continuous current (A)
          <input value={b.maxA} onChange={(e) => setB({ ...b, maxA: e.target.value })} inputMode="decimal" />
        </label>
      </div>
      <button className="primary-btn" onClick={addBattery} disabled={!num(b.cells) || !num(b.mah)}>
        Add battery
      </button>

      <h3>Propeller</h3>
      <div className="form-grid">
        <label>
          Manufacturer
          <input value={p.manufacturer} onChange={(e) => setP({ ...p, manufacturer: e.target.value })} />
        </label>
        <label>
          Model
          <input value={p.model} onChange={(e) => setP({ ...p, model: e.target.value })} />
        </label>
        <label>
          Diameter (in) *
          <input value={p.d} onChange={(e) => setP({ ...p, d: e.target.value })} inputMode="decimal" />
        </label>
        <label>
          Pitch (in) *
          <input value={p.pitch} onChange={(e) => setP({ ...p, pitch: e.target.value })} inputMode="decimal" />
        </label>
        <label>
          Blades
          <input value={p.blades} onChange={(e) => setP({ ...p, blades: e.target.value })} inputMode="decimal" />
        </label>
      </div>
      <button className="primary-btn" onClick={addProp} disabled={!num(p.d) || !num(p.pitch)}>
        Add propeller
      </button>
    </section>
  );
}
