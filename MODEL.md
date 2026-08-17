# The physics model

Everything the calculator does, written out. Read this before trusting a number.

## Status

| Layer | State |
|---|---|
| Unit system | SI internally, converted only at UI boundaries. Sound. |
| Motor model | Standard three-parameter (Kv, Rm, I₀). Sound, with one stated simplification. |
| Battery model | Source voltage behind internal resistance. Sound but deliberately simple. |
| Propeller model | **UNCALIBRATED** — four unfitted placeholder coefficients. |
| Solver | Bounded bisection over a physically derived bracket. Sound. |
| Validation against Mark's calculations | **NOT DONE** — no reference cases supplied. |
| Validation against real hardware | **NOT DONE** — no bench tests recorded. |

## 1. Motor

Three parameters: `Kv` (rpm/V), `Rm` (winding resistance, Ω), `I₀` (no-load current, A).

```
torque constant   Kt   = 60 / (2π·Kv)          [N·m/A]
back-EMF          Vemf = rpm / Kv              [V]
shaft torque      Q    = Kt · (I − I₀)         [N·m]
```

`Kt = 60/(2π·Kv)` is not an empirical fit — it is what makes Kv in rpm/V and Kt in N·m/A
describe the same machine.

**Stated simplification:** I₀ is treated as constant. Real no-load current rises with RPM as iron
and windage losses grow, so the model is slightly optimistic about available shaft torque at high
RPM, and therefore predicts marginally high RPM and thrust. Bounded and known, not hidden.

## 2. Battery

```
open-circuit voltage  Voc  = nominal (default) or fully-charged, user's choice
loaded voltage        V    = Voc − I·R_internal
```

Nominal is the default rather than fully charged, because a hot-off-the-charger 4.2 V/cell
flatters every prediction. Switch to fully charged when comparing against a bench test done at
the start of a pack.

Internal resistance ships **unset**, and the calculator warns while it is missing rather than
guessing — an unmeasured loss is more honestly represented as absent-and-flagged than as an
invented number. With it unset there is no voltage sag, so RPM, current and thrust all read high.

Not yet modelled, each an independent future addition: state of charge through the flight, IR
rise with age or cold, cell imbalance.

## 3. Propeller — the uncalibrated part

The non-dimensional form is standard and not adjustable:

```
thrust   T = C_T · ρ · n² · D⁴      [N]
power    P = C_P · ρ · n³ · D⁵      [W]
torque   Q = C_P · ρ · n² · D⁵ / (2π)   [N·m]
```

with `n` in rev/s and `D` in metres. The tests verify the scaling laws that follow from this
(doubling RPM quadruples thrust; doubling diameter multiplies thrust by 16; Q·ω = P exactly).

**Where C_T and C_P come from is the problem.** Two paths, and the result always reports which
one was used:

1. **`PROP_DATA`** — coefficients attached to the propeller record via `staticCoefficients`.
   Trustworthy. This is the hook for APC data or your own bench fit.
2. **`PLACEHOLDER_PITCH_MODEL`** — a linear function of pitch ratio `p/D`:

   ```
   C_T = (0.075 + 0.09 · p/D) · (blades/2)^0.8
   C_P = (0.010 + 0.075 · p/D) · (blades/2)^0.8
   ```

   Those five numbers are **unfitted**. They were chosen to land in the range that published
   static data for small electric props occupies, and nothing more. Any result using this path
   raises `MODEL_UNCALIBRATED`.

**Known direction of error:** a real blade's static C_T does not keep rising linearly with pitch
ratio, because the sections stall at zero advance. The placeholder therefore **over-predicts
static thrust for coarse-pitch props, and worse the coarser the pitch.** Comparisons at one
diameter across a modest pitch range are more trustworthy than a wide pitch sweep.

**Why no propeller efficiency is shown:** propulsive efficiency is `T·V / P_shaft`, which is
identically zero when airspeed V = 0. Reporting "0%" or inventing a static efficiency would both
be wrong, so the app reports **thrust per watt** (N/W) instead — the right way to rank props on a
static bench.

## 4. Loaded equilibrium

The whole point. `RPM = Kv × volts` is the *unloaded* speed and is never the answer.

Under load the propeller demands torque, current rises, motor and battery voltage losses grow,
and RPM falls until available and required torque agree. Substituting the loop equation

```
Voc = I·(R_batt + R_esc) + I·Rm + rpm/Kv
```

gives current directly as a function of RPM, so voltage sag needs no separate iteration:

```
I(rpm) = (Voc − rpm/Kv) / (Rm + R_batt + R_esc)
```

The solver then finds the root of

```
f(rpm) = Q_motor(rpm) − Q_prop(rpm) = 0
```

**Bisection, over a bracket that is known in advance and physically meaningful:**

- at `rpm = 0`: motor torque is at its stall maximum, prop torque is exactly zero → `f > 0`
- at `rpm = Kv·Voc`: back-EMF equals the supply so current is zero and shaft torque is `−Kt·I₀`
  (negative), while prop torque is large → `f < 0`

A guaranteed sign change means bisection cannot diverge, cannot overshoot into negative RPM, and
needs no derivative — worth more here than Newton's speed. **If it does not converge, the function
returns NaN and an error-severity warning, never the last iterate.**

## 5. Warnings

`MOTOR_CURRENT_EXCEEDED`, `MOTOR_POWER_EXCEEDED`, `BATTERY_CURRENT_EXCEEDED`,
`SOLVER_DID_NOT_CONVERGE`, `MISSING_MOTOR_PARAMETER`, `MISSING_BATTERY_PARAMETER`,
`EXTRAPOLATED_OUTSIDE_VALIDATED_RANGE`, `MODEL_UNCALIBRATED`, `UNVERIFIED_INPUT_DATA`.

Missing winding resistance is a hard stop: without it there is no relation between load and
speed at all, so the app reports no operating point rather than a fabricated one.

## 6. Provenance

Records carry a `dataClass`: `MANUFACTURER`, `MEASURED`, `ASSUMED`, or `DERIVED`, plus optional
source name/URL/date. The seeded example motors are `ASSUMED` — plausible values for a motor of
that size, **not** any real product's datasheet — and every calculation using one raises
`UNVERIFIED_INPUT_DATA`. Entering your own motor marks it `MEASURED` and the warning clears.

Propeller geometry is seeded from APC product designations, which is safe because the
designation *is* the geometry. **No APC performance data is included.** Per the spec, APC's
published performance figures would be a second *model* to compare against, not ground truth —
the interesting comparison is three-way: your model, APC's model, your bench.

## 7. Calibrating it

1. Put your Excel/Mathematica cases into `src/model/fixtures/reference-cases.json`. `npm test`
   then compares this engine against them within your stated tolerances. This answers *"did the
   TypeScript reproduce my sheet?"*
2. Bench-test and record. This answers the different and more important question, *"is the model
   right?"* — the two are kept separate on purpose.
3. When bench data shows systematic bias, either fit the four placeholder constants in
   `src/model/constants.ts`, or attach per-prop `staticCoefficients` (better — it removes the
   guesswork for that prop entirely and silences its warning).
