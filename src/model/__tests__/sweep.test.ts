/**
 * Sweep behaviour (v2). Properties again, not magnitudes: the window must select exactly the
 * real props inside it, series grouping must partition without losing or duplicating a point,
 * and the ordering the charts rely on must be guaranteed here rather than assumed there.
 */
import { describe, expect, it } from 'vitest';
import { METRICS, clampRange, groupSeries, propsInRange, sweep, voltageSweep } from '../sweep';
import { SEED_BATTERIES, SEED_MOTORS, SEED_PROPELLERS } from '../../data/hardware';

const motor = SEED_MOTORS.find((m) => m.id === 'axi-4130-20-v3')!;
const battery = SEED_BATTERIES.find((b) => b.cells === 6 && b.capacityMah === 5000)!;
const base = { motor, battery, propellers: SEED_PROPELLERS };

describe('propsInRange', () => {
  it('selects exactly the catalogue props inside the window, inclusive', () => {
    const got = propsInRange(SEED_PROPELLERS, { min: 12, max: 14 }, { min: 6, max: 8.5 });
    expect(got.length).toBeGreaterThan(0);
    for (const p of got) {
      expect(p.diameterIn).toBeGreaterThanOrEqual(12);
      expect(p.diameterIn).toBeLessThanOrEqual(14);
      expect(p.pitchIn).toBeGreaterThanOrEqual(6);
      expect(p.pitchIn).toBeLessThanOrEqual(8.5);
    }
  });

  it('never invents a propeller that is not in the catalogue (Mode A holds in v2)', () => {
    const ids = new Set(SEED_PROPELLERS.map((p) => p.id));
    for (const p of propsInRange(SEED_PROPELLERS, { min: 10, max: 22 }, { min: 0, max: 99 })) {
      expect(ids.has(p.id)).toBe(true);
    }
  });

  it('returns nothing for an empty window rather than the nearest thing', () => {
    expect(propsInRange(SEED_PROPELLERS, { min: 10.2, max: 10.3 }, { min: 6, max: 7 })).toEqual([]);
  });

  it('sorts by diameter then pitch', () => {
    const got = propsInRange(SEED_PROPELLERS, { min: 10, max: 13 }, { min: 0, max: 99 });
    for (let i = 1; i < got.length; i += 1) {
      const a = got[i - 1];
      const b = got[i];
      expect(a.diameterIn < b.diameterIn || (a.diameterIn === b.diameterIn && a.pitchIn <= b.pitchIn)).toBe(true);
    }
  });
});

describe('sweep', () => {
  const points = sweep({ ...base, diameter: { min: 14, max: 18 }, pitch: { min: 7, max: 12 } });

  it('produces one result per prop in the window', () => {
    expect(points.length).toBe(
      propsInRange(SEED_PROPELLERS, { min: 14, max: 18 }, { min: 7, max: 12 }).length,
    );
  });

  it('every point carries a converged operating point for a sane combination', () => {
    for (const p of points) expect(p.result.diagnostics.converged).toBe(true);
  });

  it('flags over-limit points so a chart can mark them', () => {
    expect(points.some((p) => typeof p.overLimit === 'boolean')).toBe(true);
    for (const p of points) {
      expect(p.overLimit).toBe(p.result.warnings.some((w) => w.severity === 'ERROR'));
    }
  });

  it('is the same physics as the single-point path', () => {
    const one = points[0];
    const direct = sweep({
      ...base,
      diameter: { min: one.propeller.diameterIn, max: one.propeller.diameterIn },
      pitch: { min: one.propeller.pitchIn, max: one.propeller.pitchIn },
    })[0];
    expect(direct.result.rpm).toBe(one.result.rpm);
  });

  it('shows thrust rising and rpm falling across a diameter sweep', () => {
    const wide = sweep({ ...base, diameter: { min: 14, max: 20 }, pitch: { min: 10, max: 10 } });
    expect(wide.length).toBeGreaterThan(2);
    expect(wide[wide.length - 1].result.rpm).toBeLessThan(wide[0].result.rpm);
    expect(wide[wide.length - 1].result.thrustN!).toBeGreaterThan(wide[0].result.thrustN!);
  });
});

describe('metrics', () => {
  const points = sweep({ ...base, diameter: { min: 14, max: 18 }, pitch: { min: 7, max: 12 } });

  it('every metric is readable for a converged point', () => {
    for (const key of Object.keys(METRICS) as (keyof typeof METRICS)[]) {
      const v = METRICS[key].get(points[0]);
      expect(v === undefined || Number.isFinite(v)).toBe(true);
    }
  });

  it('reports pitch ratio consistently with diameter and pitch', () => {
    const p = points[0];
    expect(METRICS.pitchRatio.get(p)!).toBeCloseTo(
      METRICS.pitch.get(p)! / METRICS.diameter.get(p)!,
      12,
    );
  });

  it('expresses motor efficiency as a percentage, not a fraction', () => {
    const e = METRICS.motorEfficiency.get(points[0])!;
    expect(e).toBeGreaterThan(1);
    expect(e).toBeLessThan(100);
  });
});

