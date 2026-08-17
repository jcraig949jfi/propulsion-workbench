/**
 * Behavioural tests for the top-level API.
 *
 * Again: properties and directions, not absolute magnitudes. The assertions here are the ones
 * Mark's physical intuition would make — a bigger prop must load the motor harder, more pitch
 * must pull the RPM down, sag must reduce everything — plus the guarantees that make the
 * function safe to build a UI on top of.
 */
import { describe, expect, it } from 'vitest';
import { calculatePropulsion, predictionError } from '../calculatePropulsion';
import type { Battery, Motor, Propeller, PropulsionInput } from '../types';

const motor: Motor = {
  id: 'm',
  manufacturer: 'Test',
  model: '700kv outrunner',
  kvRpmPerVolt: 700,
  resistanceOhm: 0.05,
  noLoadCurrentA: 1.2,
  maxCurrentA: 45,
  maxPowerW: 700,
};

const battery: Battery = {
  id: 'b',
  name: '4S 5000',
  cells: 4,
  capacityMah: 5000,
  nominalVoltageV: 14.8,
  fullyChargedVoltageV: 16.8,
  internalResistanceOhm: 0.012,
  maxContinuousCurrentA: 100,
};

const prop = (d: number, p: number): Propeller => ({
  id: `${d}x${p}`,
  manufacturer: 'Test',
  model: `${d}x${p}`,
  diameterIn: d,
  pitchIn: p,
  bladeCount: 2,
});

const run = (p: Propeller, extra: Partial<PropulsionInput> = {}) =>
  calculatePropulsion({ motor, battery, propeller: p, ...extra });

