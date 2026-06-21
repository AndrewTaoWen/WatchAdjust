import {
  getMoonPhase,
  getMoonIllumination,
  getMoonPhaseName,
  getMoonDiscRotation,
  getDaysUntilNextPhase,
} from './moonPhase.js';
import {
  getDayName,
  getMonthName,
  formatTime12h,
  formatTime24h,
  getAnnualCalendarNotes,
  getPerpetualCalendarNotes,
} from './calendar.js';

function step(title, detail) {
  return { title, detail };
}

function note(type, text) {
  return { type, text };
}

export function computeAdjustments(type, date) {
  switch (type) {
    case 'moon-phase':
      return computeMoonPhase(date);
    case 'annual-calendar':
      return computeAnnualCalendar(date);
    case 'perpetual-calendar':
      return computePerpetualCalendar(date);
    case 'day-date':
      return computeDayDate(date);
    case 'complete-calendar':
      return computeCompleteCalendar(date);
    default:
      return computeMoonPhase(date);
  }
}

function computeMoonPhase(date) {
  const phase = getMoonPhase(date);
  const { name, desc } = getMoonPhaseName(phase);
  const illumination = getMoonIllumination(phase);
  const rotation = getMoonDiscRotation(phase);
  const daysToNew = getDaysUntilNextPhase(phase, 0);
  const daysToFull = getDaysUntilNextPhase(phase, 0.5);

  return {
    title: 'Moon Phase',
    summary: `Set moon disc to ${name} (${illumination}% illuminated)`,
    values: {
      phase: name,
      illumination: `${illumination}%`,
      discRotation: `${Math.round(phase * 360)}°`,
      lunarAge: `${(phase * 29.53).toFixed(1)} days`,
    },
    steps: [
      step(
        'Pull crown to time-setting position',
        'Most moon phase watches adjust the moon disc via the crown in the second or third position. Consult your manual if yours uses pushers.',
      ),
      step(
        'Advance time forward',
        'Rotate the crown clockwise, advancing the hour hand through a full 24-hour cycle. The moon disc advances roughly one day per 24 hours of hand movement.',
      ),
      step(
        `Align to ${name}`,
        `Stop when the aperture shows ${desc}. Target illumination is approximately ${illumination}%.`,
      ),
      step(
        'Verify against reference',
        'Compare with a lunar calendar or tonight\'s sky. Fine-tune by advancing or reversing time in small increments.',
      ),
    ],
    notes: [
      note('info', `Current lunar age: ${(phase * 29.53).toFixed(1)} days since new moon.`),
      note('info', `Next new moon in ~${daysToNew.toFixed(1)} days. Next full moon in ~${daysToFull.toFixed(1)} days.`),
      note('info', 'Moon phase accuracy drifts ~1 day every 2.7 years on most watches — plan a reset periodically.'),
    ],
    scene: {
      moonPhase: phase,
      moonRotation: rotation,
      showMoon: true,
      showDayDate: false,
      showMonth: false,
      showYear: false,
    },
  };
}

function computeAnnualCalendar(date) {
  const day = getDayName(date);
  const month = getMonthName(date);
  const dateNum = date.getDate();
  const year = date.getFullYear();
  const time = formatTime12h(date);

  return {
    title: 'Annual Calendar',
    summary: `Set to ${day}, ${month} ${dateNum}, ${year} at ${time}`,
    values: {
      dayOfWeek: day,
      date: dateNum.toString(),
      month,
      year: year.toString(),
      time,
    },
    steps: [
      step(
        'Set the time first',
        `Advance the hands to ${formatTime24h(date)} (${time}). Use the crown in position 2 (time-setting).`,
      ),
      step(
        'Set the date',
        `Use the quick-set date pusher or crown in date-setting position. Advance until the date window reads ${dateNum}.`,
      ),
      step(
        'Set the month',
        `Adjust the month subdial or window to ${month}. This may require a dedicated corrector on the case.`,
      ),
      step(
        'Set the day of week',
        `Advance the day-of-week indicator until it displays ${day}.`,
      ),
      step(
        'Verify all windows',
        `Confirm: ${day} · ${month} ${dateNum}, ${year} · ${time}. All indicators should match.`,
      ),
    ],
    notes: getAnnualCalendarNotes(date),
    scene: {
      moonPhase: getMoonPhase(date),
      showMoon: false,
      showDayDate: true,
      showMonth: true,
      showYear: false,
      dayIndex: date.getDay(),
      dateNum,
      monthIndex: date.getMonth(),
    },
  };
}

