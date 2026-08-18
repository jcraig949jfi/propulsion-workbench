/**
 * Battery model — deliberately simple, per spec §2: a source voltage behind an internal
 * resistance. That is enough to produce voltage sag under load, which is the effect that
 * matters for a static thrust prediction.
 *
 * Not modelled yet, and each is a separate future step rather than a redesign:
 *   - state of charge (voltage falls through the flight)
 *   - IR rise as the pack ages or gets cold
 *   - per-cell imbalance
 *
 * The architecture supports them because everything downstream asks only two questions of a
 * pack: what is your open-circuit voltage, and what is your series resistance.
 */
import type { Battery, Warning } from './types';

/**
 * Open-circuit (no-load) voltage. Defaults to NOMINAL rather than fully charged: nominal is the
 * honest average over a flight, and using a hot-off-the-charger 4.2 V/cell flatters every
 * prediction. Mark can switch to fully-charged for bench comparisons, which is what a bench
 * test at the start of a pack actually measures.
 */
export function openCircuitVoltageV(
  battery: Battery,
  useFullyCharged = false,
  overrideV?: number,
): number {
  if (overrideV !== undefined && Number.isFinite(overrideV) && overrideV > 0) return overrideV;
  if (useFullyCharged && battery.fullyChargedVoltageV !== undefined) {
    return battery.fullyChargedVoltageV;
  }
  return battery.nominalVoltageV;
}

/** Volts per cell — the number modellers actually reason about (4.2 full, 3.7 nominal, 3.3 low). */
export function voltsPerCell(battery: Battery, packVoltageV: number): number {
  return battery.cells > 0 ? packVoltageV / battery.cells : Number.NaN;
}

/** Sensible slider bounds: 3.0 V/cell (about empty) to 4.2 V/cell (fresh off the charger). */
export const CELL_V_MIN = 3.0;
export const CELL_V_NOMINAL = 3.7;
export const CELL_V_FULL = 4.2;

/** Terminal voltage under load: V = V_oc - I * R_internal. */
export function loadedVoltageV(
  battery: Battery,
  currentA: number,
  useFullyCharged = false,
  overrideV?: number,
): number {
  const ir = battery.internalResistanceOhm ?? 0;
  return openCircuitVoltageV(battery, useFullyCharged, overrideV) - currentA * ir;
}

/** C-rate the pack is being asked for — the number that tells you if a pack is being abused. */
export function cRate(battery: Battery, currentA: number): number {
  const capacityA = battery.capacityMah / 1000;
  return capacityA > 0 ? currentA / capacityA : Number.NaN;
}

export function missingBatteryParameters(battery: Battery): Warning[] {
  const out: Warning[] = [];
  if (battery.internalResistanceOhm === undefined) {
    out.push({
      code: 'MISSING_BATTERY_PARAMETER',
      severity: 'WARNING',
      message:
        `${battery.name}: internal resistance is unknown; treated as 0 ohm, i.e. no voltage sag. ` +
        'Predicted RPM, current and thrust will all run high. A 4S 5000 mAh pack in good health ' +
        'is typically a few milliohm per cell — measure it rather than adopting that number.',
    });
  }
  return out;
}
