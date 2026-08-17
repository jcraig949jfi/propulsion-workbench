/**
 * Guards on the synthetic demo data. The risk being defended against is that fabricated
 * measurements quietly stop looking fabricated — so these tests assert the labelling and the
 * one-click removability, not just the arithmetic.
 */
import { describe, expect, it } from 'vitest';
import { DEMO_NOTE_PREFIX, generateDemoBenchTests, isDemoTest } from './demoBenchTests';
import { SEED_BATTERIES, SEED_MOTORS, SEED_PROPELLERS } from './hardware';
import { predictionError } from '../model/calculatePropulsion';
import { pitchRatio } from '../model/propAero';

const motor = SEED_MOTORS.find((m) => m.id === 'example-700kv-outrunner')!;
const battery = SEED_BATTERIES.find((b) => b.cells === 4 && b.capacityMah === 5000)!;
const propellers = SEED_PROPELLERS.filter((p) => p.diameterIn >= 10 && p.diameterIn <= 13);

const tests = generateDemoBenchTests({ motor, battery, propellers });

describe('demo bench data', () => {
  it('generates one test per convergent propeller', () => {
    expect(tests.length).toBeGreaterThan(5);
    expect(tests.length).toBeLessThanOrEqual(propellers.length);
  });

  it('marks every generated test as demo data, and they are all detectable', () => {
    for (const t of tests) {
      expect(t.notes).toMatch(new RegExp(`^\\${DEMO_NOTE_PREFIX[0]}DEMO DATA\\]`));
      expect(isDemoTest(t)).toBe(true);
    }
  });

  it('is fully removable by the same predicate the UI uses', () => {
    const mixed = [...tests, { ...tests[0], id: 'real-1', notes: 'my own bench run' }];
    expect(mixed.filter((t) => !isDemoTest(t))).toHaveLength(1);
  });

  it('is deterministic — loading it twice gives identical numbers', () => {
    const again = generateDemoBenchTests({ motor, battery, propellers });
    expect(again.map((t) => t.measured.rpm)).toEqual(tests.map((t) => t.measured.rpm));
    expect(again.map((t) => t.measured.thrustKgF)).toEqual(tests.map((t) => t.measured.thrustKgF));
  });

  it('reproduces the model\'s documented failure mode: thrust predicted high', () => {
    for (const t of tests) {
      const { percentError } = predictionError(t.predicted.thrustKgF, t.measured.thrustKgF);
      expect(percentError!).toBeGreaterThan(0);
    }
  });

  it('makes the thrust bias grow with pitch ratio, so the history chart shows a trend', () => {
    const byPitchRatio = tests
      .map((t) => ({
        pr: pitchRatio(propellers.find((p) => p.id === t.propellerId)!),
        err: predictionError(t.predicted.thrustKgF, t.measured.thrustKgF).percentError!,
      }))
      .sort((a, b) => a.pr - b.pr);
    const flattest = byPitchRatio[0];
    const coarsest = byPitchRatio[byPitchRatio.length - 1];
    expect(coarsest.err).toBeGreaterThan(flattest.err);
  });

  it('keeps rpm and current errors small relative to thrust — the realistic pattern', () => {
    for (const t of tests) {
      const rpmErr = Math.abs(predictionError(t.predicted.rpm, t.measured.rpm).percentError!);
      expect(rpmErr).toBeLessThan(6);
    }
  });

  it('carries the full predicted result so error tables work offline', () => {
    expect(tests[0].predicted.diagnostics.converged).toBe(true);
    expect(tests[0].predicted.currentA).toBeGreaterThan(0);
  });
});
