/**
 * Seed hardware catalogue (spec §16: seed in source control, defer the editor if it delays the
 * calculator — the editor shipped anyway, so these are only starting points).
 *
 * The catalogue, honest about what each number is:
 *
 * - **Motors**: seven real AXI motors transcribed from the manufacturer's own specification
 *   tables (see `motorsAxi.ts`), marked MANUFACTURER and carrying their datasheet URL. AXI is
 *   used because it publishes internal resistance and no-load current, which most makers omit
 *   and this calculator cannot work without. The three generic "Example" motors are kept as
 *   EXAMPLE for comparison, plus one deliberately incomplete record that demonstrates the
 *   calculator refusing to guess.
 * - **Propellers**: geometry is real, because "APC 13x6.5E" IS its diameter and pitch — the
 *   designation is the datum. Sizes confirmed in retail listings are MANUFACTURER; standard
 *   sizes not individually confirmed are ASSUMED, which makes the app say so when one is
 *   selected. No APC performance data is claimed anywhere.
 * - **Packs**: voltages are LiPo conventions (3.7 V/cell nominal, 4.2 V charged); internal
 *   resistance is a representative healthy-pack value so voltage sag is demonstrated.
 *
 * Adding your own hardware (Hardware tab, or editing this file) marks it MEASURED and the app
 * treats it as authoritative.
 */
import type { Battery, Motor, Propeller } from '../model/types';
import { AXI_MOTORS } from './motorsAxi';

const EXAMPLE_MOTOR_NOTE =
  'Example motor — representative values for a motor of this size and class, not a copy of any ' +
  'particular product datasheet. Use it to explore; add your own motor when you want numbers ' +
  'for real hardware.';

