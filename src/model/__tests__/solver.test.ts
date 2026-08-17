import { describe, expect, it } from 'vitest';
import { bisect } from '../solver';

describe('bounded solver', () => {
  it('finds a root of a simple function to its documented default tolerance', () => {
    const r = bisect((x) => x * x - 4, 0, 10);
    expect(r.diagnostics.converged).toBe(true);
    // Default toleranceX is 1e-4, so 1e-4 in x is exactly what is promised — asserting more
    // would be testing luck rather than the contract.
    expect(Math.abs(r.x - 2)).toBeLessThanOrEqual(1e-4);
  });

  it('tightens with toleranceX, so the knob does what it says', () => {
    const loose = bisect((x) => x * x - 4, 0, 10, { toleranceX: 1e-2, toleranceF: 0 });
    const tight = bisect((x) => x * x - 4, 0, 10, { toleranceX: 1e-9, toleranceF: 0 });
    expect(Math.abs(tight.x - 2)).toBeLessThan(Math.abs(loose.x - 2));
    expect(Math.abs(tight.x - 2)).toBeLessThanOrEqual(1e-9);
    expect(tight.diagnostics.iterations).toBeGreaterThan(loose.diagnostics.iterations);
  });

  it('reports iterations and residual', () => {
    const r = bisect((x) => x - 1.234, 0, 100);
    expect(r.diagnostics.iterations).toBeGreaterThan(0);
    expect(Math.abs(r.diagnostics.residual ?? 1)).toBeLessThan(1e-3);
  });

  it('accepts an endpoint that is already a root', () => {
    const r = bisect((x) => x, 0, 10);
    expect(r.diagnostics.converged).toBe(true);
    expect(r.x).toBe(0);
  });

  it('refuses a bracket with no sign change instead of guessing', () => {
    const r = bisect((x) => x * x + 1, 0, 10);
    expect(r.diagnostics.converged).toBe(false);
    expect(Number.isNaN(r.x)).toBe(true);
    expect(r.diagnostics.message).toMatch(/no sign change/);
  });

  it('refuses a non-finite endpoint', () => {
    const r = bisect((x) => (x === 0 ? Number.NaN : x - 1), 0, 10);
    expect(r.diagnostics.converged).toBe(false);
    expect(Number.isNaN(r.x)).toBe(true);
  });

  it('returns NaN rather than the last iterate when it runs out of iterations', () => {
    // A near-vertical step forces the bracket to stay wide relative to a tight tolerance.
    const r = bisect((x) => (x < 5 ? -1 : 1), 0, 10, {
      maxIterations: 3,
      toleranceX: 1e-12,
      toleranceF: 1e-12,
    });
    expect(r.diagnostics.converged).toBe(false);
    expect(Number.isNaN(r.x)).toBe(true);
    expect(r.diagnostics.message).toMatch(/did not converge/);
  });

  it('carries the bracket into diagnostics for debugging', () => {
    const r = bisect((x) => x - 3, 1, 7);
    expect(r.diagnostics.bracketLowRpm).toBe(1);
    expect(r.diagnostics.bracketHighRpm).toBe(7);
  });
});
