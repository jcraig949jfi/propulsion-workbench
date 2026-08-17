/**
 * Local persistence and export/import (spec §15).
 *
 * Rule from the spec, treated as a hard requirement: "Do not allow browser storage to become
 * the only copy of Mark's experimental results." So the export path is a first-class feature,
 * the serialisation functions are pure and unit-tested independently of the browser, and the
 * app nags when there are unexported tests.
 */
import type { BenchTest, Battery, Motor, Propeller } from '../model/types';

export const STORAGE_KEY = 'propulsion-workbench:v1';
export const WORKSPACE_FORMAT = 'propulsion-workbench-workspace';
export const WORKSPACE_VERSION = 1;

export interface Workspace {
  format: typeof WORKSPACE_FORMAT;
  version: number;
  savedAt: string;
  motors: Motor[];
  batteries: Battery[];
  propellers: Propeller[];
  benchTests: BenchTest[];
}

export function emptyWorkspace(): Workspace {
  return {
    format: WORKSPACE_FORMAT,
    version: WORKSPACE_VERSION,
    savedAt: new Date().toISOString(),
    motors: [],
    batteries: [],
    propellers: [],
    benchTests: [],
  };
}

// ---- pure serialisation (testable without a browser) --------------------------------------

export function serializeWorkspace(ws: Workspace): string {
  return JSON.stringify({ ...ws, savedAt: new Date().toISOString() }, null, 2);
}

export interface ParseResult {
  workspace?: Workspace;
  errors: string[];
}

/**
 * Parse and validate an imported workspace. Refuses unknown formats loudly rather than merging
 * garbage into Mark's data — a silent partial import of a bench-test log is data loss.
 */
export function parseWorkspace(text: string): ParseResult {
  const errors: string[] = [];
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { errors: [`not valid JSON: ${(e as Error).message}`] };
  }
  if (typeof raw !== 'object' || raw === null) return { errors: ['top level is not an object'] };

  const o = raw as Partial<Workspace>;
  if (o.format !== WORKSPACE_FORMAT) {
    errors.push(`unexpected format ${String(o.format)}; expected ${WORKSPACE_FORMAT}`);
  }
  if (typeof o.version !== 'number') errors.push('missing numeric version');
  else if (o.version > WORKSPACE_VERSION) {
    errors.push(
      `file version ${o.version} is newer than this app understands (${WORKSPACE_VERSION}); ` +
        'update the app rather than importing and risking silent field loss',
    );
  }
  for (const key of ['motors', 'batteries', 'propellers', 'benchTests'] as const) {
    if (o[key] !== undefined && !Array.isArray(o[key])) errors.push(`${key} is not an array`);
  }
  if (errors.length > 0) return { errors };

  return {
    workspace: {
      format: WORKSPACE_FORMAT,
      version: o.version as number,
      savedAt: typeof o.savedAt === 'string' ? o.savedAt : new Date().toISOString(),
      motors: o.motors ?? [],
      batteries: o.batteries ?? [],
      propellers: o.propellers ?? [],
      benchTests: o.benchTests ?? [],
    },
    errors: [],
  };
}

// ---- CSV export of bench measurements (spec §15) -------------------------------------------

const CSV_COLUMNS = [
  'id',
  'timestamp',
  'motorId',
  'batteryId',
  'propellerId',
  'predicted_rpm',
  'measured_rpm',
  'error_rpm_pct',
  'predicted_thrust_kgf',
  'measured_thrust_kgf',
  'error_thrust_pct',
  'predicted_current_a',
  'measured_current_a',
  'error_current_pct',
  'predicted_voltage_v',
  'measured_voltage_v',
  'notes',
] as const;

function csvCell(v: string | number | undefined): string {
  if (v === undefined || (typeof v === 'number' && !Number.isFinite(v))) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function pct(predicted?: number, measured?: number): number | undefined {
  if (predicted === undefined || measured === undefined || !Number.isFinite(predicted)) return undefined;
  if (measured === 0) return undefined;
  return ((predicted - measured) / measured) * 100;
}

export function benchTestsToCsv(tests: BenchTest[]): string {
  const rows = [CSV_COLUMNS.join(',')];
  for (const t of tests) {
    rows.push(
      [
        csvCell(t.id),
        csvCell(t.timestamp),
        csvCell(t.motorId),
        csvCell(t.batteryId),
        csvCell(t.propellerId),
        csvCell(t.predicted.rpm),
        csvCell(t.measured.rpm),
        csvCell(pct(t.predicted.rpm, t.measured.rpm)),
        csvCell(t.predicted.thrustKgF),
        csvCell(t.measured.thrustKgF),
        csvCell(pct(t.predicted.thrustKgF, t.measured.thrustKgF)),
        csvCell(t.predicted.currentA),
        csvCell(t.measured.currentA),
        csvCell(pct(t.predicted.currentA, t.measured.currentA)),
        csvCell(t.predicted.loadedVoltageV),
        csvCell(t.measured.voltageV),
        csvCell(t.notes),
      ].join(','),
    );
  }
  return rows.join('\n');
}

// ---- browser side (thin, so the pure functions above stay testable) -----------------------

export function loadWorkspace(): Workspace | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  const text = localStorage.getItem(STORAGE_KEY);
  if (!text) return undefined;
  const { workspace } = parseWorkspace(text);
  return workspace;
}

export function saveWorkspace(ws: Workspace): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, serializeWorkspace(ws));
}

export function downloadFile(filename: string, contents: string, mime: string): void {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
