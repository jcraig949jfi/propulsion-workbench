import { describe, expect, it } from 'vitest';
import {
  filterMotors,
  fullRangeFilter,
  isFullRange,
  matchesFilter,
  motorBounds,
  unknownCount,
} from '../motorFilter';
import { SEED_MOTORS } from '../../data/hardware';
import type { Motor } from '../types';

const m = (over: Partial<Motor>): Motor => ({
  id: 'm',
  manufacturer: 'Test',
  model: 'X',
  kvRpmPerVolt: 1000,
  ...over,
});

describe('motorBounds', () => {
  it('spans the values present in the catalogue', () => {
    const b = motorBounds(SEED_MOTORS, 'massG')!;
    expect(b.min).toBe(20);
    expect(b.max).toBe(1270);
  });

  it('returns nothing when no motor has the field', () => {
    expect(motorBounds([m({ massG: undefined })], 'massG')).toBeUndefined();
  });
});

describe('matchesFilter', () => {
  it('keeps a motor inside every range', () => {
    expect(matchesFilter(m({ kvRpmPerVolt: 900, massG: 100 }), {
      kv: { min: 500, max: 1000 },
      massG: { min: 50, max: 200 },
    })).toBe(true);
  });

  it('drops a motor outside any one range', () => {
    expect(matchesFilter(m({ kvRpmPerVolt: 2000, massG: 100 }), {
      kv: { min: 500, max: 1000 },
    })).toBe(false);
  });

  it('KEEPS a motor whose value is unknown rather than hiding it', () => {
    // The alternative would silently drop hardware because a maker omitted a figure.
    expect(matchesFilter(m({ massG: undefined }), { massG: { min: 50, max: 60 } })).toBe(true);
  });

  it('matches free text on manufacturer or model, case-insensitively', () => {
    const axi = m({ manufacturer: 'AXI', model: '2820/10 Gold Line' });
    expect(matchesFilter(axi, { search: 'axi' })).toBe(true);
    expect(matchesFilter(axi, { search: '2820' })).toBe(true);
    expect(matchesFilter(axi, { search: 'hacker' })).toBe(false);
  });

  it('ignores an empty search string', () => {
    expect(matchesFilter(m({}), { search: '   ' })).toBe(true);
  });
});

describe('filterMotors on the real catalogue', () => {
  it('narrows to park-flyer sizes', () => {
    const small = filterMotors(SEED_MOTORS, { massG: { min: 0, max: 60 } });
    expect(small.length).toBeGreaterThan(2);
    for (const motor of small) {
      expect(motor.massG === undefined || motor.massG <= 60).toBe(true);
    }
    expect(small.some((x) => x.id === 'axi-5360-20hd-v3')).toBe(false);
  });

  it('narrows by Kv', () => {
    const lowKv = filterMotors(SEED_MOTORS, { kv: { min: 100, max: 400 } });
    expect(lowKv.map((x) => x.id)).toContain('axi-4130-20-v3');
    expect(lowKv.map((x) => x.id)).not.toContain('axi-2208-20');
  });

  it('combines constraints', () => {
    const both = filterMotors(SEED_MOTORS, {
      kv: { min: 800, max: 1300 },
      massG: { min: 0, max: 200 },
    });
    for (const motor of both) {
      expect(motor.kvRpmPerVolt).toBeGreaterThanOrEqual(800);
      expect(motor.kvRpmPerVolt).toBeLessThanOrEqual(1300);
    }
  });

  it('returns everything for a full-range filter', () => {
    expect(filterMotors(SEED_MOTORS, fullRangeFilter(SEED_MOTORS))).toHaveLength(
      SEED_MOTORS.length,
    );
  });

  it('can return nothing, and says so by being empty rather than falling back', () => {
    expect(filterMotors(SEED_MOTORS, { kv: { min: 9000, max: 9999 } })).toHaveLength(0);
  });
});

describe('reporting', () => {
  it('counts motors missing a filtered field', () => {
    expect(unknownCount(SEED_MOTORS, 'maxPowerW')).toBeGreaterThan(0);
    expect(unknownCount(SEED_MOTORS, 'kvRpmPerVolt')).toBe(0);
  });

  it('recognises an un-narrowed filter', () => {
    expect(isFullRange(SEED_MOTORS, fullRangeFilter(SEED_MOTORS))).toBe(true);
  });

  it('recognises a narrowed filter', () => {
    const f = fullRangeFilter(SEED_MOTORS);
    f.massG = { min: 0, max: 100 };
    expect(isFullRange(SEED_MOTORS, f)).toBe(false);
  });

  it('treats a search term as narrowing', () => {
    expect(isFullRange(SEED_MOTORS, { ...fullRangeFilter(SEED_MOTORS), search: 'axi' })).toBe(false);
  });
});
