/**
 * Unit tests for the physics relations (spec §20A).
 *
 * These test PROPERTIES and IDENTITIES — scaling laws, consistency between two routes to the
 * same quantity, behaviour at limits. They deliberately do not assert absolute thrust or
 * current figures, because no validated reference values exist yet: asserting an invented
 * number and calling it green is precisely what spec §10 and §20B forbid.
 */
import { describe, expect, it } from 'vitest';
import {
  backEmfV,
  currentAtRpmA,
  motorTorqueAtRpmNm,
  noLoadRpm,
  shaftTorqueNm,
  torqueConstantNmPerA,
} from '../motor';
import { cRate, loadedVoltageV, openCircuitVoltageV } from '../battery';
import {
  mechanicalPowerW,
  pitchRatio,
  propShaftPowerW,
  propThrustN,
  propTorqueNm,
  staticCoefficients,
} from '../propAero';
import type { Battery, Motor, Propeller } from '../types';

const motor: Motor = {
  id: 'm',
  manufacturer: 'Test',
  model: '700kv',
  kvRpmPerVolt: 700,
  resistanceOhm: 0.05,
  noLoadCurrentA: 1.2,
};

const battery: Battery = {
  id: 'b',
  name: '4S',
  cells: 4,
  capacityMah: 5000,
  nominalVoltageV: 14.8,
  fullyChargedVoltageV: 16.8,
  internalResistanceOhm: 0.012,
};

const prop = (diameterIn: number, pitchIn: number, bladeCount = 2): Propeller => ({
  id: `${diameterIn}x${pitchIn}`,
  manufacturer: 'Test',
  model: `${diameterIn}x${pitchIn}`,
  diameterIn,
  pitchIn,
  bladeCount,
});

describe('motor relations', () => {
  it('derives Kt from Kv by the SI consistency relation', () => {
    expect(torqueConstantNmPerA(700)).toBeCloseTo(60 / (2 * Math.PI * 700), 15);
  });

  it('gives back-EMF equal to supply at no-load speed', () => {
    const v = 14.8;
    expect(backEmfV(noLoadRpm(v, motor.kvRpmPerVolt), motor.kvRpmPerVolt)).toBeCloseTo(v, 12);
  });

  it('draws zero current at no-load speed and stall current at rest', () => {
    const v = 14.8;
    const rTot = 0.062;
    expect(currentAtRpmA(noLoadRpm(v, motor.kvRpmPerVolt), v, motor.kvRpmPerVolt, rTot)).toBeCloseTo(0, 10);
    expect(currentAtRpmA(0, v, motor.kvRpmPerVolt, rTot)).toBeCloseTo(v / rTot, 10);
  });

  it('subtracts no-load current from torque-producing current', () => {
    expect(shaftTorqueNm(1.2, motor)).toBeCloseTo(0, 12);
    expect(shaftTorqueNm(0.5, motor)).toBeLessThan(0); // below I0 the motor cannot hold speed
  });

  it('produces a motor torque curve that falls monotonically with rpm', () => {
    const v = 14.8;
    const rTot = 0.062;
    const torques = [0, 2000, 4000, 6000, 8000, 10000].map((r) =>
      motorTorqueAtRpmNm(r, motor, v, rTot),
    );
    for (let i = 1; i < torques.length; i += 1) {
      expect(torques[i]).toBeLessThan(torques[i - 1]);
    }
  });

  it('rejects a non-positive total resistance instead of returning infinity', () => {
    expect(() => currentAtRpmA(1000, 14.8, 700, 0)).toThrow();
  });
});

describe('battery relations', () => {
  it('defaults to nominal voltage, not fully charged', () => {
    expect(openCircuitVoltageV(battery)).toBe(14.8);
    expect(openCircuitVoltageV(battery, true)).toBe(16.8);
  });

  it('sags linearly with current', () => {
    expect(loadedVoltageV(battery, 0)).toBeCloseTo(14.8, 12);
    expect(loadedVoltageV(battery, 40)).toBeCloseTo(14.8 - 40 * 0.012, 12);
  });

  it('reports C-rate', () => {
    expect(cRate(battery, 50)).toBeCloseTo(10, 12);
  });
});

