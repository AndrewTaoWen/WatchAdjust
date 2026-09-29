import { describe, it, expect } from 'vitest';
import { getAnnualCalendarNotes } from '../src/calculations/calendar.js';

describe('annual calendar notes', () => {
  it('says 30/31-day months are automatic', () => {
    const text = getAnnualCalendarNotes(new Date(2026, 3, 30)).map((n) => n.text).join(' ');
    expect(text).toMatch(/by themselves/);
    expect(text).not.toMatch(/skip from the 30th/);
  });

  it('warns in February and on March 1st', () => {
    expect(getAnnualCalendarNotes(new Date(2026, 1, 10))[0].text).toMatch(/February 29/);
    expect(getAnnualCalendarNotes(new Date(2028, 1, 10))[0].text).toMatch(/February 30/);
    expect(getAnnualCalendarNotes(new Date(2026, 2, 1))[0].text).toMatch(/one day a year/);
  });
});
