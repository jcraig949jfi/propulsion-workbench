/**
 * Motor filtering (v3.1).
 *
 * The catalogue spans a 20 g indoor motor to a 1270 g giant-scale unit, which is useful range
 * and useless as a dropdown — most people fly one size of aeroplane. This narrows the list by
 * the specs that actually decide whether a motor suits an airframe.
 *
 * Pure, and separate from the UI, for the usual reason: the filter is a statement about the
 * catalogue, not about a React component, and it is testable on its own.
 *
 * A motor whose spec is UNKNOWN is kept, not dropped. Dropping it would quietly hide hardware
 * because a manufacturer omitted a number, which is the opposite of what the rest of this app
 * does with missing data. The filter narrows on what is known and says so.
 */
import type { Motor } from './types';
import type { Range } from './sweep';

export type MotorField = 'kvRpmPerVolt' | 'massG' | 'maxCurrentA' | 'maxPowerW';

export interface MotorFilter {
  kv?: Range;
  massG?: Range;
  maxCurrentA?: Range;
  maxPowerW?: Range;
  /** Free-text match on manufacturer or model. */
  search?: string;
}

export const MOTOR_FIELDS: Array<{
  key: MotorField;
  filterKey: keyof Omit<MotorFilter, 'search'>;
  label: string;
  unit: string;
  step: number;
}> = [
  { key: 'kvRpmPerVolt', filterKey: 'kv', label: 'Kv', unit: 'rpm/V', step: 5 },
  { key: 'massG', filterKey: 'massG', label: 'Mass', unit: 'g', step: 1 },
  { key: 'maxCurrentA', filterKey: 'maxCurrentA', label: 'Max current', unit: 'A', step: 0.5 },
  { key: 'maxPowerW', filterKey: 'maxPowerW', label: 'Max power', unit: 'W', step: 5 },
];

/** The min/max actually present in a catalogue, per field — the bounds a slider should span. */
export function motorBounds(motors: Motor[], key: MotorField): Range | undefined {
  const values = motors
    .map((m) => m[key])
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (values.length === 0) return undefined;
  return { min: Math.min(...values), max: Math.max(...values) };
}

function withinOrUnknown(value: number | undefined, range: Range | undefined): boolean {
  if (!range) return true;
  if (value === undefined || !Number.isFinite(value)) return true; // unknown is kept, not hidden
  return value >= range.min && value <= range.max;
}

export function matchesFilter(motor: Motor, filter: MotorFilter): boolean {
  if (filter.search && filter.search.trim() !== '') {
    const needle = filter.search.trim().toLowerCase();
    const hay = `${motor.manufacturer} ${motor.model}`.toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  return (
    withinOrUnknown(motor.kvRpmPerVolt, filter.kv) &&
    withinOrUnknown(motor.massG, filter.massG) &&
    withinOrUnknown(motor.maxCurrentA, filter.maxCurrentA) &&
    withinOrUnknown(motor.maxPowerW, filter.maxPowerW)
  );
}

export function filterMotors(motors: Motor[], filter: MotorFilter): Motor[] {
  return motors.filter((m) => matchesFilter(m, filter));
}

/** How many kept motors are missing a value for a filtered field — reported, not hidden. */
export function unknownCount(motors: Motor[], key: MotorField): number {
  return motors.filter((m) => m[key] === undefined || !Number.isFinite(m[key] as number)).length;
}

/** A filter spanning everything, i.e. no narrowing — the sane starting state. */
export function fullRangeFilter(motors: Motor[]): MotorFilter {
  const f: MotorFilter = {};
  for (const field of MOTOR_FIELDS) {
    const b = motorBounds(motors, field.key);
    if (b) f[field.filterKey] = { ...b };
  }
  return f;
}

/** True when the filter has not been narrowed away from the catalogue's own bounds. */
export function isFullRange(motors: Motor[], filter: MotorFilter): boolean {
  if (filter.search && filter.search.trim() !== '') return false;
  return MOTOR_FIELDS.every((field) => {
    const b = motorBounds(motors, field.key);
    const r = filter[field.filterKey];
    if (!b || !r) return true;
    return r.min <= b.min && r.max >= b.max;
  });
}
