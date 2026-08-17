/**
 * Seed hardware catalogue (spec §16: seed in source control, defer the editor if it delays the
 * calculator — the editor shipped anyway, so these are only starting points).
 *
 * HONESTY RULE APPLIED HERE, and it is the reason the motor list looks generic:
 *
 * Propeller geometry is safe to ship, because "APC 13x6E" IS its diameter and pitch — the name
 * is the datum. Pack nominal voltage is safe, because 4S LiPo nominal is 4 x 3.7 V by
 * definition. Motor Kv, winding resistance and no-load current are NOT safe to ship: they are
 * per-model measured quantities, and typing plausible numbers next to a real manufacturer's
 * name would be fabricating a datasheet. Spec §17 forbids silently mixing manufacturer data
 * with assumed values, so the seeded motors are labelled generically, marked
 * `dataClass: 'ASSUMED'`, and every calculation that uses one raises UNVERIFIED_INPUT_DATA.
 *
 * Mark should replace them with his real motors via Hardware > Add Motor (or by editing this
 * file), taking Kv/Rm/I0 from the datasheet or a measurement. The moment he does, the
 * UNVERIFIED_INPUT_DATA warning disappears for that motor.
 */
import type { Battery, Motor, Propeller } from '../model/types';

const ASSUMED_MOTOR_NOTE =
  'EXAMPLE MOTOR — plausible values for a motor of this size, NOT a real datasheet. Replace ' +
  'with your own motor and its measured Kv / Rm / I0.';

export const SEED_MOTORS: Motor[] = [
  {
    id: 'example-500kv-outrunner',
    manufacturer: 'Example',
    model: '500 kV outrunner (~600 W class)',
    kvRpmPerVolt: 500,
    resistanceOhm: 0.06,
    noLoadCurrentA: 1.0,
    maxCurrentA: 40,
    maxPowerW: 600,
    massG: 240,
    dataClass: 'ASSUMED',
    notes: ASSUMED_MOTOR_NOTE,
    provenance: { sourceName: 'PLACEHOLDER — replace with datasheet or measurement' },
  },
  {
    id: 'example-700kv-outrunner',
    manufacturer: 'Example',
    model: '700 kV outrunner (~700 W class)',
    kvRpmPerVolt: 700,
    resistanceOhm: 0.05,
    noLoadCurrentA: 1.2,
    maxCurrentA: 45,
    maxPowerW: 700,
    massG: 200,
    dataClass: 'ASSUMED',
    notes: ASSUMED_MOTOR_NOTE,
    provenance: { sourceName: 'PLACEHOLDER — replace with datasheet or measurement' },
  },
  {
    id: 'example-1000kv-outrunner',
    manufacturer: 'Example',
    model: '1000 kV outrunner (~500 W class)',
    kvRpmPerVolt: 1000,
    resistanceOhm: 0.035,
    noLoadCurrentA: 1.5,
    maxCurrentA: 40,
    maxPowerW: 500,
    massG: 145,
    dataClass: 'ASSUMED',
    notes: ASSUMED_MOTOR_NOTE,
    provenance: { sourceName: 'PLACEHOLDER — replace with datasheet or measurement' },
  },
  {
    id: 'blank-motor',
    manufacturer: '(your motor)',
    model: 'fill in Kv, Rm, I0',
    kvRpmPerVolt: 700,
    dataClass: 'ASSUMED',
    notes:
      'A deliberately incomplete record: no winding resistance, so the calculator will refuse ' +
      'to report an operating point and will tell you why. That is the intended behaviour.',
  },
];

/**
 * LiPo nominal voltage is 3.7 V/cell and fully charged is 4.2 V/cell — conventional
 * definitions, safe to ship. Internal resistance is left undefined on purpose: it is
 * pack-specific, it ages, and guessing it silently inflates every prediction. The calculator
 * warns while it is missing.
 */
