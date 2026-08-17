/**
 * Regression tests — two kinds, kept apart on purpose.
 *
 * The distinction is easy to lose and expensive to lose:
 *
 *   a REGRESSION test asks   "did our software implementation change?"
 *   a VALIDATION test asks   "is the model actually right?"
 *
 * Everything in this file only ever asks the FIRST question. Nothing here can tell you whether
 * a prediction matches a real propeller — only bench measurements do that, and they live in the
 * app's test log, not in the test suite.
 *
 * 1. GOLDEN MASTER — committed outputs of the current engine for a fixed set of inputs. If a
 *    refactor changes a number, these fail and you find out immediately. They prove the code is
 *    stable, and they prove nothing about physics. The values were produced BY this engine, so
 *    treating them as evidence of correctness would be circular.
 *
 * 2. USER REFERENCE CASES — optional. Drop your own trusted calculations (Excel, Mathematica,
 *    a manufacturer's calculator) into fixtures/reference-cases.json and they run automatically
 *    with your stated tolerances. Empty by default: seeding invented "expected" values would
 *    make the suite green while proving nothing.
 */
import { describe, expect, it } from 'vitest';
import golden from '../fixtures/golden-master.json';
import fixtures from '../fixtures/reference-cases.json';
import { calculatePropulsion } from '../calculatePropulsion';
import type { Battery, Motor, Propeller } from '../types';
import { SEED_BATTERIES, SEED_MOTORS, SEED_PROPELLERS } from '../../data/hardware';

interface GoldenCase {
  motorId: string;
  batteryId: string;
  propellerId: string;
  rpm: number;
  thrustN: number;
  currentA: number;
  inputPowerW: number;
}

describe('golden master — does the implementation still produce the same numbers?', () => {
  const cases = (golden as { cases: GoldenCase[] }).cases;

  it('has committed cases to compare against', () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  it.each(cases)(
    'reproduces $motorId + $batteryId + $propellerId',
    (c: GoldenCase) => {
      const motor = SEED_MOTORS.find((m) => m.id === c.motorId)!;
      const battery = SEED_BATTERIES.find((b) => b.id === c.batteryId)!;
      const propeller = SEED_PROPELLERS.find((p) => p.id === c.propellerId)!;
      expect(motor && battery && propeller).toBeTruthy();

      const r = calculatePropulsion({ motor, battery, propeller });
      expect(r.diagnostics.converged).toBe(true);

      // Tight tolerances: this is a code-stability check, not a physics comparison. Any change
      // beyond floating-point noise means someone changed the model, deliberately or not.
      expect(r.rpm).toBeCloseTo(c.rpm, 2);
      expect(r.thrustN!).toBeCloseTo(c.thrustN, 6);
      expect(r.currentA!).toBeCloseTo(c.currentA, 6);
      expect(r.inputPowerW!).toBeCloseTo(c.inputPowerW, 5);
    },
  );
});

// ---------------------------------------------------------------------------------------------

interface ReferenceCase {
  name: string;
  source?: string;
  input: {
    motor: Motor;
    battery: Battery;
    propeller: Propeller;
    airDensityKgM3?: number;
    escResistanceOhm?: number;
    useFullyChargedVoltage?: boolean;
  };
  expected: { rpm?: number; thrustN?: number; thrustKgF?: number; currentA?: number };
  tolerances: { rpmPercent?: number; thrustPercent?: number; currentPercent?: number };
}

const userCases = (fixtures as { cases: ReferenceCase[] }).cases;

function withinPercent(actual: number, expected: number, tolerancePercent: number): boolean {
  if (expected === 0) return Math.abs(actual) <= tolerancePercent / 100;
  return Math.abs((actual - expected) / expected) * 100 <= tolerancePercent;
}

describe.skipIf(userCases.length === 0)(
  'user reference cases — does this engine agree with your own calculations?',
  () => {
    it.each(userCases)('reproduces $name', (c: ReferenceCase) => {
      const result = calculatePropulsion(c.input);
      expect(result.diagnostics.converged).toBe(true);

      if (c.expected.rpm !== undefined) {
        expect(
          withinPercent(result.rpm, c.expected.rpm, c.tolerances.rpmPercent ?? 0.5),
          `rpm ${result.rpm.toFixed(1)} vs expected ${c.expected.rpm}`,
        ).toBe(true);
      }
      if (c.expected.thrustN !== undefined) {
        expect(
          withinPercent(result.thrustN!, c.expected.thrustN, c.tolerances.thrustPercent ?? 1.0),
          `thrust ${result.thrustN!.toFixed(3)} N vs expected ${c.expected.thrustN} N`,
        ).toBe(true);
      }
      if (c.expected.thrustKgF !== undefined) {
        expect(
          withinPercent(result.thrustKgF!, c.expected.thrustKgF, c.tolerances.thrustPercent ?? 1.0),
          `thrust ${result.thrustKgF!.toFixed(3)} kgf vs expected ${c.expected.thrustKgF} kgf`,
        ).toBe(true);
      }
      if (c.expected.currentA !== undefined) {
        expect(
          withinPercent(result.currentA!, c.expected.currentA, c.tolerances.currentPercent ?? 1.0),
          `current ${result.currentA!.toFixed(2)} A vs expected ${c.expected.currentA} A`,
        ).toBe(true);
      }
    });
  },
);
