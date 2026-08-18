/**
 * Sweeps: evaluate a whole family of propellers at once (v2).
 *
 * v1 answered "what does THIS prop do?". v2 answers "what does this REGION of prop space do?" —
 * pick a diameter range and a pitch range, get every real catalogue prop inside that window,
 * each with a full operating point. Still Mode A: every point is a prop you can buy and bench
 * test, never an interpolated geometry.
 *
 * Pure. No React. The chart layer consumes `SweepPoint[]` and knows nothing about physics.
 */
import type { Battery, Motor, Propeller, PropulsionResult } from './types';
import { calculatePropulsion } from './calculatePropulsion';

export interface Range {
  min: number;
  max: number;
}

export interface SweepPoint {
  propeller: Propeller;
  result: PropulsionResult;
  /** True when any rating was exceeded — charts render these differently. */
  overLimit: boolean;
}

export interface SweepInput {
  motor: Motor;
  battery: Battery;
  propellers: Propeller[];
  diameter: Range;
  pitch: Range;
  airDensityKgM3?: number;
  useFullyChargedVoltage?: boolean;
  packVoltageV?: number;
}

export function propsInRange(
  propellers: Propeller[],
  diameter: Range,
  pitch: Range,
): Propeller[] {
  return propellers
    .filter(
      (p) =>
        p.diameterIn >= diameter.min &&
        p.diameterIn <= diameter.max &&
        p.pitchIn >= pitch.min &&
        p.pitchIn <= pitch.max,
    )
    .sort((a, b) => a.diameterIn - b.diameterIn || a.pitchIn - b.pitchIn);
}

export function sweep(input: SweepInput): SweepPoint[] {
  const { motor, battery, airDensityKgM3, useFullyChargedVoltage, packVoltageV } = input;
  return propsInRange(input.propellers, input.diameter, input.pitch).map((propeller) => {
    const result = calculatePropulsion({
      motor,
      battery,
      propeller,
      airDensityKgM3,
      useFullyChargedVoltage,
      packVoltageV,
    });
    return {
      propeller,
      result,
      overLimit: result.warnings.some((w) => w.severity === 'ERROR'),
    };
  });
}

/**
 * The quantities a chart axis can show. Keeping them in one table means the axis pickers,
 * the legend and the tooltip all agree by construction, and adding a quantity is one entry.
 */
export interface MetricDef {
  key: MetricKey;
  label: string;
  unit: string;
  /** Independent variables make sense on X; everything else is a response. */
  independent?: boolean;
  digits: number;
  get: (p: SweepPoint) => number | undefined;
}

export type MetricKey =
  | 'diameter'
  | 'pitch'
  | 'pitchRatio'
  | 'rpm'
  | 'thrustKgF'
  | 'currentA'
  | 'inputPowerW'
  | 'shaftPowerW'
  | 'torqueNm'
  | 'thrustPerWatt'
  | 'motorEfficiency'
  | 'loadedVoltageV';

export const METRICS: Record<MetricKey, MetricDef> = {
  diameter: {
    key: 'diameter', label: 'Diameter', unit: 'in', independent: true, digits: 1,
    get: (p) => p.propeller.diameterIn,
  },
  pitch: {
    key: 'pitch', label: 'Pitch', unit: 'in', independent: true, digits: 1,
    get: (p) => p.propeller.pitchIn,
  },
  pitchRatio: {
    key: 'pitchRatio', label: 'Pitch ratio (p/D)', unit: '', independent: true, digits: 3,
    get: (p) => p.propeller.pitchIn / p.propeller.diameterIn,
  },
  rpm: { key: 'rpm', label: 'RPM', unit: 'rpm', digits: 0, get: (p) => p.result.rpm },
  thrustKgF: {
    key: 'thrustKgF', label: 'Static thrust', unit: 'kg', digits: 2,
    get: (p) => p.result.thrustKgF,
  },
  currentA: { key: 'currentA', label: 'Current', unit: 'A', digits: 1, get: (p) => p.result.currentA },
  inputPowerW: {
    key: 'inputPowerW', label: 'Input power', unit: 'W', digits: 0,
    get: (p) => p.result.inputPowerW,
  },
  shaftPowerW: {
    key: 'shaftPowerW', label: 'Shaft power', unit: 'W', digits: 0,
    get: (p) => p.result.mechanicalPowerW,
  },
  torqueNm: {
    key: 'torqueNm', label: 'Prop torque', unit: 'N·m', digits: 4, get: (p) => p.result.torqueNm,
  },
  thrustPerWatt: {
    key: 'thrustPerWatt', label: 'Thrust per input watt', unit: 'N/W', digits: 4,
    get: (p) => p.result.staticThrustPerInputWattNPerW,
  },
  motorEfficiency: {
    key: 'motorEfficiency', label: 'Motor efficiency', unit: '%', digits: 1,
    get: (p) => (p.result.motorEfficiency === undefined ? undefined : p.result.motorEfficiency * 100),
  },
  loadedVoltageV: {
    // Terminal voltage UNDER LOAD: V_oc - I*R. Anti-correlated with current by construction,
    // so on any sweep it moves opposite to thrust/current/power. That is voltage sag working,
    // not an error — the label says "sag" so the chart explains itself.
    key: 'loadedVoltageV', label: 'Loaded voltage (sags with current)', unit: 'V', digits: 2,
    get: (p) => p.result.loadedVoltageV,
  },
};

export const METRIC_KEYS = Object.keys(METRICS) as MetricKey[];

/** Group a sweep into series — one line per diameter, or per pitch, or a single series. */
export type SeriesBy = 'none' | 'diameter' | 'pitch';

export interface Series {
  label: string;
  points: SweepPoint[];
}

export function groupSeries(points: SweepPoint[], by: SeriesBy, xKey: MetricKey): Series[] {
  if (by === 'none') return [{ label: 'all', points: sortByX(points, xKey) }];
  const keyOf = (p: SweepPoint) =>
    by === 'diameter' ? p.propeller.diameterIn : p.propeller.pitchIn;
  const suffix = by === 'diameter' ? '″ dia' : '″ pitch';
  const groups = new Map<number, SweepPoint[]>();
  for (const p of points) {
    const k = keyOf(p);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(p);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([k, pts]) => ({ label: `${k}${suffix}`, points: sortByX(pts, xKey) }));
}

function sortByX(points: SweepPoint[], xKey: MetricKey): SweepPoint[] {
  const get = METRICS[xKey].get;
  return [...points].sort((a, b) => (get(a) ?? 0) - (get(b) ?? 0));
}

/** Clamp a range to the discrete values that actually exist, preserving min <= max. */
export function clampRange(values: number[], range: Range): Range {
  if (values.length === 0) return range;
  const lo = values[0];
  const hi = values[values.length - 1];
  const min = Math.min(Math.max(range.min, lo), hi);
  const max = Math.min(Math.max(range.max, lo), hi);
  return min <= max ? { min, max } : { min: max, max: min };
}
