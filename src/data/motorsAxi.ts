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
 * The set spans 20 g / 58 W indoor motors up to a 1270 g / 3000 W giant, so the filters in the
 * app have something to bite on.
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
    id: 'axi-2203-46-v2',
    manufacturer: 'AXI',
    model: '2203/46 Gold Line V2',
    kvRpmPerVolt: 1720,
    resistanceOhm: 0.199,
    noLoadCurrentA: 0.5,
    maxCurrentA: 9.5,
    maxPowerW: 58,
    massG: 20,
    dataClass: 'MANUFACTURER',
    notes:
      'Indoor 3D/aerobatic, models up to 220 g. Max current 9.5 A rated for only 20 s. ' +
      'Max efficiency 76%. 2S, 8x4.3 prop.',
    provenance: axiProvenance(320),
  },
  {
    id: 'axi-2204-54',
    manufacturer: 'AXI',
    model: '2204/54 Gold Line',
    kvRpmPerVolt: 1400,
    resistanceOhm: 0.32,
    noLoadCurrentA: 0.35,
    maxCurrentA: 7.5,
    massG: 25.9,
    dataClass: 'MANUFACTURER',
    notes:
      'Indoor aerobatic up to 280 g. Max current 7.5 A rated for only 30 s. Max efficiency ' +
      '77%. 3S, props 7.5x3.5 to 9x5.',
    provenance: axiProvenance(163),
  },
  {
    id: 'axi-2208-20',
    manufacturer: 'AXI',
    model: '2208/20 Gold Line',
    kvRpmPerVolt: 1820,
    resistanceOhm: 0.089,
    noLoadCurrentA: 0.8,
    maxCurrentA: 16,
    massG: 45,
    dataClass: 'MANUFACTURER',
    notes:
      'Park/slow fly 250-650 g. Max current 16 A rated for 60 s. Max efficiency 82%. 2-3S, ' +
      'props 7.5x4 to 8x4.',
    provenance: axiProvenance(167),
  },
  {
    id: 'axi-2208-34',
    manufacturer: 'AXI',
    model: '2208/34 Gold Line',
    kvRpmPerVolt: 1100,
    resistanceOhm: 0.26,
    noLoadCurrentA: 0.35,
    maxCurrentA: 8,
    massG: 45,
    dataClass: 'MANUFACTURER',
    notes:
      'Slow/park fly up to 500 g. Max current 8 A rated for 60 s. Max efficiency 81%. 3S, ' +
      'props 9x3.8 to 9x6.',
    provenance: axiProvenance(175),
  },
  {
    id: 'axi-2212-20',
    manufacturer: 'AXI',
    model: '2212/20 Gold Line',
    kvRpmPerVolt: 1150,
    resistanceOhm: 0.135,
    noLoadCurrentA: 0.7,
    maxCurrentA: 16,
    massG: 57,
    dataClass: 'MANUFACTURER',
    notes:
      'Park/sport 400-800 g. Max current 16 A rated for 60 s. Max efficiency 82%. 2-3S, ' +
      'props 9x4.5 to 10x5.',
    provenance: axiProvenance(181),
  },
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