const lipo = (cells: number, capacityMah: number, maxC?: number): Battery => ({
  id: `lipo-${cells}s-${capacityMah}`,
  name: `${cells}S ${capacityMah} mAh LiPo`,
  cells,
  capacityMah,
  nominalVoltageV: cells * 3.7,
  fullyChargedVoltageV: cells * 4.2,
  maxContinuousCurrentA: maxC !== undefined ? (maxC * capacityMah) / 1000 : undefined,
  dataClass: 'MANUFACTURER',
  notes:
    'Nominal 3.7 V/cell and 4.2 V/cell charged are LiPo conventions. Internal resistance is ' +
    'deliberately unset — measure your pack and enter it to model voltage sag.',
  provenance: { sourceName: 'LiPo chemistry convention (3.7 V/cell nominal, 4.2 V/cell charged)' },
});

export const SEED_BATTERIES: Battery[] = [
  lipo(3, 2200, 30),
  lipo(3, 5000, 30),
  lipo(4, 3300, 30),
  lipo(4, 5000, 30),
  lipo(5, 5000, 30),
  lipo(6, 5000, 30),
];

/**
 * Propellers. Diameter and pitch come straight from the product designation, which is what the
 * designation means — no performance data is claimed here. `staticCoefficients` is left unset,
 * so the placeholder aero model is used and flagged. Attaching real APC or bench-fitted
 * coefficients to any record here immediately upgrades that prop's predictions and silences
 * MODEL_UNCALIBRATED for it.
 */
const APC_PROVENANCE = {
  sourceName: 'APC Propellers — product designation (diameter x pitch, inches)',
  sourceUrl: 'https://www.apcprop.com/',
  notes:
    'Geometry from the model designation only. No APC performance data is included; see ' +
    'MODEL.md for how to add it, and spec §21 for why APC figures are a second model rather ' +
    'than ground truth.',
};

function apc(diameterIn: number, pitchIn: number, category = 'Thin Electric (E)'): Propeller {
  const model = `${diameterIn}x${pitchIn}E`;
  return {
    id: `apc-${diameterIn}x${pitchIn}e`,
    manufacturer: 'APC',
    model,
    diameterIn,
    pitchIn,
    bladeCount: 2,
    category,
    sourceUrl: 'https://www.apcprop.com/',
    dataClass: 'MANUFACTURER',
    provenance: APC_PROVENANCE,
  };
}

/**
 * A grid dense enough to make the diameter/pitch experiment meaningful (spec §8 Mode A: only
 * real, orderable props). These designations are all standard APC thin-electric sizes.
 */
export const SEED_PROPELLERS: Propeller[] = [
  apc(10, 5), apc(10, 6), apc(10, 7), apc(10, 8), apc(10, 10),
  apc(11, 5.5), apc(11, 7), apc(11, 8), apc(11, 10),
  apc(12, 6), apc(12, 8), apc(12, 10), apc(12, 12),
  apc(13, 6.5), apc(13, 8), apc(13, 10),
  apc(14, 7), apc(14, 8.5), apc(14, 10), apc(14, 12),
  apc(15, 8), apc(15, 10), apc(15, 12),
  apc(16, 8), apc(16, 10), apc(16, 12),
  apc(17, 8), apc(17, 10), apc(17, 12),
  apc(18, 8), apc(18, 10), apc(18, 12),
];

/** Distinct diameters and pitches present in a catalogue — drives the sliders. */
export function availableDiameters(props: Propeller[]): number[] {
  return [...new Set(props.map((p) => p.diameterIn))].sort((a, b) => a - b);
}

export function availablePitches(props: Propeller[], diameterIn?: number): number[] {
  const pool = diameterIn === undefined ? props : props.filter((p) => p.diameterIn === diameterIn);
  return [...new Set(pool.map((p) => p.pitchIn))].sort((a, b) => a - b);
}

/**
 * Mode A selection (spec §8): moving a slider must land on a REAL propeller, never interpolate.
 * Returns the catalogue entry closest to the requested geometry, preferring an exact diameter
 * match and then the nearest available pitch.
 */
export function nearestRealPropeller(
  props: Propeller[],
  diameterIn: number,
  pitchIn: number,
): Propeller | undefined {
  if (props.length === 0) return undefined;
  const sameDiameter = props.filter((p) => p.diameterIn === diameterIn);
  const pool = sameDiameter.length > 0 ? sameDiameter : props;
  return pool.reduce((best, p) => {
    const score = (q: Propeller) =>
      Math.abs(q.diameterIn - diameterIn) * 10 + Math.abs(q.pitchIn - pitchIn);
    return score(p) < score(best) ? p : best;
  }, pool[0]);
}
