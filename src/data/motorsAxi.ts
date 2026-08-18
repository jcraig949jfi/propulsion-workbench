/**
 * Real AXI motors, transcribed from the manufacturer's own specification tables.
 *
 * Source: AXI Model Motors (modelmotors.cz) product pages, fetched 2026-08-17. Each record
 * carries its detail-page URL so any number can be checked against the datasheet it came from.
 *
 * These are `MANUFACTURER` data, not examples — which is why they raise no unverified-input
 * warning. AXI is used here because it publishes the two parameters most manufacturers omit and
 * this calculator cannot work without: **internal resistance** and **no-load current**. Kv alone
 * gives only unloaded speed.
 *
 * ONE IMPORTANT CAVEAT, carried on every record. AXI's "max current" figure is a BURST rating
 * with a stated duration (typically 60 s, 20 s on the 5360). It is not a continuous rating. The
 * app treats it as the limit to warn against, and the duration is in `notes` — do not read a
 * green light here as permission to hold that current all flight.
 */
import type { Motor } from '../model/types';

const axiProvenance = (detailId: number) => ({
  sourceName: 'AXI Model Motors — product specification table',
  sourceUrl: `https://www.modelmotors.cz/product/detail/${detailId}/`,
  accessedDate: '2026-08-17',
  notes: 'Kv, internal resistance and no-load current transcribed from the manufacturer table.',
});

export const AXI_MOTORS: Motor[] = [
  {
    id: 'axi-2217-20',
    manufacturer: 'AXI',
    model: '2217/20 Gold Line',
    kvRpmPerVolt: 840,
    resistanceOhm: 0.185,
    noLoadCurrentA: 0.4,
    maxCurrentA: 18,
    massG: 69.5,
    dataClass: 'MANUFACTURER',
    notes: 'Max current 18 A rated for 60 s, not continuous. Max efficiency 82%. 2–4S.',
    provenance: axiProvenance(200),
  },
  {
    id: 'axi-2820-10',
    manufacturer: 'AXI',
    model: '2820/10 Gold Line',
    kvRpmPerVolt: 1200,
    resistanceOhm: 0.039,
    noLoadCurrentA: 2.3,
    maxCurrentA: 42,
    maxPowerW: 585,
    massG: 151,
    dataClass: 'MANUFACTURER',
    notes: 'Max current 42 A rated for 60 s, not continuous. Max efficiency 83%. 3–4S.',
    provenance: axiProvenance(221),
  },
  {
    id: 'axi-2826-10',
    manufacturer: 'AXI',
    model: '2826/10 Gold Line',
    kvRpmPerVolt: 920,
    resistanceOhm: 0.042,
    noLoadCurrentA: 1.7,
    maxCurrentA: 42,
    massG: 181,
    dataClass: 'MANUFACTURER',
    notes: 'Max current 42 A rated for 60 s, not continuous. Max efficiency 84%. 3–5S.',
    provenance: axiProvenance(232),
  },
  {
    id: 'axi-4130-16',
    manufacturer: 'AXI',
    model: '4130/16 Gold Line',
    kvRpmPerVolt: 385,
    resistanceOhm: 0.063,
    noLoadCurrentA: 1.3,
    maxCurrentA: 60,
    massG: 409,
    dataClass: 'MANUFACTURER',
    notes: 'Max current 60 A rated for 60 s, not continuous. Max efficiency 88%. 5–8S.',
    provenance: axiProvenance(240),
  },
  {
    id: 'axi-4130-20-v3',
    manufacturer: 'AXI',
    model: '4130/20 Gold Line V3',
    kvRpmPerVolt: 305,
    resistanceOhm: 0.043,
    noLoadCurrentA: 1.1,
    maxCurrentA: 56,
    maxPowerW: 1650,
    massG: 410,
    dataClass: 'MANUFACTURER',
    notes: 'Max current 56 A rated for 60 s, not continuous. Max efficiency 90%. 6–8S.',
    provenance: axiProvenance(276),
  },
  {
    id: 'axi-5330-18-v3',
    manufacturer: 'AXI',
    model: '5330/18 Gold Line V3',
    kvRpmPerVolt: 259,
    resistanceOhm: 0.019,
    noLoadCurrentA: 1.9,
    maxCurrentA: 76,
    maxPowerW: 2870,
    massG: 672,
    dataClass: 'MANUFACTURER',
    notes: 'Max current 76 A rated for 60 s, not continuous. Max efficiency 92%. Up to 10S.',
    provenance: axiProvenance(265),
  },
  {
    id: 'axi-5360-20hd-v3',
    manufacturer: 'AXI',
    model: '5360/20HD Gold Line V3',
    kvRpmPerVolt: 115,
    resistanceOhm: 0.068,
    noLoadCurrentA: 1.8,
    maxCurrentA: 65,
    maxPowerW: 3000,
    massG: 1270,
    dataClass: 'MANUFACTURER',
    notes:
      'Max current 65 A rated for only 20 s — the shortest burst window in this set. ' +
      'Max efficiency 94%. 10–12S. Low Kv, very high torque, swings 30" props directly.',
    provenance: axiProvenance(255),
  },
];
