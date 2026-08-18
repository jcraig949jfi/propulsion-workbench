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
  /** Set by voltageSweep: this point's average motor voltage as % of full pack voltage. */
  throttlePct?: number;
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

/**
 * Throttle-response sweep (Mark's ask, 2026-08-18): hold motor, battery and ONE propeller
 * fixed, and vary the average voltage the motor sees from near zero up to the full pack
 * voltage. An ESC's PWM throttle sets that average voltage, so this curve reads directly as
 * "what happens to RPM, thrust and current as the stick comes up" — the same approximation the
 * pack-voltage slider makes, swept instead of set. Documented in MODEL.md; ignores switching
 * losses and low-duty non-linearity.
 *
 * Points where the solver finds no operating point are EXCLUDED, and that is physics: below
 * some voltage the stall current cannot overcome the no-load current and the prop simply does
 * not turn. The curve honestly starts where the prop starts.
 */
export interface VoltageSweepInput {
  motor: Motor;
  battery: Battery;
  propeller: Propeller;
  /** Full-throttle pack voltage — the top of the sweep (the slider's setting). */
  packVoltageMaxV: number;
  /** Lowest throttle fraction to evaluate, default 10%. */
  minFraction?: number;
  /** Number of points, default 25. */
  steps?: number;
  airDensityKgM3?: number;
}

export function voltageSweep(input: VoltageSweepInput): SweepPoint[] {
  const { motor, battery, propeller, packVoltageMaxV, airDensityKgM3 } = input;
  const steps = Math.max(2, input.steps ?? 25);
  const minFraction = Math.min(Math.max(input.minFraction ?? 0.1, 0.01), 1);
  const out: SweepPoint[] = [];
  for (let i = 0; i < steps; i += 1) {
    const fraction = minFraction + ((1 - minFraction) * i) / (steps - 1);
    const result = calculatePropulsion({
      motor,
      battery,
      propeller,
      airDensityKgM3,
      packVoltageV: packVoltageMaxV * fraction,
    });
    if (!result.diagnostics.converged || !Number.isFinite(result.rpm)) continue;
    out.push({
      propeller,
      result,
      overLimit: result.warnings.some((w) => w.severity === 'ERROR'),
      throttlePct: fraction * 100,
    });
  }
  return out;
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
  | 'loadedVoltageV'
  | 'packVoltageV'
  | 'throttlePct';

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
  throttlePct: {
    // Only populated by voltageSweep — the prop-family sweep runs at one fixed voltage.
    key: 'throttlePct', label: 'Throttle', unit: '%', independent: true, digits: 0,
    get: (p) => p.throttlePct,
  },
  packVoltageV: {
    // The open-circuit voltage the sweep was computed at — the slider setting. Deliberately a
    // FLAT line: plot it on the same axis as loaded voltage and the gap between the two IS the
    // I*R sag, point by point.
    key: 'packVoltageV', label: 'Pack voltage (open-circuit)', unit: 'V', independent: true, digits: 2,
    get: (p) => p.result.packVoltageV,
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
