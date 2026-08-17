/**
 * Hardware and result types. These are the contract between the data layer, the physics
 * engine, and the UI. Optional fields mean genuinely unknown — never "assume a default".
 */

/** Spec §17 — where a number came from. Kept ON the record, not in a comment. */
export interface Provenance {
  sourceName?: string;
  sourceUrl?: string;
  accessedDate?: string;
  notes?: string;
}

/** Spec §17 — do not silently mix manufacturer, measured, assumed and derived values. */
export type DataClass =
  | 'MANUFACTURER' // from a datasheet or manufacturer catalogue
  | 'MEASURED' // Mark measured it
  | 'ASSUMED' // a stand-in Mark has not confirmed
  | 'DERIVED'; // computed from other records

export interface Motor {
  id: string;
  manufacturer: string;
  model: string;
  kvRpmPerVolt: number;
  resistanceOhm?: number;
  noLoadCurrentA?: number;
  maxCurrentA?: number;
  maxPowerW?: number;
  massG?: number;
  notes?: string;
  dataClass?: DataClass;
  provenance?: Provenance;
}

export interface Battery {
  id: string;
  name: string;
  cells: number;
  capacityMah: number;
  nominalVoltageV: number;
  fullyChargedVoltageV?: number;
  internalResistanceOhm?: number;
  massG?: number;
  maxContinuousCurrentA?: number;
  notes?: string;
  dataClass?: DataClass;
  provenance?: Provenance;
}

export interface Propeller {
  id: string;
  manufacturer: string;
  model: string;
  diameterIn: number;
  pitchIn: number;
  bladeCount?: number;
  category?: string;
  sourceUrl?: string;
  notes?: string;
  dataClass?: DataClass;
  provenance?: Provenance;
  /**
   * Measured or published static coefficients for THIS propeller. When present the engine uses
   * them instead of the placeholder pitch-ratio model, and the MODEL_UNCALIBRATED warning is
   * downgraded. This is the hook for APC data or Mark's own bench fits.
   */
  staticCoefficients?: {
    ct: number;
    cp: number;
    provenance?: Provenance;
  };
}

/** Spec §9 — the warning vocabulary. Fail loudly rather than presenting doubtful precision. */
export type WarningCode =
  | 'MOTOR_CURRENT_EXCEEDED'
  | 'MOTOR_POWER_EXCEEDED'
  | 'BATTERY_CURRENT_EXCEEDED'
  | 'SOLVER_DID_NOT_CONVERGE'
  | 'MISSING_MOTOR_PARAMETER'
  | 'MISSING_BATTERY_PARAMETER'
  | 'EXTRAPOLATED_OUTSIDE_VALIDATED_RANGE'
  | 'MODEL_UNCALIBRATED'
  | 'UNVERIFIED_INPUT_DATA';

export interface Warning {
  code: WarningCode;
  message: string;
  severity: 'INFO' | 'WARNING' | 'ERROR';
}

export interface SolverDiagnostics {
  converged: boolean;
  iterations: number;
  residual?: number;
  message?: string;
  bracketLowRpm?: number;
  bracketHighRpm?: number;
}

export interface PropulsionInput {
  motor: Motor;
  battery: Battery;
  propeller: Propeller;
  airDensityKgM3?: number;
  /** Series resistance of ESC + wiring, ohm. Defaults to the registered constant. */
  escResistanceOhm?: number;
  /** Use the fully-charged voltage instead of nominal. Defaults to nominal (conservative). */
  useFullyChargedVoltage?: boolean;
}

export interface PropulsionResult {
  rpm: number;
  thrustN?: number;
  thrustKgF?: number;
  currentA?: number;
  inputPowerW?: number;
  mechanicalPowerW?: number;
  torqueNm?: number;
  loadedVoltageV?: number;
  motorEfficiency?: number;
  /**
   * Undefined for a static test, and that is physics, not an omission: propulsive efficiency is
   * thrust*airspeed/shaftPower, which is exactly zero when airspeed is zero. Use
   * `staticThrustPerShaftWattNPerW` to compare props on a static bench.
   */
  propEfficiency?: number;
  staticThrustPerShaftWattNPerW?: number;
  /** Thrust per watt drawn from the battery — the number that matters for flight time. */
  staticThrustPerInputWattNPerW?: number;
  warnings: Warning[];
  diagnostics: SolverDiagnostics;
  /** Non-dimensional coefficients actually used, and where they came from. */
  coefficientsUsed?: { ct: number; cp: number; source: 'PROP_DATA' | 'PLACEHOLDER_PITCH_MODEL' };
}

export interface BenchTest {
  id: string;
  timestamp: string;
  motorId: string;
  batteryId: string;
  propellerId: string;
  predicted: PropulsionResult;
  measured: {
    rpm?: number;
    thrustN?: number;
    thrustKgF?: number;
    currentA?: number;
    voltageV?: number;
  };
  notes?: string;
}

export interface ErrorRow {
  metric: string;
  predicted?: number;
  measured?: number;
  absoluteError?: number;
  percentError?: number;
  units: string;
}