describe('series grouping', () => {
  const points = sweep({ ...base, diameter: { min: 14, max: 18 }, pitch: { min: 7, max: 12 } });

  it('partitions without losing or duplicating a point', () => {
    for (const by of ['none', 'diameter', 'pitch'] as const) {
      const total = groupSeries(points, by, 'pitch').reduce((n, s) => n + s.points.length, 0);
      expect(total).toBe(points.length);
    }
  });

  it('makes one series per distinct diameter', () => {
    const series = groupSeries(points, 'diameter', 'pitch');
    expect(series.length).toBe(new Set(points.map((p) => p.propeller.diameterIn)).size);
  });

  it('sorts each series by the chosen x metric, so lines do not zig-zag', () => {
    for (const s of groupSeries(points, 'diameter', 'pitch')) {
      const xs = s.points.map((p) => METRICS.pitch.get(p)!);
      expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    }
  });

  it('can sort by a response variable too, not just geometry', () => {
    for (const s of groupSeries(points, 'diameter', 'currentA')) {
      const xs = s.points.map((p) => METRICS.currentA.get(p)!);
      expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    }
  });
});

describe('clampRange', () => {
  const values = [10, 11, 12, 13, 14];

  it('pulls a range inside the available values', () => {
    expect(clampRange(values, { min: 2, max: 99 })).toEqual({ min: 10, max: 14 });
  });

  it('repairs an inverted range rather than returning nothing', () => {
    expect(clampRange(values, { min: 13, max: 11 })).toEqual({ min: 11, max: 13 });
  });

  it('leaves a valid range alone', () => {
    expect(clampRange(values, { min: 11, max: 13 })).toEqual({ min: 11, max: 13 });
  });

  it('tolerates an empty value list', () => {
    expect(clampRange([], { min: 1, max: 2 })).toEqual({ min: 1, max: 2 });
  });
});

describe('pack voltage metric', () => {
  it('reports the open-circuit voltage the sweep was computed at, flat across all points', () => {
    const pts = sweep({ ...base, diameter: { min: 14, max: 18 }, pitch: { min: 7, max: 12 },
      packVoltageV: 21.0 });
    const vals = pts.map((p) => METRICS.packVoltageV.get(p));
    expect(new Set(vals).size).toBe(1);
    expect(vals[0]).toBe(21.0);
  });

  it('always sits above loaded voltage by exactly the I*R sag', () => {
    const pts = sweep({ ...base, diameter: { min: 14, max: 18 }, pitch: { min: 7, max: 12 } });
    for (const p of pts) {
      const sag = METRICS.packVoltageV.get(p)! - METRICS.loadedVoltageV.get(p)!;
      const ir = battery.internalResistanceOhm ?? 0;
      expect(sag).toBeCloseTo((p.result.currentA ?? 0) * ir, 9);
      expect(sag).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('voltageSweep — the throttle-response curve', () => {
  const prop = SEED_PROPELLERS.find((p) => p.id === 'apc-11x5.5e')!;
  const vMax = 11.1;
  const pts = voltageSweep({ motor, battery, propeller: prop, packVoltageMaxV: vMax });

  it('produces a curve ordered by voltage', () => {
    expect(pts.length).toBeGreaterThan(10);
    const vs = pts.map((p) => p.result.packVoltageV!);
    expect([...vs].sort((a, b) => a - b)).toEqual(vs);
  });

  it('rpm, thrust and current all RISE with voltage — the throttle behaviour Mark described', () => {
    for (let i = 1; i < pts.length; i += 1) {
      expect(pts[i].result.rpm).toBeGreaterThan(pts[i - 1].result.rpm);
      expect(pts[i].result.thrustN!).toBeGreaterThan(pts[i - 1].result.thrustN!);
      expect(pts[i].result.currentA!).toBeGreaterThan(pts[i - 1].result.currentA!);
    }
  });

  it('tops out at the full pack voltage with throttle = 100%', () => {
    const top = pts[pts.length - 1];
    expect(top.result.packVoltageV!).toBeCloseTo(vMax, 9);
    expect(top.throttlePct!).toBeCloseTo(100, 9);
  });

  it('keeps the same propeller at every point — only voltage varies', () => {
    expect(new Set(pts.map((p) => p.propeller.id)).size).toBe(1);
  });

  it('never emits a NaN row — non-spinning points are excluded, not reported', () => {
    const wide = voltageSweep({
      motor, battery, propeller: prop, packVoltageMaxV: vMax, minFraction: 0.01, steps: 50,
    });
    for (const p of wide) expect(Number.isFinite(p.result.rpm)).toBe(true);
    expect(wide.length).toBeLessThanOrEqual(50);
  });

  it('the throttle metric reads through METRICS like any other axis', () => {
    expect(METRICS.throttlePct.get(pts[0])).toBeCloseTo(10, 6);
    expect(METRICS.throttlePct.get(pts[pts.length - 1])).toBeCloseTo(100, 6);
  });
});
