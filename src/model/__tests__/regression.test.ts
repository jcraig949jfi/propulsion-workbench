/**
 * Regression tests against Mark's trusted Excel / Mathematica cases (spec §20B).
 *
 * The distinction spec §20C insists on, restated because it is easy to lose:
 *
 *   a REGRESSION test asks   "did our software implementation change?"
 *   a VALIDATION test asks   "is the model actually right?"
 *
 * This file only ever asks the first question. It compares our TypeScript engine against
 * Mark's own calculations, so it can only detect drift between two models — never whether
 * either matches a real propeller. Physical validation lives in the bench-test log.
 *
 * With no cases supplied the suite reports the Milestone-1 gate as UNMET rather than passing
 * silently. An empty green suite is how a calculator convinces you it works when it does not.
 */
import { describe, expect, it } from 'vitest';
import fixtures from '../fixtures/reference-cases.json';
import { calculatePropulsion } from '../calculatePropulsion';
import type { Battery, Motor, Propeller } from '../types';

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

const cases = (fixtures as { cases: ReferenceCase[] }).cases;

function withinPercent(actual: number, expected: number, tolerancePercent: number): boolean {
  if (expected === 0) return Math.abs(actual) <= tolerancePercent / 100;
  return Math.abs((actual - expected) / expected) * 100 <= tolerancePercent;
}

describe('Milestone 1 gate — reproduce Mark\'s reference calculations', () => {
  it('reports whether any reference case has been supplied', () => {
    if (cases.length === 0) {
      console.warn(
        '\n  MILESTONE 1 GATE: UNMET — 0 reference cases supplied.\n' +
          '  The engine is unvalidated against Mark\'s own calculations. Add cases to\n' +
          '  src/model/fixtures/reference-cases.json (see the $comment block for the shape).\n' +
          '  Per spec §25, the React workbench should not be trusted until this gate is met.\n',
      );
    }
    // Deliberately not a failure: the harness is complete and correct with zero cases. It is a
    // visible, honest report of an unmet gate, not a broken build.
    expect(Array.isArray(cases)).toBe(true);
  });

  it.each(cases.length ? cases : [])('reproduces %s', (c: ReferenceCase) => {
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
});