describe('calculatePropulsion', () => {
  it('converges and returns a physically ordered operating point', () => {
    const r = run(prop(13, 6));
    expect(r.diagnostics.converged).toBe(true);
    expect(r.rpm).toBeGreaterThan(0);
    // The loaded point must sit strictly below unloaded speed — the whole reason the solver exists.
    expect(r.rpm).toBeLessThan(battery.nominalVoltageV * motor.kvRpmPerVolt);
    expect(r.currentA!).toBeGreaterThan(0);
    expect(r.thrustN!).toBeGreaterThan(0);
    expect(r.loadedVoltageV!).toBeLessThan(battery.nominalVoltageV);
  });

  it('never reports Kv * volts as the answer', () => {
    const r = run(prop(13, 6));
    const unloaded = battery.nominalVoltageV * motor.kvRpmPerVolt;
    expect(Math.abs(r.rpm - unloaded)).toBeGreaterThan(unloaded * 0.05);
  });

  it('satisfies torque balance at the reported point', () => {
    const r = run(prop(13, 6));
    // Mechanical power computed from torque and speed must match the reported value.
    const omega = (r.rpm * 2 * Math.PI) / 60;
    expect(r.torqueNm! * omega).toBeCloseTo(r.mechanicalPowerW!, 6);
  });

  it('keeps electrical bookkeeping consistent', () => {
    const r = run(prop(13, 6));
    expect(r.inputPowerW!).toBeCloseTo(r.loadedVoltageV! * r.currentA!, 9);
    expect(r.mechanicalPowerW!).toBeLessThan(r.inputPowerW!); // losses are strictly positive
    expect(r.motorEfficiency!).toBeGreaterThan(0);
    expect(r.motorEfficiency!).toBeLessThan(1);
  });

  it('a larger diameter lowers rpm and raises current and thrust', () => {
    const small = run(prop(12, 6));
    const large = run(prop(14, 6));
    expect(large.rpm).toBeLessThan(small.rpm);
    expect(large.currentA!).toBeGreaterThan(small.currentA!);
    expect(large.thrustN!).toBeGreaterThan(small.thrustN!);
  });

  it('more pitch at fixed diameter lowers rpm and raises current', () => {
    const flat = run(prop(13, 5));
    const coarse = run(prop(13, 8));
    expect(coarse.rpm).toBeLessThan(flat.rpm);
    expect(coarse.currentA!).toBeGreaterThan(flat.currentA!);
  });

  it('a fully charged pack gives more of everything than a nominal one', () => {
    const nominal = run(prop(13, 6));
    const charged = run(prop(13, 6), { useFullyChargedVoltage: true });
    expect(charged.rpm).toBeGreaterThan(nominal.rpm);
    expect(charged.currentA!).toBeGreaterThan(nominal.currentA!);
    expect(charged.thrustN!).toBeGreaterThan(nominal.thrustN!);
  });

  it('thinner air reduces load, so rpm rises and thrust falls', () => {
    const sea = run(prop(13, 6));
    const altitude = run(prop(13, 6), { airDensityKgM3: 1.0 });
    expect(altitude.rpm).toBeGreaterThan(sea.rpm);
    expect(altitude.thrustN!).toBeLessThan(sea.thrustN!);
  });

  it('reports static figures of merit but NOT propulsive efficiency', () => {
    const r = run(prop(13, 6));
    expect(r.propEfficiency).toBeUndefined(); // zero airspeed => identically zero, so omitted
    expect(r.staticThrustPerShaftWattNPerW!).toBeGreaterThan(0);
    expect(r.staticThrustPerInputWattNPerW!).toBeLessThan(r.staticThrustPerShaftWattNPerW!);
  });

  it('refuses to guess when winding resistance is missing', () => {
    const noR: Motor = { ...motor, resistanceOhm: undefined };
    const r = calculatePropulsion({ motor: noR, battery, propeller: prop(13, 6) });
    expect(Number.isNaN(r.rpm)).toBe(true);
    expect(r.diagnostics.converged).toBe(false);
    expect(r.warnings.map((w) => w.code)).toContain('MISSING_MOTOR_PARAMETER');
    expect(r.thrustN).toBeUndefined();
  });

  it('warns, rather than stays silent, when no-load current is unknown', () => {
    const noI0: Motor = { ...motor, noLoadCurrentA: undefined };
    const r = calculatePropulsion({ motor: noI0, battery, propeller: prop(13, 6) });
    expect(r.diagnostics.converged).toBe(true);
    expect(r.warnings.map((w) => w.code)).toContain('MISSING_MOTOR_PARAMETER');
  });

  it('warns when the pack has no measured internal resistance', () => {
    const noIr: Battery = { ...battery, internalResistanceOhm: undefined };
    const r = calculatePropulsion({ motor, battery: noIr, propeller: prop(13, 6) });
    expect(r.warnings.map((w) => w.code)).toContain('MISSING_BATTERY_PARAMETER');
    expect(r.loadedVoltageV).toBeCloseTo(battery.nominalVoltageV, 9); // no sag modelled
  });

  it('raises an error-severity warning when the motor current rating is exceeded', () => {
    const r = run(prop(17, 10)); // deliberately over-propped
    const codes = r.warnings.map((w) => w.code);
    expect(codes).toContain('MOTOR_CURRENT_EXCEEDED');
    expect(r.warnings.find((w) => w.code === 'MOTOR_CURRENT_EXCEEDED')!.severity).toBe('ERROR');
  });

  it('always states which coefficients were used and where they came from', () => {
    const r = run(prop(13, 6));
    expect(r.coefficientsUsed!.source).toBe('PLACEHOLDER_PITCH_MODEL');
    expect(r.warnings.map((w) => w.code)).toContain('MODEL_UNCALIBRATED');

    const withData: Propeller = { ...prop(13, 6), staticCoefficients: { ct: 0.11, cp: 0.045 } };
    const r2 = run(withData);
    expect(r2.coefficientsUsed!.source).toBe('PROP_DATA');
    expect(r2.warnings.map((w) => w.code)).not.toContain('MODEL_UNCALIBRATED');
  });

  it('flags ASSUMED hardware records as unverified', () => {
    const assumed: Motor = { ...motor, dataClass: 'ASSUMED' };
    const r = calculatePropulsion({ motor: assumed, battery, propeller: prop(13, 6) });
    expect(r.warnings.map((w) => w.code)).toContain('UNVERIFIED_INPUT_DATA');
  });

  it('is pure — repeated calls give identical results and no shared state', () => {
    const a = run(prop(13, 6));
    const b = run(prop(13, 6));
    expect(a.rpm).toBe(b.rpm);
    expect(a.currentA).toBe(b.currentA);
  });
});

describe('predictionError', () => {
  it('computes absolute and percentage error with prediction-minus-measurement sign', () => {
    const e = predictionError(7840, 7710);
    expect(e.absoluteError).toBe(130);
    expect(e.percentError).toBeCloseTo((130 / 7710) * 100, 9);
  });

  it('reports a negative error when the prediction is low', () => {
    const e = predictionError(37.2, 39.0);
    expect(e.absoluteError).toBeCloseTo(-1.8, 9);
    expect(e.percentError!).toBeLessThan(0);
  });

  it('returns nothing when either side is missing or non-finite', () => {
    expect(predictionError(undefined, 10)).toEqual({});
    expect(predictionError(10, undefined)).toEqual({});
    expect(predictionError(Number.NaN, 10)).toEqual({});
  });

  it('omits percentage error when the measurement is zero', () => {
    const e = predictionError(5, 0);
    expect(e.absoluteError).toBe(5);
    expect(e.percentError).toBeUndefined();
  });
});
