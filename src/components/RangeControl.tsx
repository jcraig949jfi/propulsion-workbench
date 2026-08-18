/**
 * Two-thumb range control over a set of DISCRETE values (v2).
 *
 * Built as two clamped sliders rather than an overlaid dual-thumb widget. An overlay looks
 * tidier on a desktop and is genuinely awkward on a phone — the thumbs collide, and grabbing
 * the one you meant at 10px separation is a coin flip. Two labelled sliders that clamp against
 * each other are unambiguous with a thumb, and keyboard-accessible for free.
 *
 * It snaps to the values that exist in the catalogue (Mode A), so there is no way to select a
 * diameter no propeller has.
 */
import type { ReactElement } from 'react';
import type { Range } from '../model/sweep';

interface Props {
  label: string;
  unit: string;
  values: number[];
  range: Range;
  onChange: (r: Range) => void;
}

export function RangeControl({ label, unit, values, range, onChange }: Props): ReactElement {
  if (values.length === 0) return <p className="muted">No values available.</p>;

  const idxOf = (v: number) => {
    let best = 0;
    values.forEach((x, i) => {
      if (Math.abs(x - v) < Math.abs(values[best] - v)) best = i;
    });
    return best;
  };

  const loIdx = idxOf(range.min);
  const hiIdx = idxOf(range.max);
  const count = values.filter((v) => v >= range.min && v <= range.max).length;

  return (
    <fieldset className="range-control">
      <legend>
        {label} — {range.min}{unit} to {range.max}{unit}{' '}
        <span className="range-count">({count} size{count === 1 ? '' : 's'})</span>
      </legend>

      <label className="range-row">
        <span>from</span>
        <input
          type="range"
          min={0}
          max={values.length - 1}
          step={1}
          value={loIdx}
          onChange={(e) => {
            const i = Number(e.target.value);
            onChange({ min: values[i], max: Math.max(values[i], range.max) });
          }}
        />
      </label>

      <label className="range-row">
        <span>to</span>
        <input
          type="range"
          min={0}
          max={values.length - 1}
          step={1}
          value={hiIdx}
          onChange={(e) => {
            const i = Number(e.target.value);
            onChange({ min: Math.min(values[i], range.min), max: values[i] });
          }}
        />
      </label>

      <div className="range-ends">
        <span>{values[0]}{unit}</span>
        <span>{values[values.length - 1]}{unit}</span>
      </div>
    </fieldset>
  );
}
