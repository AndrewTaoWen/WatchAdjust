import { describe, it, expect } from 'vitest';
import { getMoonPhase, getMoonPhaseName, isSouthernTimezone } from '../src/calculations/moonPhase.js';

// Phase is a fraction of the cycle; half a day is ~0.017.
const HALF_DAY = 0.5 / 29.53;
const near = (phase, expected) => {
  const d = Math.abs(phase - expected);
  return Math.min(d, 1 - d);
};

describe('getMoonPhase', () => {
  it('matches published new, quarter and full moons to within half a day', () => {
    expect(near(getMoonPhase(new Date(Date.UTC(2024, 3, 8, 18, 21))), 0)).toBeLessThan(HALF_DAY);
    expect(near(getMoonPhase(new Date(Date.UTC(2024, 3, 15, 19, 13))), 0.25)).toBeLessThan(HALF_DAY);
    expect(near(getMoonPhase(new Date(Date.UTC(2024, 3, 23, 23, 49))), 0.5)).toBeLessThan(HALF_DAY);
    expect(near(getMoonPhase(new Date(Date.UTC(2025, 0, 13, 22, 27))), 0.5)).toBeLessThan(HALF_DAY);
  });
});

describe('hemisphere', () => {
  it('swaps the lit side in the Southern Hemisphere', () => {
    expect(getMoonPhaseName(0.1).desc).toContain('right');
    expect(getMoonPhaseName(0.1, true).desc).toContain('left');
  });

  it('guesses southern time zones', () => {
    expect(isSouthernTimezone('Australia/Sydney')).toBe(true);
    expect(isSouthernTimezone('America/Argentina/Buenos_Aires')).toBe(true);
    expect(isSouthernTimezone('Europe/London')).toBe(false);
    expect(isSouthernTimezone('America/New_York')).toBe(false);
  });
});
