# The physics model

Everything the calculator does, written out. Read this before trusting a number.

## Status

| Layer | State |
|---|---|
| Unit system | SI internally, converted only at UI boundaries. Sound. |
| Motor model | Standard three-parameter (Kv, Rm, I₀). Sound, with one stated simplification. |
| Battery model | Source voltage behind internal resistance. Sound but deliberately simple. |
| Propeller model | **Generic** — a pitch-ratio coefficient model, not fitted to a specific blade. |
| Solver | Bounded bisection over a physically derived bracket. Sound. |
| Code-stability regression | Golden-master snapshots committed; 154 tests green. |
| Validation against real hardware | **Not done** — no bench measurements recorded yet. |

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

Pack open-circuit voltage is a slider, 3.0 to 4.2 V per cell, defaulting to the 3.7 V/cell
nominal — a hot-off-the-charger 4.2 V/cell flatters every prediction, so it is not the default.

**The same slider approximates part throttle**, and the Throttle-response tab sweeps it as a
curve: one propeller, voltage from low stick to full pack, RPM/thrust/current against throttle
percent. Points below the voltage where the prop can overcome no-load losses are excluded — the
curve honestly starts where the prop starts.

**Why the approximation works:** An ESC chops the supply with PWM, and to first
order the motor sees a proportionally reduced voltage, so half throttle behaves roughly like half
the pack voltage. It is an approximation and worth naming as one: it ignores switching losses,
the ESC's own resistance at low duty cycle, and the fact that a real ESC's response is not
perfectly linear near the bottom of the stick. The *shape* is right, and it beats the alternative
of pretending every flight happens at wide-open throttle on a fresh pack.

The example packs ship with a representative healthy-pack internal resistance (~3 mΩ/cell at
5 Ah, scaled by capacity) so the demo shows voltage sag doing its job. It is labelled `EXAMPLE`,
not `MEASURED`: a real pack's IR is specific to that pack and rises as it ages. Enter your own
measured value for numbers about your hardware. If IR is left unset on a pack you add, the
calculator warns and models no sag at all — so RPM, current and thrust all read high.

Not yet modelled, each an independent future addition: state of charge through the flight, IR
rise with age or cold, cell imbalance.

## 3. Propeller — the generic part

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
2. **`PLACEHOLDER_PITCH_MODEL`** — a generic linear function of pitch ratio `p/D`, used when a
   propeller has no measured coefficients attached:

   ```
   C_T = (0.075 + 0.09 · p/D) · (blades/2)^0.8
   C_P = (0.010 + 0.075 · p/D) · (blades/2)^0.8
   ```

   Those five numbers are **not fitted to a specific propeller**. They were chosen to land in the
   range that published static data for small electric props occupies. They give sensible trends
   and roughly the right magnitudes; they are not a substitute for measured data on the blade in
   your hand. Any result using this path reports `MODEL_UNCALIBRATED` as an informational note.

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

The AXI motors are `MANUFACTURER` data with a datasheet URL on every record. One caveat travels
with them: AXI's "max current" is a **burst** rating with a stated duration (60 s, and only 20 s
on the 5360/20HD), not a continuous rating. The app warns when a prediction exceeds it; a green
light there is not permission to hold that current for a whole flight.

Records carry a `dataClass`: `MANUFACTURER`, `MEASURED`, `EXAMPLE`, `ASSUMED`, or `DERIVED`, plus
optional source name/URL/date.

The shipped motors and packs are `EXAMPLE` — representative for their size and class, and
deliberately **not** copied from any real product's datasheet, because typing plausible numbers
next to a manufacturer's name would be inventing a spec. They are named "Example" everywhere they
appear, which is why they do not also raise a per-calculation warning. Hardware you enter is
marked `MEASURED` and treated as authoritative. `ASSUMED` is reserved for records you have
entered but not confirmed, and those *do* raise `UNVERIFIED_INPUT_DATA` on every calculation.

Propeller geometry is seeded from APC product designations, which is safe because the
designation *is* the geometry. **No APC performance data is included.** Per the spec, APC's
published performance figures would be a second *model* to compare against, not ground truth —
the interesting comparison is three-way: your model, APC's model, your bench.

## 7. Calibrating it

The app is built to be calibrated; this is the intended workflow, not a disclaimer.

1. **Bench-test and record.** This answers the question that matters: *is the model right?* The
   history tab plots error by propeller, so systematic bias shows up as a trend rather than
   scatter. (Click **Load demo bench data** to see the whole loop working on synthetic
   measurements first — they are labelled `[DEMO DATA]` and removable in one click.)
2. **Fix the coefficients.** Either fit the four constants in `src/model/constants.ts`, or —
   better — attach per-prop `staticCoefficients`, which takes that propeller off the generic
   model entirely and silences its note.
3. **Optionally, pin it against your own calculations.** Drop cases from Excel, Mathematica or a
   manufacturer's calculator into `src/model/fixtures/reference-cases.json` and `npm test`
   compares this engine against them within tolerances you set. That answers a *different*
   question — *did the TypeScript reproduce my sheet?* — and the two are kept separate on purpose.

## 8. What the test suite does and does not prove

154 tests cover unit conversions, range sweeps and series grouping, motor filtering, the motor/battery/propeller relations (scaling laws, `Q·ω = P`
consistency, limit behaviour), solver convergence and refusal, persistence round-trips, and a set
of **golden-master** snapshots.

Golden masters are outputs of this engine, committed so that any future change to a number gets
caught. They prove the implementation is stable. They prove **nothing** about whether the physics
matches a real propeller — the values came from the engine, so reading them as validation would
be circular. Only bench measurements can answer that.
