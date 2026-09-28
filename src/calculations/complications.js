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

function step(title, detail, part = null) {
  return { title, detail, part };
}

function note(type, text) {
  return { type, text };
}

/**
 * Plain-English descriptions for people who are new to watches.
 * `icon` is a short glyph shown on the picker card.
 */
export const COMPLICATIONS = [
  {
    id: 'moon-phase',
    name: 'Moon Phase',
    icon: '☾',
    tagline: 'Shows the shape of tonight\'s moon',
    about:
      'A small window, usually near 6 o\'clock, with a painted moon that slowly turns. It shows how much of the moon is lit tonight — from new moon (dark) to full moon (bright) and back, every 29½ days.',
  },
  {
    id: 'day-date',
    name: 'Day-Date',
    icon: '▭',
    tagline: 'Weekday and date in a window',
    about:
      'Shows the day of the week and the date (1–31) in small windows. Made famous by the Rolex Day-Date. It does not know how long each month is, so you nudge it forward after months with fewer than 31 days.',
  },
  {
    id: 'annual-calendar',
    name: 'Annual Calendar',
    icon: '▦',
    tagline: 'Knows 30- and 31-day months',
    about:
      'Shows day, date and month, and knows which months have 30 or 31 days. It only needs one correction a year — on March 1st, because it can\'t tell February is short.',
  },
  {
    id: 'perpetual-calendar',
    name: 'Perpetual Calendar',
    icon: '∞',
    tagline: 'Handles leap years on its own',
    about:
      'The most complete calendar: day, date, month and year, including leap years. Once set correctly it stays right for decades — as long as it keeps running.',
  },
  {
    id: 'complete-calendar',
    name: 'Complete Calendar',
    icon: '◐',
    tagline: 'Day, date, month + moon',
    about:
      'Also called a "triple calendar": day, date and month plus a moon phase. Like a day-date, it needs a manual nudge at the end of short months.',
  },
];

/**
 * @param {string} type complication id
 * @param {Date} date wall-clock time the watch should show
 * @param {Date} [instant] the same moment as an absolute time (in the chosen timezone);
 *   used for astronomy, where the timezone matters.
 */
export function computeAdjustments(type, date, instant = date) {
  switch (type) {
    case 'moon-phase':
      return computeMoonPhase(date, instant);
    case 'annual-calendar':
      return computeAnnualCalendar(date, instant);
    case 'perpetual-calendar':
      return computePerpetualCalendar(date, instant);
    case 'day-date':
      return computeDayDate(date);
    case 'complete-calendar':
      return computeCompleteCalendar(date, instant);
    default:
      return computeMoonPhase(date, instant);
  }
}

function computeMoonPhase(date, instant) {
  const phase = getMoonPhase(instant);
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
      lunarAge: `${(phase * 29.53).toFixed(1)} days`,
    },
    steps: [
      step(
        'Pull crown to time-setting position',
        'Many moon phase watches move the moon disc with the crown pulled out one or two clicks. Others use a small corrector — a recessed button on the case side you press with a stylus. Check your manual.',
        'crown',
      ),
      step(
        'Advance time forward',
        'Turn the crown so the hands move forward. Each two full turns of the hour hand (24 hours) moves the moon disc about one day. If your watch has a corrector, each press moves it one day instead.',
        'hands',
      ),
      step(
        `Align to ${name}`,
        `Stop when the aperture shows ${desc}. About ${illumination}% of the moon should be lit — compare with the watch on the left.`,
        'moon',
      ),
      step(
        'Verify against reference',
        'Compare with tonight\'s sky or a moon calendar. Fine-tune in small steps — only ever move the moon forward unless your manual says reversing is safe.',
        'moon',
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

function computeAnnualCalendar(date, instant) {
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
        `Pull the crown out to the time-setting position and move the hands to ${formatTime24h(date)} (${time}).`,
        'hands',
      ),
      step(
        'Set the date',
        `Use the quick-set (crown one click out) or a corrector. Advance until the date window reads ${dateNum}.`,
        'date',
      ),
      step(
        'Set the month',
        `Move the month subdial or window to ${month}. This often uses its own corrector on the case.`,
        'month',
      ),
      step(
        'Set the day of week',
        `Advance the day-of-week indicator until it displays ${day}.`,
        'day',
      ),
      step(
        'Check everything',
        `Confirm: ${day} · ${month} ${dateNum}, ${year} · ${time}. Push the crown back in.`,
        'crown',
      ),
    ],
    notes: getAnnualCalendarNotes(date),
    scene: {
      moonPhase: getMoonPhase(instant),
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

function computePerpetualCalendar(date, instant) {
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
        'Around midnight the calendar gears are busy changing the date. Using a corrector then can damage the movement, so set the hands to midday first.',
        'hands',
      ),
      step(
        'Set the time',
        `Advance hands to ${formatTime24h(date)} (${time}).`,
        'hands',
      ),
      step(
        'Set date, month, and year',
        `Use the correctors per your manual. Target: ${month} ${dateNum}, ${year}.`,
        'date',
      ),
      step(
        'Set day of week',
        `Advance until the day indicator reads ${day}.`,
        'day',
      ),
      step(
        'Set leap-year indicator if present',
        `Some watches show leap year on a subdial. For ${year}, set the leap-year cycle to the correct position (year ${year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 'is' : 'is not'} a leap year).`,
        'year',
      ),
    ],
    notes: getPerpetualCalendarNotes(date),
    scene: {
      moonPhase: getMoonPhase(instant),
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
        `Pull the crown all the way out and move the hands to ${formatTime24h(date)} (${time}).`,
        'hands',
      ),
      step(
        'Set the date',
        `Push the crown in one click (quick-set) and turn it until the date window shows ${dateNum}.`,
        'date',
      ),
      step(
        'Set the day',
        `Turn the crown the other way until the day window reads ${day}. On Rolex-style watches, the date changes at midnight and the day shortly after.`,
        'day',
      ),
      step(
        'Check the language',
        'Some watches cycle through two languages for the day. Keep going until you see your preferred one.',
        'day',
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

function computeCompleteCalendar(date, instant) {
  const day = getDayName(date);
  const month = getMonthName(date);
  const dateNum = date.getDate();
  const time = formatTime12h(date);
  const phase = getMoonPhase(instant);
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
      step('Set the time', `Advance the hands to ${formatTime24h(date)} (${time}).`, 'hands'),
      step('Set the date', `Turn the date window to ${dateNum}.`, 'date'),
      step('Set the day of week', `Set the day indicator to ${day}.`, 'day'),
      step('Set the month', `Set the month subdial to ${month}.`, 'month'),
      step('Set the moon phase', `Move the moon disc to ${moonName} (see the Moon Phase guide for technique).`, 'moon'),
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
