# Propulsion Workbench

A browser-based engineering workbench for model-aircraft **electric propulsion**. Pick a motor,
a battery and a propeller; see predicted loaded RPM, static thrust, current and power; compare
propellers; then record real bench measurements and see how wrong the model was.

Runs entirely in the browser. No backend, no database, no accounts. Hosted on GitHub Pages.

---

## Read this first

**The physics model is currently UNCALIBRATED, and the app says so on every screen.**

The motor and battery models are standard textbook relations and should be sound. The
*propeller* model is not: it uses four unfitted placeholder coefficients, because no measured
propeller data has been supplied yet. So:

- **Trustworthy now:** the *direction* and rough *relative size* of changes. Bigger diameter →
  lower RPM, more current, more thrust. More pitch → lower RPM, more current. Those relationships
  come out of real physics and will hold.
- **Not trustworthy yet:** the absolute numbers. A predicted "2.31 kg" is provisional.

Two things fix that, in order:

1. **Add your reference cases** from the Excel/Mathematica work to
   `src/model/fixtures/reference-cases.json` (the file's comment block shows the exact shape).
   The test suite currently prints `MILESTONE 1 GATE: UNMET` because that file is empty. It was
   left empty deliberately — inventing numbers there would make the tests pass while proving
   nothing.
2. **Bench-test and record.** Once measurements are in, the error table and history chart show
   whether the model runs high or low, and by how much. That is what turns it from a calculator
   into an instrument.

See `MODEL.md` for the equations and every constant's origin.

---

## Getting it onto GitHub Pages

You need a free GitHub account. Steps, once:

1. **Create an empty repository** on GitHub — call it `propulsion-workbench`. Don't add a README
   or .gitignore; this folder already has them.

2. **Push this folder to it.** From this directory:

   ```bash
   git remote add origin https://github.com/<your-username>/propulsion-workbench.git
   git branch -M main
   git push -u origin main
   ```

   (The repo is already `git init`-ed with a first commit.)

3. **Turn on Pages with Actions.** In the repo on GitHub: **Settings → Pages → Build and
   deployment → Source → GitHub Actions**. That is the only setting to change.

4. **Wait for the build.** The **Actions** tab shows a "Deploy to GitHub Pages" run. It installs
   dependencies, runs the tests, builds, and publishes. Two minutes or so.

5. **Open the site** at `https://<your-username>.github.io/propulsion-workbench/`.

Every later `git push` to `main` redeploys automatically. If the tests fail, the deploy stops —
that is intentional.

### Running it locally

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 66 tests
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

**Add hardware.** Add your own motors, packs and props. Records you enter are marked `MEASURED`,
which clears the "unverified data" warning that the seeded example motors carry.

**Model & provenance.** Every model constant with its value, units, origin and explanation.
Placeholders are highlighted.

### Export your data

Bench measurements live in browser storage, which is *not* a safe place for experimental
results — clearing site data destroys them. Use **Export workspace (JSON)** to keep a real file,
and **Export bench tests (CSV)** to open the log in Excel. Import JSON to restore or to move
between machines.

---

## What is deliberately not here

No optimiser, no AI suggestions, no accounts, no cloud, no aircraft aerodynamics, no custom blade
geometry. Those are all downstream of a model that has been shown to predict real hardware, and
that has not happened yet. The order is: **calculate → compare → measure → falsify → calibrate →
optimise.**

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
    fixtures/             your reference cases go here
  data/        seed motor/battery/propeller catalogue
  storage/     localStorage persistence, JSON/CSV export and import
  components/  React UI. Consumes the engine; contains no equations.
```

The important artifact is not the interface. It is one trustworthy function:

```ts
const result = calculatePropulsion({ motor, battery, propeller });
```
