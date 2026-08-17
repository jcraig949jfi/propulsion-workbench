/**
 * Unit conversions. The physics engine works in SI ONLY; conversions happen here and are
 * called at UI boundaries. No conversion constant may be written inline anywhere else.
 *
 * Internal SI: metres, newtons, newton-metres, volts, amps, watts, kilograms, seconds,
 * radians, and rev/s for rotational rate (RPM is a UI unit).
 */

// ---- exact, definitional constants ------------------------------------------------------
/** International inch, exact by definition (1959 agreement). */
export const METRES_PER_INCH = 0.0254;
/** Standard gravity, CGPM 1901 definition — used only to convert force <-> "kg of thrust". */
export const STANDARD_GRAVITY_M_S2 = 9.80665;
/** Avoirdupois pound-force per newton, derived from the exact pound mass and g0. */
export const NEWTONS_PER_POUND_FORCE = 4.4482216152605;
export const NEWTONS_PER_OUNCE_FORCE = NEWTONS_PER_POUND_FORCE / 16;

// ---- length ------------------------------------------------------------------------------
export const inchesToMetres = (inches: number): number => inches * METRES_PER_INCH;
export const metresToInches = (metres: number): number => metres / METRES_PER_INCH;

// ---- rotational rate ---------------------------------------------------------------------
/** RPM -> revolutions per second (the form the propeller coefficient model needs). */
export const rpmToRevPerSec = (rpm: number): number => rpm / 60;
export const revPerSecToRpm = (revPerSec: number): number => revPerSec * 60;
/** RPM -> rad/s, for mechanical power P = Q * omega. */
export const rpmToRadPerSec = (rpm: number): number => (rpm * 2 * Math.PI) / 60;
export const radPerSecToRpm = (radPerSec: number): number => (radPerSec * 60) / (2 * Math.PI);

// ---- force -------------------------------------------------------------------------------
/**
 * "Kilograms of thrust" is a kilogram-force, not a mass. Modellers use it universally, so the
 * UI speaks it — but it is converted here and never stored.
 */
export const newtonsToKgf = (newtons: number): number => newtons / STANDARD_GRAVITY_M_S2;
export const kgfToNewtons = (kgf: number): number => kgf * STANDARD_GRAVITY_M_S2;
export const newtonsToPoundsForce = (newtons: number): number => newtons / NEWTONS_PER_POUND_FORCE;
export const poundsForceToNewtons = (lbf: number): number => lbf * NEWTONS_PER_POUND_FORCE;
export const newtonsToOuncesForce = (newtons: number): number => newtons / NEWTONS_PER_OUNCE_FORCE;
export const ouncesForceToNewtons = (ozf: number): number => ozf * NEWTONS_PER_OUNCE_FORCE;

// ---- mass --------------------------------------------------------------------------------
export const gramsToKg = (grams: number): number => grams / 1000;
export const kgToGrams = (kg: number): number => kg * 1000;
export const ouncesToGrams = (oz: number): number => oz * 28.349523125; // exact avoirdupois ounce

// ---- speed (for later, once forward flight is modelled) ----------------------------------
export const METRES_PER_SEC_PER_MPH = 0.44704; // exact
export const mphToMetresPerSec = (mph: number): number => mph * METRES_PER_SEC_PER_MPH;
export const metresPerSecToMph = (ms: number): number => ms / METRES_PER_SEC_PER_MPH;

// ---- display helpers ---------------------------------------------------------------------
/** Format with fixed significant figures without pretending to precision we do not have. */
export function fmt(value: number | undefined, digits = 2): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtInt(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  return Math.round(value).toLocaleString();
}