function computePerpetualCalendar(date) {
  const day = getDayName(date);
  const month = getMonthName(date);
  const dateNum = date.getDate();
  const year = date.getFullYear();
  const time = formatTime12h(date);

  return {
    title: 'Perpetual Calendar',
    summary: `Set to ${day}, ${month} ${dateNum}, ${year} at ${time}`,
    values: {
      dayOfWeek: day,
      date: dateNum.toString(),
      month,
      year: year.toString(),
      time,
      leapYear: year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 'Yes' : 'No',
    },
    steps: [
      step(
        'Do not adjust between 9 PM and 3 AM',
        'Calendar mechanisms are engaged during this window on most perpetual calendars. Adjust outside these hours to avoid damage.',
      ),
      step(
        'Set the time',
        `Advance hands to ${formatTime24h(date)} (${time}).`,
      ),
      step(
        'Set date, month, and year',
        `Use correctors or crown positions per your manual. Target: ${month} ${dateNum}, ${year}.`,
      ),
      step(
        'Set day of week',
        `Advance until the day indicator reads ${day}.`,
      ),
      step(
        'Set leap-year indicator if present',
        `Some watches show leap year on a subdial. For ${year}, set the leap-year cycle to the correct position (year ${year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 'is' : 'is not'} a leap year).`,
      ),
    ],
    notes: getPerpetualCalendarNotes(date),
    scene: {
      moonPhase: getMoonPhase(date),
      showMoon: false,
      showDayDate: true,
      showMonth: true,
      showYear: true,
      dayIndex: date.getDay(),
      dateNum,
      monthIndex: date.getMonth(),
      year,
    },
  };
}

function computeDayDate(date) {
  const day = getDayName(date);
  const dateNum = date.getDate();
  const time = formatTime12h(date);

  return {
    title: 'Day-Date',
    summary: `Set to ${day}, the ${ordinal(dateNum)} at ${time}`,
    values: {
      dayOfWeek: day,
      date: dateNum.toString(),
      time,
    },
    steps: [
      step(
        'Set the time',
        `Advance hands to ${formatTime24h(date)} (${time}).`,
      ),
      step(
        'Set the date',
        `Use quick-set or advance through midnight cycles until the date window shows ${dateNum}.`,
      ),
      step(
        'Set the day',
        `Advance until the day window reads ${day}. On Rolex-style watches, the day changes shortly after midnight; date changes at midnight.`,
      ),
      step(
        'Verify language (if applicable)',
        'If your watch has multiple day languages, cycle to your preferred language before final alignment.',
      ),
    ],
    notes: [
      note('info', 'Day-date watches typically flip the day at midnight and the date around 12:01 AM.'),
      note('info', 'Avoid quick-setting the date between 10 PM and 2 AM when the mechanism is engaged.'),
    ],
    scene: {
      showMoon: false,
      showDayDate: true,
      showMonth: false,
      showYear: false,
      dayIndex: date.getDay(),
      dateNum,
    },
  };
}

function computeCompleteCalendar(date) {
  const day = getDayName(date);
  const month = getMonthName(date);
  const dateNum = date.getDate();
  const time = formatTime12h(date);
  const phase = getMoonPhase(date);
  const { name: moonName } = getMoonPhaseName(phase);

  return {
    title: 'Complete Calendar',
    summary: `${day}, ${month} ${dateNum} · Moon: ${moonName}`,
    values: {
      dayOfWeek: day,
      date: dateNum.toString(),
      month,
      moonPhase: moonName,
      time,
    },
    steps: [
      step('Set the time', `Advance to ${formatTime24h(date)} (${time}).`),
      step('Set the date', `Date window → ${dateNum}.`),
      step('Set the day of week', `Day indicator → ${day}.`),
      step('Set the month', `Month subdial → ${month}.`),
      step('Set the moon phase', `Align moon disc to ${moonName} (see Moon Phase guide for technique).`),
    ],
    notes: [
      note('info', 'Complete calendars combine date, day, month, and moon phase — set each in the order your manual specifies.'),
      note('warning', 'Like annual calendars, month-length variations may require manual correction at month-end.'),
    ],
    scene: {
      moonPhase: phase,
      showMoon: true,
      showDayDate: true,
      showMonth: true,
      showYear: false,
      dayIndex: date.getDay(),
      dateNum,
      monthIndex: date.getMonth(),
    },
  };
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
