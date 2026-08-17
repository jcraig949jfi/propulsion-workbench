/**
 * Model constant registry.
 *
 * Spec §6: "Avoid hidden empirical magic numbers. Each meaningful model constant should have
 * name, value, units, origin/source, explanation."
 *
 * Every constant the physics model uses is declared HERE, with its provenance, and read from
 * here. `origin: 'PLACEHOLDER'` means exactly that — a plausible engineering value that has
 * NOT been fitted to data. Any calculation that touches a PLACEHOLDER constant raises the
 * MODEL_UNCALIBRATED warning, so an uncalibrated number can never be displayed as if it were
 * validated. Replacing these with Mark's fitted values is the whole point of Milestone 1.
 */

export type ConstantOrigin =
  | 'DEFINITION' // exact by definition (e.g. inch)
  | 'PHYSICS' // standard textbook relation, not adjustable
  | 'MEASURED' // fitted to real data — record the dataset in `source`
  | 'PLACEHOLDER'; // plausible but unfitted. Triggers MODEL_UNCALIBRATED.

export interface ModelConstant {
  readonly name: string;
  readonly value: number;
  readonly units: string;
  readonly origin: ConstantOrigin;
  readonly source?: string;
  readonly explanation: string;
}

function c(k: ModelConstant): ModelConstant {
  return Object.freeze(k);
}

export const CONSTANTS = {
  /** Air density. Sea-level ISA. Mark can override per-session for field altitude/temperature. */
  airDensitySeaLevelIsa: c({
    name: 'airDensitySeaLevelIsa',
    value: 1.225,
    units: 'kg/m^3',
    origin: 'DEFINITION',
    source: 'ISA sea level, 15 °C, 101325 Pa',
    explanation:
      'Reference air density. Thrust and torque scale linearly with density, so a hot day at ' +
      'altitude reduces both. Override via PropulsionInput.airDensityKgM3.',
  }),

  /**
   * Static thrust coefficient model, C_T = ctIntercept + ctPitchSlope * (pitch/diameter).
   *
   * The non-dimensional form T = C_T * rho * n^2 * D^4 is standard propeller physics. The two
   * coefficients below describing how C_T varies with pitch ratio are NOT — they are a linear
   * placeholder chosen to land in the range published static data for small electric props
   * occupies. They are the first thing to replace with a fit to Mark's data or APC data.
   */
  ctIntercept: c({
    name: 'ctIntercept',
    value: 0.075,
    units: 'dimensionless',
    origin: 'PLACEHOLDER',
    explanation:
      'C_T at zero pitch ratio in the linear placeholder C_T = a + b*(p/D). Unfitted.',
  }),
  ctPitchSlope: c({
    name: 'ctPitchSlope',
    value: 0.09,
    units: 'per unit pitch ratio',
    origin: 'PLACEHOLDER',
    explanation:
      'Sensitivity of static C_T to pitch ratio in the linear placeholder. Unfitted. A real ' +
      'prop loses static C_T at high pitch ratio as the blade stalls; this linear form does ' +
      'not capture that and will over-predict thrust for high-pitch props.',
  }),

  /** Static power coefficient model, C_P = cpIntercept + cpPitchSlope * (pitch/diameter). */
  cpIntercept: c({
    name: 'cpIntercept',
    value: 0.01,
    units: 'dimensionless',
    origin: 'PLACEHOLDER',
    explanation: 'C_P at zero pitch ratio in the linear placeholder. Unfitted.',
  }),
  cpPitchSlope: c({
    name: 'cpPitchSlope',
    value: 0.075,
    units: 'per unit pitch ratio',
    origin: 'PLACEHOLDER',
    explanation:
      'Sensitivity of static C_P to pitch ratio. Unfitted. Drives predicted current, so an ' +
      'error here shows up directly as a current-prediction error on the bench.',
  }),

  /**
   * Blade-count scaling. Two blades is the reference; more blades add thrust and power but
   * less than proportionally because of mutual interference.
   */
  bladeCountExponent: c({
    name: 'bladeCountExponent',
    value: 0.8,
    units: 'dimensionless',
    origin: 'PLACEHOLDER',
    explanation:
      'Coefficients are scaled by (bladeCount/2)^exponent. An exponent of 1.0 would be ' +
      'linear-in-blades (no interference); 0.8 is a common rule of thumb. Unfitted.',
  }),

  /**
   * ESC series resistance. Lumped in with battery internal resistance in the voltage-sag term.
   * Zero until Mark measures it, so the model does not invent a loss it cannot justify.
   */
  escResistanceOhm: c({
    name: 'escResistanceOhm',
    value: 0,
    units: 'ohm',
    origin: 'PLACEHOLDER',
    explanation:
      'Series resistance of ESC and wiring, lumped with battery IR. Left at zero deliberately: ' +
      'an unmeasured loss is better represented as absent-and-flagged than as a guess. Real ' +
      'values for typical setups are of order 0.002-0.01 ohm.',
  }),
} as const satisfies Record<string, ModelConstant>;

export type ConstantKey = keyof typeof CONSTANTS;

/** Every constant that has not been fitted to data. Non-empty => the model is uncalibrated. */
export function placeholderConstants(): ModelConstant[] {
  return Object.values(CONSTANTS).filter((k) => k.origin === 'PLACEHOLDER');
}

export function isModelCalibrated(): boolean {
  return placeholderConstants().length === 0;
}
