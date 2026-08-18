/**
 * Motor selection with spec filters and a full parameter view.
 *
 * Two jobs:
 *  - narrow a catalogue spanning 20 g to 1270 g down to the motors that suit one aeroplane,
 *    using the specs that actually decide it: Kv, mass, max current, max power
 *  - show EVERY parameter of the selected motor, including where each number came from,
 *    because a calculator you cannot audit is a calculator you have to take on faith
 *
 * The filtering itself lives in `model/motorFilter.ts`; this only arranges controls.
 */
import { useMemo, useState, type ReactElement } from 'react';
import type { Motor } from '../model/types';
import {
  MOTOR_FIELDS,
  filterMotors,
  fullRangeFilter,
  isFullRange,
  motorBounds,
  unknownCount,
  type MotorFilter,
} from '../model/motorFilter';
import { fmt } from '../units/units';

interface Props {
  motors: Motor[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function MotorPicker({ motors, selectedId, onSelect }: Props): ReactElement {
  const [filter, setFilter] = useState<MotorFilter>(() => fullRangeFilter(motors));
  const [showFilters, setShowFilters] = useState(false);
  const [showSpecs, setShowSpecs] = useState(false);

  const shown = useMemo(() => filterMotors(motors, filter), [motors, filter]);
  const narrowed = !isFullRange(motors, filter);
  const selected = motors.find((m) => m.id === selectedId);

  // Selecting out from under the filter is confusing; if the current motor is filtered away,
  // say so rather than silently switching it.
  const selectedHidden = selected !== undefined && !shown.some((m) => m.id === selected.id);

  return (
    <>
      <label>
        Motor
        <select value={selectedId} onChange={(e) => onSelect(e.target.value)}>
          {selectedHidden && selected && (
            <option value={selected.id}>
              {selected.manufacturer} {selected.model} — {selected.kvRpmPerVolt} kV (filtered out)
            </option>
          )}
          {shown.map((m) => (
            <option key={m.id} value={m.id}>
              {m.manufacturer} {m.model} — {m.kvRpmPerVolt} kV
              {m.massG ? ` · ${m.massG} g` : ''}
              {m.dataClass === 'ASSUMED' ? ' (unverified)' : ''}
            </option>
          ))}
        </select>
      </label>

      <div className="picker-actions">
        <button className="link-btn" onClick={() => setShowFilters((v) => !v)}>
          {showFilters ? 'Hide filters' : 'Filter motors'} ({shown.length}/{motors.length})
        </button>
        <button className="link-btn" onClick={() => setShowSpecs((v) => !v)}>
          {showSpecs ? 'Hide specs' : 'Motor specs'}
        </button>
      </div>

      {shown.length === 0 && (
        <p className="footnote warn-text">
          No motor matches these filters. Widen a range, or reset.
        </p>
      )}

      {showFilters && (
        <fieldset className="motor-filters">
          <legend>Show motors within</legend>

          <label>
            Search
            <input
              value={filter.search ?? ''}
              onChange={(e) => setFilter({ ...filter, search: e.target.value })}
              placeholder="e.g. AXI, 2820"
            />
          </label>

          {MOTOR_FIELDS.map((field) => {
            const bounds = motorBounds(motors, field.key);
            if (!bounds) return null;
            const range = filter[field.filterKey] ?? bounds;
            const unknown = unknownCount(motors, field.key);
            return (
              <div key={field.key} className="filter-row">
                <span className="filter-label">
                  {field.label} {fmt(range.min, 0)}–{fmt(range.max, 0)} {field.unit}
                </span>
                <input
                  type="range"
                  min={bounds.min}
                  max={bounds.max}
                  step={field.step}
                  value={range.min}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setFilter({
                      ...filter,
                      [field.filterKey]: { min: v, max: Math.max(v, range.max) },
                    });
                  }}
                />
                <input
                  type="range"
                  min={bounds.min}
                  max={bounds.max}
                  step={field.step}
                  value={range.max}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setFilter({
                      ...filter,
                      [field.filterKey]: { min: Math.min(v, range.min), max: v },
                    });
                  }}
                />
                {unknown > 0 && (
                  <span className="filter-note">
                    {unknown === 1
                      ? '1 motor does not publish this'
                      : `${unknown} motors do not publish this`}{' '}
                    — kept, not hidden
                  </span>
                )}
              </div>
            );
          })}

          <button className="link-btn" onClick={() => setFilter(fullRangeFilter(motors))}>
            Reset filters
          </button>
        </fieldset>
      )}

      {showSpecs && selected && <MotorSpecs motor={selected} />}
      {narrowed && !showFilters && (
        <p className="footnote">
          Filtered to {shown.length} of {motors.length} motors.
        </p>
      )}
    </>
  );
}

const SPEC_ROWS: Array<[string, (m: Motor) => string]> = [
  ['Manufacturer', (m) => m.manufacturer],
  ['Model', (m) => m.model],
  ['Kv', (m) => `${m.kvRpmPerVolt} rpm/V`],
  ['Winding resistance Rm', (m) =>
    m.resistanceOhm === undefined ? 'not published' : `${(m.resistanceOhm * 1000).toFixed(0)} mΩ`],
  ['No-load current I₀', (m) =>
    m.noLoadCurrentA === undefined ? 'not published' : `${m.noLoadCurrentA} A`],
  ['Max current', (m) => (m.maxCurrentA === undefined ? 'not published' : `${m.maxCurrentA} A`)],
  ['Max power', (m) => (m.maxPowerW === undefined ? 'not published' : `${m.maxPowerW} W`)],
  ['Mass', (m) => (m.massG === undefined ? 'not published' : `${m.massG} g`)],
  ['Data class', (m) => m.dataClass ?? 'unspecified'],
];

export function MotorSpecs({ motor }: { motor: Motor }): ReactElement {
  return (
    <fieldset className="motor-specs">
      <legend>All parameters</legend>
      <dl className="spec-list">
        {SPEC_ROWS.map(([label, get]) => {
          const value = get(motor);
          return (
            <div key={label} className={value === 'not published' ? 'spec-missing' : undefined}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          );
        })}
      </dl>

      {motor.notes && <p className="footnote">{motor.notes}</p>}

      {motor.provenance && (
        <p className="footnote">
          <strong>Source:</strong> {motor.provenance.sourceName ?? 'unspecified'}
          {motor.provenance.accessedDate ? ` (checked ${motor.provenance.accessedDate})` : ''}
          {motor.provenance.sourceUrl && (
            <>
              {' — '}
              <a href={motor.provenance.sourceUrl} target="_blank" rel="noreferrer">
                datasheet
              </a>
            </>
          )}
        </p>
      )}

      {motor.resistanceOhm === undefined && (
        <p className="footnote warn-text">
          Without winding resistance the calculator cannot find a loaded operating point, and will
          say so instead of guessing.
        </p>
      )}
    </fieldset>
  );
}
