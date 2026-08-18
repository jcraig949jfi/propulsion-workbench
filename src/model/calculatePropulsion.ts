/**
 * The one function the whole application exists to provide (spec §7, §26).
 *
 *   known motor + known battery + known propeller  ->  predicted RPM, thrust, current
 *
 * Pure. No React, no browser API, no module-level state. An optimiser can call it in a loop.
 */
import { CONSTANTS } from './constants';
import type { PropulsionInput, PropulsionResult, Warning } from './types';
import {
  currentAtRpmA,
  missingMotorParameters,
  motorTorqueAtRpmNm,
  noLoadRpm,
} from './motor';
import {
  cRate,
  loadedVoltageV,
  missingBatteryParameters,
  openCircuitVoltageV,
} from './battery';
import {
  mechanicalPowerW,
  propShaftPowerW,
  propThrustN,
  propTorqueNm,
  staticCoefficients,
} from './propAero';
import { bisect } from './solver';
import { newtonsToKgf } from '../units/units';

function unsolved(warnings: Warning[], message: string): PropulsionResult {
  return {
    rpm: Number.NaN,
    warnings,
    diagnostics: { converged: false, iterations: 0, message },
  };
}

export function calculatePropulsion(input: PropulsionInput): PropulsionResult {
  const { motor, battery, propeller } = input;
  const rho = input.airDensityKgM3 ?? CONSTANTS.airDensitySeaLevelIsa.value;
  const escR = input.escResistanceOhm ?? CONSTANTS.escResistanceOhm.value;
  const useFull = input.useFullyChargedVoltage ?? false;

  const warnings: Warning[] = [
    ...missingMotorParameters(motor),
    ...missingBatteryParameters(battery),
  ];

  // Data-hygiene flag: an ASSUMED input is not an error, but it must not masquerade as a spec.
  // EXAMPLE records are exempt — they are labelled "Example" everywhere they appear, so a
  // per-calculation warning would be noise rather than information.
  for (const [label, item] of [
    ['motor', motor],
    ['battery', battery],
    ['propeller', propeller],
  ] as const) {
    if (item.dataClass === 'ASSUMED') {
      warnings.push({
        code: 'UNVERIFIED_INPUT_DATA',
        severity: 'INFO',
        message:
          `The ${label} record is marked ASSUMED — its numbers are stand-ins that have not been ` +
          'confirmed. Verify against the datasheet or a measurement before trusting the output.',
      });
    }
  }

  // Hard stop: without winding resistance there is no load/speed relation to solve.
  if (motor.resistanceOhm === undefined) {
    return unsolved(
      warnings,
      'motor winding resistance unknown — no loaded operating point exists to solve for',
    );
  }

  const rTotal = motor.resistanceOhm + (battery.internalResistanceOhm ?? 0) + escR;
  if (!(rTotal > 0)) {
    return unsolved(
      warnings,
      'total series resistance is zero — the model would predict infinite stall current',
    );
  }

  const vOc = openCircuitVoltageV(battery, useFull, input.packVoltageV);
  const coeff = staticCoefficients(propeller);
  warnings.push(...coeff.warnings);

  // ---- solve motorTorque(rpm) - propTorque(rpm) = 0 over a physically bounded bracket -----
  const hi = noLoadRpm(vOc, motor.kvRpmPerVolt);
  const torqueBalance = (rpm: number): number =>
    motorTorqueAtRpmNm(rpm, motor, vOc, rTotal) - propTorqueNm(rpm, propeller, rho, coeff.cp);

  const { x: rpm, diagnostics } = bisect(torqueBalance, 0, hi, {
    toleranceX: 0.01, // 0.01 rpm — far finer than any tachometer
    toleranceF: 1e-9, // N*m
  });

  if (!diagnostics.converged || !Number.isFinite(rpm)) {
    warnings.push({
      code: 'SOLVER_DID_NOT_CONVERGE',
      severity: 'ERROR',
      message:
        'The torque-balance solver did not converge, so no operating point is reported. ' +
        (diagnostics.message ?? ''),
    });
    return { rpm: Number.NaN, warnings, diagnostics, coefficientsUsed: { ct: coeff.ct, cp: coeff.cp, source: coeff.source } };
  }

  // ---- derived quantities at the operating point -------------------------------------------
  const currentA = currentAtRpmA(rpm, vOc, motor.kvRpmPerVolt, rTotal);
  const vLoaded = loadedVoltageV(battery, currentA, useFull, input.packVoltageV);
  const torqueNm = propTorqueNm(rpm, propeller, rho, coeff.cp);
  const thrustN = propThrustN(rpm, propeller, rho, coeff.ct);
  const shaftPowerW = propShaftPowerW(rpm, propeller, rho, coeff.cp);
  const mechPowerW = mechanicalPowerW(torqueNm, rpm);

  // Electrical input power measured at the battery terminals under load, which is what a watt
  // meter in the pack lead reads.
  const inputPowerW = vLoaded * currentA;
  const motorEfficiency = inputPowerW > 0 ? mechPowerW / inputPowerW : undefined;

  // ---- limit checks (spec §9) ---------------------------------------------------------------
  if (motor.maxCurrentA !== undefined && currentA > motor.maxCurrentA) {
    const overPct = ((currentA / motor.maxCurrentA - 1) * 100).toFixed(1);
    warnings.push({
      code: 'MOTOR_CURRENT_EXCEEDED',
      severity: 'ERROR',
      message:
        `Predicted current ${currentA.toFixed(1)} A exceeds the motor's rated maximum ` +
        `${motor.maxCurrentA} A by ${overPct}%. Note that manufacturers often quote this as a ` +
        'burst rating with a time limit — check the datasheet for the duration.',
    });
  }
  if (motor.maxPowerW !== undefined && inputPowerW > motor.maxPowerW) {
    const overPct = ((inputPowerW / motor.maxPowerW - 1) * 100).toFixed(1);
    warnings.push({
      code: 'MOTOR_POWER_EXCEEDED',
      severity: 'ERROR',
      message:
        `Predicted input power ${inputPowerW.toFixed(0)} W exceeds the motor's rating ` +
        `${motor.maxPowerW} W by ${overPct}%.`,
    });
  }
  if (battery.maxContinuousCurrentA !== undefined && currentA > battery.maxContinuousCurrentA) {
    warnings.push({
      code: 'BATTERY_CURRENT_EXCEEDED',
      severity: 'ERROR',
      message:
        `Predicted current ${currentA.toFixed(1)} A exceeds the pack's continuous rating ` +
        `${battery.maxContinuousCurrentA} A (${cRate(battery, currentA).toFixed(1)}C).`,
    });
  }

  return {
    rpm,
    thrustN,
    thrustKgF: newtonsToKgf(thrustN),
    currentA,
    inputPowerW,
    mechanicalPowerW: mechPowerW,
    torqueNm,
    loadedVoltageV: vLoaded,
    packVoltageV: vOc,
    motorEfficiency,
    // propEfficiency intentionally omitted — it is identically zero at zero airspeed.
    staticThrustPerShaftWattNPerW: shaftPowerW > 0 ? thrustN / shaftPowerW : undefined,
    staticThrustPerInputWattNPerW: inputPowerW > 0 ? thrustN / inputPowerW : undefined,
    warnings,
    diagnostics,
    coefficientsUsed: { ct: coeff.ct, cp: coeff.cp, source: coeff.source },
  };
}

/** Percentage and absolute error between a prediction and a measurement (spec §13). */
export function predictionError(
  predicted: number | undefined,
  measured: number | undefined,
): { absoluteError?: number; percentError?: number } {
  if (predicted === undefined || measured === undefined) return {};
  if (!Number.isFinite(predicted) || !Number.isFinite(measured)) return {};
  const absoluteError = predicted - measured;
  const percentError = measured !== 0 ? (absoluteError / measured) * 100 : undefined;
  return { absoluteError, percentError };
}