export const SEED_MOTORS: Motor[] = [
  // Real, datasheet-sourced motors first — these are what the app should be judged on.
  ...AXI_MOTORS,
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
    dataClass: 'EXAMPLE',
    notes: EXAMPLE_MOTOR_NOTE,
    provenance: { sourceName: 'Illustrative example for the demo — not a product datasheet' },
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
    dataClass: 'EXAMPLE',
    notes: EXAMPLE_MOTOR_NOTE,
    provenance: { sourceName: 'Illustrative example for the demo — not a product datasheet' },
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
    dataClass: 'EXAMPLE',
    notes: EXAMPLE_MOTOR_NOTE,
    provenance: { sourceName: 'Illustrative example for the demo — not a product datasheet' },
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
 * LiPo nominal voltage is 3.7 V/cell and fully charged is 4.2 V/cell — conventional definitions.
 *
 * Internal resistance is set to a representative healthy-pack figure of ~3 mΩ per cell, scaled
 * by capacity (a bigger pack has lower IR, roughly in proportion to cell area). It is labelled
 * EXAMPLE rather than MEASURED, because a real pack's IR is specific to that pack and rises as
 * it ages. It is included so the demo shows voltage sag doing its job; measure your own pack and
 * enter it when you want the numbers to be about your hardware.
 */
const EXAMPLE_MILLIOHM_PER_CELL_AT_5AH = 3.0;

const lipo = (cells: number, capacityMah: number, maxC?: number): Battery => ({
  id: `lipo-${cells}s-${capacityMah}`,
  name: `${cells}S ${capacityMah} mAh LiPo`,
  cells,
  capacityMah,
  nominalVoltageV: cells * 3.7,
  fullyChargedVoltageV: cells * 4.2,
  internalResistanceOhm:
    (cells * EXAMPLE_MILLIOHM_PER_CELL_AT_5AH * (5000 / capacityMah)) / 1000,
  maxContinuousCurrentA: maxC !== undefined ? (maxC * capacityMah) / 1000 : undefined,
  dataClass: 'EXAMPLE',
  notes:
    'Voltages are LiPo conventions. Internal resistance is a representative healthy-pack value ' +
    '(~3 mΩ/cell at 5 Ah, scaled by capacity), not a measurement of any particular pack.',
  provenance: { sourceName: 'LiPo convention + representative healthy-pack internal resistance' },
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
  sourceName: 'APC Propellers — E-series product designation (diameter x pitch, inches)',
  sourceUrl: 'https://www.apcprop.com/',
  accessedDate: '2026-08-17',
  notes:
    'Geometry from the model designation only. No APC performance data is included; see ' +
    'MODEL.md for how to attach measured coefficients, and why APC figures would be a second ' +
    'model to compare against rather than ground truth.',
};

/**
 * Sizes confirmed present in retail E-series listings (innov8tivedesigns.com, altitudehobbies,
 * rcdude), checked 2026-08-17. These ship as MANUFACTURER data.
 */
const VERIFIED_E: Array<[number, number]> = [
  // small end, confirmed on the black E-series listing
  [5, 4.6], [5, 5], [5.5, 4.5],
  [6, 4], [6, 4.5], [6, 5.5], [6, 6],
  [7, 4],
  [8, 6],
  [9, 6],
  [10, 5], [10, 5.8], [10, 6], [10, 7], [10, 8], [10, 10],
  [11, 5.5], [11, 7], [11, 8], [11, 8.5], [11, 10],
  [12, 6], [12, 7], [12, 8], [12, 10], [12, 12],
  [13, 6.5], [13, 10],
  [14, 8.5], [14, 10], [14, 12],
  [15, 6], [15, 10],
  [20, 8],
];

/**
 * Standard sizes that fill the gaps in the grid but that I did not individually confirm against
 * a live listing. They are marked ASSUMED, which makes the app raise UNVERIFIED_INPUT_DATA when
 * one is selected — the provenance machinery doing exactly the job it exists for. Confirm
 * availability before ordering, and flip the entry to MANUFACTURER once you have.
 */
const UNVERIFIED_E: Array<[number, number]> = [
  // small/low-pitch sizes filling the bottom of the range
  [5, 3], [6, 3], [7, 3], [7, 5], [7, 6],
  [8, 3.8], [8, 4], [8, 4.3], [8, 5],
  [9, 3.8], [9, 4.5], [9, 5],
  [10, 4], [10, 4.7],
  [11, 3.8], [11, 4.7],
  [12, 3.8], [12, 4.7],
  [13, 8], [13, 12],
  [14, 7],
  [15, 8], [15, 12],
  [16, 8], [16, 10], [16, 12],
  [17, 8], [17, 10], [17, 12],
  [18, 8], [18, 10], [18, 12],
  [19, 10], [19, 12],
  [20, 10], [20, 13],
  [22, 10], [22, 12],
];

function apc(diameterIn: number, pitchIn: number, verified: boolean): Propeller {
  const pitchLabel = Number.isInteger(pitchIn) ? String(pitchIn) : String(pitchIn);
  return {
    id: `apc-${diameterIn}x${pitchIn}e`,
    manufacturer: 'APC',
    model: `${diameterIn}x${pitchLabel}E`,
    diameterIn,
    pitchIn,
    bladeCount: 2,
    category: 'Thin Electric (E)',
    sourceUrl: 'https://www.apcprop.com/',
    dataClass: verified ? 'MANUFACTURER' : 'ASSUMED',
    provenance: verified
      ? APC_PROVENANCE
      : {
          ...APC_PROVENANCE,
          sourceName: 'APC E-series — standard size, listing not individually confirmed',
          notes: 'Confirm this size is currently offered before ordering.',
        },
    notes: verified ? undefined : 'Size not individually confirmed against a live listing.',
  };
}

/**
 * The catalogue. Dense enough that a diameter/pitch range sweep has real hardware at every
 * step, which is the point of Mode A: every point on a chart is a prop you can actually buy
 * and bench-test.
 */
export const SEED_PROPELLERS: Propeller[] = [
  ...VERIFIED_E.map(([d, p]) => apc(d, p, true)),
  ...UNVERIFIED_E.map(([d, p]) => apc(d, p, false)),
].sort((a, b) => a.diameterIn - b.diameterIn || a.pitchIn - b.pitchIn);

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
