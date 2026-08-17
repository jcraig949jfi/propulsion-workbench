import { describe, expect, it } from 'vitest';
import * as U from './units';

describe('unit conversions', () => {
  it('uses the exact international inch', () => {
    expect(U.inchesToMetres(1)).toBe(0.0254);
    expect(U.inchesToMetres(13)).toBeCloseTo(0.3302, 10);
  });

  it('round-trips length', () => {
    expect(U.metresToInches(U.inchesToMetres(13.5))).toBeCloseTo(13.5, 12);
  });

  it('converts rpm to rev/s and rad/s consistently', () => {
    expect(U.rpmToRevPerSec(6000)).toBe(100);
    expect(U.rpmToRadPerSec(60)).toBeCloseTo(2 * Math.PI, 12);
    expect(U.radPerSecToRpm(U.rpmToRadPerSec(7840))).toBeCloseTo(7840, 9);
  });

  it('treats kgf as a force, not a mass', () => {
    // 1 kgf is the weight of 1 kg under standard gravity.
    expect(U.kgfToNewtons(1)).toBeCloseTo(9.80665, 10);
    expect(U.newtonsToKgf(9.80665)).toBeCloseTo(1, 12);
  });

  it('converts pounds and ounces force', () => {
    expect(U.poundsForceToNewtons(1)).toBeCloseTo(4.4482216152605, 12);
    expect(U.newtonsToOuncesForce(U.ouncesForceToNewtons(37))).toBeCloseTo(37, 10);
    // 16 ozf must equal 1 lbf exactly through the conversion chain.
    expect(U.ouncesForceToNewtons(16)).toBeCloseTo(U.poundsForceToNewtons(1), 12);
  });

  it('round-trips mass and speed', () => {
    expect(U.kgToGrams(U.gramsToKg(2500))).toBeCloseTo(2500, 9);
    expect(U.metresPerSecToMph(U.mphToMetresPerSec(60))).toBeCloseTo(60, 10);
  });

  it('formats unknown values as an em dash rather than 0 or NaN', () => {
    expect(U.fmt(undefined)).toBe('—');
    expect(U.fmt(Number.NaN)).toBe('—');
    expect(U.fmtInt(undefined)).toBe('—');
    expect(U.fmtInt(7840)).toBe((7840).toLocaleString());
  });
});
