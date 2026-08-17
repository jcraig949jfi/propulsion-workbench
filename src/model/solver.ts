/**
 * Bounded root finder for the loaded-equilibrium problem.
 *
 * Spec §19: keep the solver isolated, use a bounded method, return diagnostics, and never
 * silently return the last iteration when convergence fails.
 *
 * Bisection is chosen over Newton deliberately. The bracket is known a priori and physically
 * meaningful:
 *
 *   at rpm = 0            motor torque is at its stall maximum, prop torque is exactly zero
 *                         => f(0) > 0
 *   at rpm = noLoadRpm    back-EMF equals the supply so current is 0 and shaft torque is
 *                         -Kt*I0 (negative), while prop torque is large positive
 *                         => f(noLoad) < 0
 *
 * A sign change across a known bracket means bisection cannot diverge, cannot overshoot into
 * unphysical negative RPM, and needs no derivative — worth more here than Newton's speed.
 */
import type { SolverDiagnostics } from './types';

export interface BisectionOptions {
  /** Absolute tolerance on the bracket width, in the units of x (RPM). */
  toleranceX?: number;
  /** Absolute tolerance on |f(x)| — for torque balance, N*m. */
  toleranceF?: number;
  maxIterations?: number;
}

export interface BisectionResult {
  x: number;
  diagnostics: SolverDiagnostics;
}

/**
 * Find x in [lo, hi] with f(x) = 0, requiring a sign change across the bracket.
 *
 * On failure `diagnostics.converged` is false and the caller MUST NOT use `x` as an answer —
 * `calculatePropulsion` turns that into a SOLVER_DID_NOT_CONVERGE error rather than a number.
 */
export function bisect(
  f: (x: number) => number,
  lo: number,
  hi: number,
  options: BisectionOptions = {},
): BisectionResult {
  const tolX = options.toleranceX ?? 1e-4;
  const tolF = options.toleranceF ?? 1e-9;
  const maxIter = options.maxIterations ?? 200;

  let a = lo;
  let b = hi;
  let fa = f(a);
  let fb = f(b);
  let iterations = 0;

  if (!Number.isFinite(fa) || !Number.isFinite(fb)) {
    return {
      x: Number.NaN,
      diagnostics: {
        converged: false,
        iterations,
        message: 'f is not finite at a bracket endpoint',
        bracketLowRpm: lo,
        bracketHighRpm: hi,
      },
    };
  }

  // An endpoint that is already a root is a legitimate answer (e.g. a prop so large the motor
  // cannot turn it at all gives x = 0).
  if (Math.abs(fa) <= tolF) {
    return {
      x: a,
      diagnostics: { converged: true, iterations, residual: fa, bracketLowRpm: lo, bracketHighRpm: hi },
    };
  }
  if (Math.abs(fb) <= tolF) {
    return {
      x: b,
      diagnostics: { converged: true, iterations, residual: fb, bracketLowRpm: lo, bracketHighRpm: hi },
    };
  }

  if (fa * fb > 0) {
    return {
      x: Number.NaN,
      diagnostics: {
        converged: false,
        iterations,
        message:
          `no sign change across the bracket: f(${lo}) = ${fa.toExponential(3)}, ` +
          `f(${hi}) = ${fb.toExponential(3)}. The equilibrium is not inside [${lo}, ${hi}].`,
        bracketLowRpm: lo,
        bracketHighRpm: hi,
      },
    };
  }

  let mid = a;
  let fmid = fa;

  while (iterations < maxIter) {
    iterations += 1;
    mid = 0.5 * (a + b);
    fmid = f(mid);

    if (Math.abs(fmid) <= tolF || b - a <= tolX) {
      return {
        x: mid,
        diagnostics: {
          converged: true,
          iterations,
          residual: fmid,
          bracketLowRpm: lo,
          bracketHighRpm: hi,
        },
      };
    }

    if (fa * fmid < 0) {
      b = mid;
      fb = fmid;
    } else {
      a = mid;
      fa = fmid;
    }
  }

  return {
    x: Number.NaN, // deliberately NOT `mid` — see the module docstring
    diagnostics: {
      converged: false,
      iterations,
      residual: fmid,
      message:
        `did not converge in ${maxIter} iterations; last bracket [${a.toFixed(3)}, ${b.toFixed(3)}], ` +
        `residual ${fmid.toExponential(3)} N*m. Returning NaN rather than the last iterate.`,
      bracketLowRpm: lo,
      bracketHighRpm: hi,
    },
  };
}
