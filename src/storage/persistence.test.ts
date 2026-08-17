import { describe, expect, it } from 'vitest';
import {
  WORKSPACE_FORMAT,
  WORKSPACE_VERSION,
  benchTestsToCsv,
  emptyWorkspace,
  parseWorkspace,
  serializeWorkspace,
} from './persistence';
import type { BenchTest } from '../model/types';

const test = (over: Partial<BenchTest> = {}): BenchTest => ({
  id: 't1',
  timestamp: '2026-08-17T10:00:00.000Z',
  motorId: 'm1',
  batteryId: 'b1',
  propellerId: 'p1',
  predicted: {
    rpm: 7840,
    thrustKgF: 2.31,
    currentA: 37.2,
    loadedVoltageV: 14.78,
    warnings: [],
    diagnostics: { converged: true, iterations: 30 },
  },
  measured: { rpm: 7710, thrustKgF: 2.24, currentA: 39.0, voltageV: 14.6 },
  ...over,
});

describe('workspace round trip', () => {
  it('serialises and parses without loss', () => {
    const ws = { ...emptyWorkspace(), benchTests: [test()] };
    const parsed = parseWorkspace(serializeWorkspace(ws));
    expect(parsed.errors).toEqual([]);
    expect(parsed.workspace!.benchTests).toHaveLength(1);
    expect(parsed.workspace!.benchTests[0].measured.rpm).toBe(7710);
  });

  it('rejects invalid JSON loudly', () => {
    const r = parseWorkspace('{not json');
    expect(r.workspace).toBeUndefined();
    expect(r.errors[0]).toMatch(/not valid JSON/);
  });

  it('refuses a foreign file rather than merging it', () => {
    const r = parseWorkspace(JSON.stringify({ format: 'something-else', version: 1 }));
    expect(r.workspace).toBeUndefined();
    expect(r.errors.join(' ')).toMatch(/unexpected format/);
  });

  it('refuses a file from a newer app version', () => {
    const r = parseWorkspace(
      JSON.stringify({ format: WORKSPACE_FORMAT, version: WORKSPACE_VERSION + 5 }),
    );
    expect(r.workspace).toBeUndefined();
    expect(r.errors.join(' ')).toMatch(/newer than this app understands/);
  });

  it('tolerates missing arrays by defaulting them empty', () => {
    const r = parseWorkspace(JSON.stringify({ format: WORKSPACE_FORMAT, version: 1 }));
    expect(r.errors).toEqual([]);
    expect(r.workspace!.motors).toEqual([]);
    expect(r.workspace!.benchTests).toEqual([]);
  });

  it('rejects a non-array where an array belongs', () => {
    const r = parseWorkspace(
      JSON.stringify({ format: WORKSPACE_FORMAT, version: 1, benchTests: 'nope' }),
    );
    expect(r.errors.join(' ')).toMatch(/benchTests is not an array/);
  });
});

describe('CSV export', () => {
  it('emits a header and one row per test', () => {
    const csv = benchTestsToCsv([test(), test({ id: 't2' })]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^id,timestamp,motorId/);
  });

  it('includes computed percentage errors', () => {
    const csv = benchTestsToCsv([test()]);
    const cols = csv.split('\n')[1].split(',');
    const header = csv.split('\n')[0].split(',');
    const rpmErr = Number(cols[header.indexOf('error_rpm_pct')]);
    expect(rpmErr).toBeCloseTo(((7840 - 7710) / 7710) * 100, 6);
  });

  it('leaves cells empty rather than writing NaN or undefined', () => {
    const csv = benchTestsToCsv([test({ measured: {} })]);
    expect(csv).not.toMatch(/NaN|undefined/);
  });

  it('quotes notes containing commas and quotes', () => {
    const csv = benchTestsToCsv([test({ notes: 'windy, gusty "bad" day' })]);
    expect(csv).toMatch(/"windy, gusty ""bad"" day"/);
  });

  it('handles an empty log', () => {
    expect(benchTestsToCsv([]).split('\n')).toHaveLength(1);
  });
});
