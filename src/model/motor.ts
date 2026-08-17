/**
 * First-order brushless motor model — the standard three-parameter (Kv, Rm, I0) treatment.
 *
 * These relations are PHYSICS, not fitted curves:
 *
 *   back-EMF        V_emf = rpm / Kv                      (definition of Kv)
 *   torque constant Kt    = 60 / (2*pi*Kv)   [N*m/A]      (consistency of Kv and Kt in SI)
 *   winding current I     = (V_terminal - V_emf) / Rm
 *   shaft torque    Q     = Kt * (I - I0)
 *
 * The one modelling simplification worth naming: I0 is treated as constant, whereas real
 * no-load current rises with RPM (iron and windage losses grow). That makes the model slightly
 * optimistic about shaft torque at high RPM. It is a known, bounded error, not a hidden one.
 */
import type { Motor, Warning } from './types';

/** Torque constant in N*m/A from Kv in rpm/V. Exact SI consistency relation. */
export function torqueConstantNmPerA(kvRpmPerVolt: number): number {
  if (kvRpmPerVolt <= 0) throw new Error('kv must be positive');
  return 60 / (2 * Math.PI * kvRpmPerVolt);
}

/** Back-EMF at a given shaft speed. */
export function backEmfV(rpm: number, kvRpmPerVolt: number): number {
  return rpm / kvRpmPerVolt;
}

/** Unloaded speed: the speed at which back-EMF equals the applied voltage. Not an operating point. */
export function noLoadRpm(terminalVoltageV: number, kvRpmPerVolt: number): number {
  return terminalVoltageV * kvRpmPerVolt;
}

/**
 * Current drawn at a given RPM, given the battery open-circuit voltage and the TOTAL series
 * resistance (motor + battery + ESC). Solving the loop equation
 *   V_oc = I*(R_batt + R_esc) + I*R_m + rpm/Kv
 * for I gives a single expression, which is why sag does not need a separate iteration.
 */
export function currentAtRpmA(
  rpm: number,
  openCircuitVoltageV: number,
  kvRpmPerVolt: number,
  totalSeriesResistanceOhm: number,
): number {
  if (totalSeriesResistanceOhm <= 0) throw new Error('total series resistance must be positive');
  const drive = openCircuitVoltageV - backEmfV(rpm, kvRpmPerVolt);
  return drive / totalSeriesResistanceOhm;
}

/** Shaft torque available at a given current. */
export function shaftTorqueNm(currentA: number, motor: Motor): number {
  const kt = torqueConstantNmPerA(motor.kvRpmPerVolt);
  const i0 = motor.noLoadCurrentA ?? 0;
  return kt * (currentA - i0);
}

/** Motor shaft torque as a function of RPM — one half of the equilibrium problem. */
export function motorTorqueAtRpmNm(
  rpm: number,
  motor: Motor,
  openCircuitVoltageV: number,
  totalSeriesResistanceOhm: number,
): number {
  const i = currentAtRpmA(rpm, openCircuitVoltageV, motor.kvRpmPerVolt, totalSeriesResistanceOhm);
  return shaftTorqueNm(i, motor);
}

/**
 * Which required parameters are missing. Kv alone is not enough to find a loaded operating
 * point: without winding resistance there is no relation between load and speed at all.
 */
export function missingMotorParameters(motor: Motor): Warning[] {
  const out: Warning[] = [];
  if (motor.resistanceOhm === undefined) {
    out.push({
      code: 'MISSING_MOTOR_PARAMETER',
      severity: 'ERROR',
      message:
        `${motor.manufacturer} ${motor.model}: winding resistance (Rm) is unknown. Loaded RPM ` +
        'cannot be computed without it — Kv alone only gives unloaded speed. Measure it with a ' +
        'milliohm meter across two leads, or take it from the datasheet.',
    });
  }
  if (motor.noLoadCurrentA === undefined) {
    out.push({
      code: 'MISSING_MOTOR_PARAMETER',
      severity: 'WARNING',
      message:
        `${motor.manufacturer} ${motor.model}: no-load current (I0) is unknown; treated as 0 A. ` +
        'This over-predicts shaft torque slightly, so predicted RPM and thrust run high.',
    });
  }
  return out;
}
