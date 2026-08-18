# Propulsion Workbench

A browser-based engineering workbench for model-aircraft **electric propulsion**. Pick a motor,
a battery and a propeller; see predicted loaded RPM, static thrust, current and power; compare
propellers; then record real bench measurements and see how wrong the model was.

Runs entirely in the browser. No backend, no database, no accounts. Hosted on GitHub Pages.

---

## What this is

A **working demonstration** of the concept, complete and usable as it stands. Hold a motor and
battery fixed, sweep propeller diameter and pitch, and watch RPM, thrust, current and power move.

### New in v2

- **Seven real AXI motors**, transcribed from the manufacturer's own specification tables and
  carrying their datasheet URLs — AXI because it publishes internal resistance and no-load
  current, the two numbers most makers omit and this calculator cannot work without. The
  generic "Example" motors are still there for comparison.
- **44 APC propeller sizes**, 10″ to 22″. Sizes confirmed against retail listings are marked as
  manufacturer data; standard sizes not individually confirmed are marked unverified, and the
  app says so when you pick one.
- **Range sliders** — set a diameter *window* and a pitch *window* rather than one value at a
  time. Every real catalogue prop inside becomes a point.
- **Choose your own axes** — put anything on X, anything on the left Y, and a *second* quantity
  on a right-hand axis, so thrust and current can be read together instead of toggled between.
  Split the family into one line per diameter (or per pitch) to see a two-variable sweep
  honestly on a flat chart.

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

## It is already live — and every version runs side by side

| | |
|---|---|
| **latest** | https://jcraig949jfi.github.io/propulsion-workbench/ |
| v1 — original MVP | https://jcraig949jfi.github.io/propulsion-workbench/v1/ |
| v2 — self-contained demo + mobile | https://jcraig949jfi.github.io/propulsion-workbench/v2/ |
| v3 — real hardware & range sweeps | https://jcraig949jfi.github.io/propulsion-workbench/v3/ |
| what changed | https://jcraig949jfi.github.io/propulsion-workbench/versions.html |

Releases do not overwrite each other. Each version is built from its own commit with its own
lockfile — v1 is v1 as it actually shipped — and each keeps its **own saved bench tests**, so
trying one cannot disturb another.

Every version carries a **sticky bar across the top** saying that three versions are live, with
one tap to switch between them and the current one marked. On a desktop the buttons are named
(Original / Demo + mobile / Latest); on a phone they shorten to v1 / v2 / v3 so the bar still
fits on one line.

Build them all locally with `node scripts/build-versions.mjs` (output in `dist-all/`).

Repo: https://github.com/jcraig949jfi/propulsion-workbench

GitHub Pages is already configured to build from the Actions workflow, so there is nothing to
switch on. Every push to `main` reruns the tests, rebuilds all versions and redeploys — and if
the tests fail the deploy stops rather than shipping a broken calculator.

### Running it locally

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 130 tests
npm run build    # production build into dist/
```

---

## Using it

**Main screen.** Choose motor, battery and propeller on the left; the operating point appears on
the right with any warnings underneath. The diameter and pitch sliders snap to **real catalogue
propellers** — they never interpolate, because a value halfway between a 13×6 and a 13×8 is not a
propeller you can buy or test.

**Explore range.** The v2 view. Two range sliders define a family of real propellers; the chart
below plots it with axes you choose. It also names the most efficient prop in the window that
stays inside every rating.

**Compare props.** The simpler v1 view: steps one variable at a time across the catalogue, as a
table and a chart. Rows in red exceed a rated limit.

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
