/**
 * Propeller aerodynamic model.
 *
 * The non-dimensional form is standard propeller physics and is not adjustable:
 *
 *   thrust  T = C_T * rho * n^2 * D^4      [N]
 *   power   P = C_P * rho * n^3 * D^5      [W]
 *   torque  Q = P / omega = C_P * rho * n^2 * D^5 / (2*pi)   [N*m]
 *
 * with n in rev/s and D in metres. What is NOT standard physics is where C_T and C_P come from.
 * Two suppliers exist, and which one was used is reported in the result:
 *
 *   1. PROP_DATA — measured or published coefficients attached to the propeller record. This is
 *      the trustworthy path (APC data, or Mark's own bench fit).
 *   2. PLACEHOLDER_PITCH_MODEL — a linear function of pitch ratio from the constant registry.
 *      Unfitted. Every result that uses it carries MODEL_UNCALIBRATED.
 *
 * Known limitation of the placeholder, stated rather than buried: a real propeller's static C_T
 * does not keep rising linearly with pitch ratio, because the blade sections stall at zero
 * advance. The placeholder therefore OVER-predicts static thrust for high-pitch props, and the
 * error grows with pitch. Comparisons at a fixed pitch are more trustworthy than comparisons
 * across a wide pitch sweep.
 */
import { CONSTANTS } from './constants';
import type { Propeller, Warning } from './types';
import { inchesToMetres, rpmToRevPerSec, rpmToRadPerSec } from '../units/units';

export interface Coefficients {
  ct: number;
  cp: number;
  source: 'PROP_DATA' | 'PLACEHOLDER_PITCH_MODEL';
  warnings: Warning[];
}

/** Pitch ratio p/D — the single geometric parameter the placeholder model keys on. */
export function pitchRatio(prop: Propeller): number {
  return prop.pitchIn / prop.diameterIn;
}

/** Blade-count scaling relative to the 2-blade reference. */
function bladeFactor(prop: Propeller): number {
  const blades = prop.bladeCount ?? 2;
  return Math.pow(blades / 2, CONSTANTS.bladeCountExponent.value);
}

/** Pitch ratios outside this band are extrapolation for the placeholder model. */
export const VALIDATED_PITCH_RATIO_RANGE = { min: 0.3, max: 0.9 } as const;

export function staticCoefficients(prop: Propeller): Coefficients {
  const warnings: Warning[] = [];

  if (prop.staticCoefficients) {
    return {
      ct: prop.staticCoefficients.ct,
      cp: prop.staticCoefficients.cp,
      source: 'PROP_DATA',
      warnings,
    };
  }

  const pr = pitchRatio(prop);
  const scale = bladeFactor(prop);
  const ct = (CONSTANTS.ctIntercept.value + CONSTANTS.ctPitchSlope.value * pr) * scale;
  const cp = (CONSTANTS.cpIntercept.value + CONSTANTS.cpPitchSlope.value * pr) * scale;

  warnings.push({
    code: 'MODEL_UNCALIBRATED',
    severity: 'WARNING',
    message:
      `No measured coefficients for ${prop.manufacturer} ${prop.model}; using the placeholder ` +
      `pitch-ratio model (p/D = ${pr.toFixed(3)}, C_T = ${ct.toFixed(4)}, C_P = ${cp.toFixed(4)}). ` +
      'These coefficients are unfitted engineering placeholders. Treat every absolute number ' +
      'below as provisional until bench-tested; relative comparisons between similar props are ' +
      'more trustworthy than the absolute values.',
  });

  if (pr < VALIDATED_PITCH_RATIO_RANGE.min || pr > VALIDATED_PITCH_RATIO_RANGE.max) {
    warnings.push({
      code: 'EXTRAPOLATED_OUTSIDE_VALIDATED_RANGE',
      severity: 'WARNING',
      message:
        `Pitch ratio ${pr.toFixed(3)} is outside the placeholder model's plausible band ` +
        `(${VALIDATED_PITCH_RATIO_RANGE.min}-${VALIDATED_PITCH_RATIO_RANGE.max}). The linear ` +
        'form has no support out here at all.',
    });
  }

  return { ct, cp, source: 'PLACEHOLDER_PITCH_MODEL', warnings };
}

export function diameterM(prop: Propeller): number {
  return inchesToMetres(prop.diameterIn);
}

/** T = C_T * rho * n^2 * D^4 */
export function propThrustN(rpm: number, prop: Propeller, rho: number, ct: number): number {
  const n = rpmToRevPerSec(rpm);
  const d = diameterM(prop);
  return ct * rho * n * n * Math.pow(d, 4);
}

/** P = C_P * rho * n^3 * D^5 */
export function propShaftPowerW(rpm: number, prop: Propeller, rho: number, cp: number): number {
  const n = rpmToRevPerSec(rpm);
  const d = diameterM(prop);
  return cp * rho * n * n * n * Math.pow(d, 5);
}

/**
 * Q = C_P * rho * n^2 * D^5 / (2*pi) — the torque the propeller demands, the other half of the
 * equilibrium problem. Computed from the coefficient directly rather than as P/omega so that
 * rpm = 0 gives exactly 0 instead of 0/0.
 */
export function propTorqueNm(rpm: number, prop: Propeller, rho: number, cp: number): number {
  const n = rpmToRevPerSec(rpm);
  const d = diameterM(prop);
  return (cp * rho * n * n * Math.pow(d, 5)) / (2 * Math.PI);
}

/** Consistency helper: torque and speed back to mechanical power. */
export function mechanicalPowerW(torqueNm: number, rpm: number): number {
  return torqueNm * rpmToRadPerSec(rpm);
}
