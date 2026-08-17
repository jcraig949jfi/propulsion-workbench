# Propulsion Workbench

A browser-based engineering workbench for model-aircraft **electric propulsion**. Pick a motor,
a battery and a propeller; see predicted loaded RPM, static thrust, current and power; compare
propellers; then record real bench measurements and see how wrong the model was.

Runs entirely in the browser. No backend, no database, no accounts. Hosted on GitHub Pages.

---

## What this is

A **working demonstration** of the concept, complete and usable as it stands. It ships with
example motors, LiPo packs and a grid of APC propeller sizes, so you can open it and immediately
do the thing it exists for: hold a motor and battery fixed, sweep diameter and pitch, and watch
RPM, thrust, current and power move.

**How much to trust the numbers.** The motor and battery physics are standard textbook relations
and are sound. The propeller side uses a *generic* pitch-ratio coefficient model rather than
coefficients measured from a specific blade. So:

- **Solid:** the direction and rough relative size of every change. Bigger diameter → lower RPM,
  more current, more thrust. More pitch → lower RPM, more current. Those come out of real
  physics. Ranking props against each other is what this is good at today.
- **Approximate:** absolute figures, roughly ±10–20%, and worse at coarse pitch (the generic
  model doesn't capture blade stall at zero airspeed, so it reads optimistically).

**Calibrating it is a first-class feature, not a caveat.** Record real bench measurements and the
app shows prediction-vs-measurement error per run, then error trends across the whole log. That
is what turns it from a calculator into an instrument, and the workflow is already built — click
**Load demo bench data** in the sidebar to see it working with synthetic measurements before
running a single motor.

See `MODEL.md` for every equation and every constant's origin.

---

## It is already live

**https://jcraig949jfi.github.io/propulsion-workbench/**

Repo: https://github.com/jcraig949jfi/propulsion-workbench

GitHub Pages is already configured to build from the Actions workflow, so there is nothing to
switch on. Every push to `main` reruns the tests, rebuilds and redeploys automatically — and if
the tests fail the deploy stops rather than shipping a broken calculator.

### Running it locally

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 110 tests
npm run build    # production build into dist/
```

---

## Using it

**Main screen.** Choose motor, battery and propeller on the left; the operating point appears on
the right with any warnings underneath. The diameter and pitch sliders snap to **real catalogue
propellers** — they never interpolate, because a value halfway between a 13×6 and a 13×8 is not a
propeller you can buy or test.

**Compare props.** Holds motor and battery fixed and sweeps diameter or pitch across the
catalogue, as a table and a chart. Rows in red exceed a rated limit.

**Record test.** Enter measured RPM, thrust, current, voltage. The prediction-versus-measurement
error appears as you type, and saving stores it in the browser.

**Test history.** Every saved test, filterable, with a chart of RPM prediction error by
propeller. Over time this is what reveals systematic bias — e.g. "the model always over-predicts
thrust on coarse pitch."

**Add hardware.** Add your own motors, packs and props. Records you enter are marked `MEASURED`
and the app treats them as authoritative. The shipped motors are labelled "Example" — realistic
for their size and class, deliberately not copied from any product's datasheet.

**Model & provenance.** Every model constant with its value, units, origin and explanation.
Placeholders are highlighted.

### Export your data

Bench measurements live in browser storage, which is *not* a safe place for experimental
results — clearing site data destroys them. Use **Export workspace (JSON)** to keep a real file,
and **Export bench tests (CSV)** to open the log in Excel. Import JSON to restore or to move
between machines.

---

## Making it about your hardware

Three steps, in increasing order of effort and payoff:

1. **Add your motors and packs** in the Hardware tab — Kv, winding resistance and no-load current
   from the datasheet or a meter. Winding resistance is the one that matters: without it there is
   no relationship between load and speed, and the app will tell you so rather than guess.
2. **Bench-test and record.** The history tab shows whether predictions run high or low and in
   which direction.
3. **Calibrate.** Either fit the four coefficient constants in `src/model/constants.ts`, or
   attach measured `staticCoefficients` to individual propellers — that switches those props off
   the generic model entirely.

If you have your own trusted calculations (Excel, Mathematica, a manufacturer's calculator), drop
them into `src/model/fixtures/reference-cases.json` and `npm test` will check this engine against
them automatically, within tolerances you set.

## What is deliberately not here

No optimiser, no AI suggestions, no accounts, no cloud, no aircraft aerodynamics, no custom blade
geometry. Those are all downstream of a model shown to predict real hardware. The order is:
**calculate → compare → measure → falsify → calibrate → optimise.**

## Layout

```
src/
  units/       unit conversions — the only place conversion constants live
  model/       physics engine. Pure TypeScript, no React, independently testable.
    constants.ts          every model constant with name/value/units/origin/explanation
    motor.ts              Kv/Rm/I0 motor relations
    battery.ts            source voltage behind an internal resistance
    propAero.ts           C_T / C_P coefficient model (placeholder + prop-data paths)
    solver.ts             bounded bisection root finder with diagnostics
    calculatePropulsion.ts  the one public function
    fixtures/             golden-master snapshots + your own reference cases
  data/        example motor/battery/propeller catalogue + synthetic demo bench data
  storage/     localStorage persistence, JSON/CSV export and import
  components/  React UI. Consumes the engine; contains no equations.
```

The important artifact is not the interface. It is one trustworthy function:

```ts
const result = calculatePropulsion({ motor, battery, propeller });
```