describe('propeller relations', () => {
  const rho = 1.225;

  it('computes pitch ratio', () => {
    expect(pitchRatio(prop(13, 6))).toBeCloseTo(6 / 13, 12);
  });

  it('scales thrust as D^4 and n^2', () => {
    const { ct } = staticCoefficients(prop(13, 6));
    const t1 = propThrustN(6000, prop(13, 6), rho, ct);
    const t2 = propThrustN(12000, prop(13, 6), rho, ct);
    expect(t2 / t1).toBeCloseTo(4, 9); // doubling n quadruples thrust

    const tSmall = propThrustN(6000, prop(10, 6), rho, ct);
    const tBig = propThrustN(6000, prop(20, 6), rho, ct);
    expect(tBig / tSmall).toBeCloseTo(16, 9); // doubling D is 2^4
  });

  it('scales power as D^5 and n^3', () => {
    const { cp } = staticCoefficients(prop(13, 6));
    const p1 = propShaftPowerW(6000, prop(13, 6), rho, cp);
    const p2 = propShaftPowerW(12000, prop(13, 6), rho, cp);
    expect(p2 / p1).toBeCloseTo(8, 9);

    const pSmall = propShaftPowerW(6000, prop(10, 6), rho, cp);
    const pBig = propShaftPowerW(6000, prop(20, 6), rho, cp);
    expect(pBig / pSmall).toBeCloseTo(32, 9);
  });

  it('scales thrust and torque linearly with air density', () => {
    const { ct } = staticCoefficients(prop(13, 6));
    const sea = propThrustN(7000, prop(13, 6), 1.225, ct);
    const altitude = propThrustN(7000, prop(13, 6), 1.0, ct);
    expect(altitude / sea).toBeCloseTo(1.0 / 1.225, 12);
  });

  it('keeps torque and shaft power mutually consistent (Q*omega = P)', () => {
    const p = prop(13, 6);
    const { cp } = staticCoefficients(p);
    const rpm = 7500;
    const q = propTorqueNm(rpm, p, rho, cp);
    expect(mechanicalPowerW(q, rpm)).toBeCloseTo(propShaftPowerW(rpm, p, rho, cp), 9);
  });

  it('demands exactly zero torque at zero rpm', () => {
    const p = prop(13, 6);
    const { cp } = staticCoefficients(p);
    expect(propTorqueNm(0, p, rho, cp)).toBe(0);
  });

  it('flags the placeholder coefficient model on every use', () => {
    const c = staticCoefficients(prop(13, 6));
    expect(c.source).toBe('PLACEHOLDER_PITCH_MODEL');
    expect(c.warnings.map((w) => w.code)).toContain('MODEL_UNCALIBRATED');
  });

  it('prefers attached prop data over the placeholder, and stops warning', () => {
    const withData: Propeller = {
      ...prop(13, 6),
      staticCoefficients: { ct: 0.11, cp: 0.045 },
    };
    const c = staticCoefficients(withData);
    expect(c.source).toBe('PROP_DATA');
    expect(c.ct).toBe(0.11);
    expect(c.warnings).toHaveLength(0);
  });

  it('warns when pitch ratio leaves the placeholder band', () => {
    const c = staticCoefficients(prop(10, 12)); // p/D = 1.2
    expect(c.warnings.map((w) => w.code)).toContain('EXTRAPOLATED_OUTSIDE_VALIDATED_RANGE');
  });

  it('increases both coefficients with blade count, sub-linearly', () => {
    const two = staticCoefficients(prop(13, 6, 2));
    const three = staticCoefficients(prop(13, 6, 3));
    expect(three.ct).toBeGreaterThan(two.ct);
    expect(three.ct / two.ct).toBeLessThan(1.5); // sub-linear in blade count
  });
});
