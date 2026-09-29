import {
  getMoonPhase,
  getMoonIllumination,
  getMoonPhaseName,
  getDaysUntilNextPhase,
  LUNAR_CYCLE,
} from './moonPhase.js';
import {
  getDayName,
  getMonthName,
  formatTime12h,
  isLeapYear,
  daysInMonth,
  getAnnualCalendarNotes,
  getPerpetualCalendarNotes,
} from './calendar.js';
import { indicatorsFor, inDanger, formatDanger, CALENDAR_KIND } from '../watch/models.js';

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
  {
    id: 'chronograph',
    name: 'Chronograph',
    icon: '⏱',
    tagline: 'A stopwatch built into the watch',
    about:
      'A stopwatch inside the watch. The top pusher starts and stops it, the bottom pusher resets it. The big centre hand counts seconds, and small dials count the minutes and hours — while another small dial keeps the watch\'s own seconds ticking.',
  },
];

/**
 * What the watch should show for a target moment, plus notes. The steps
 * themselves come from the planner, which knows the specific model.
 *
 * @param {object} model   watch model (see watch/models.js)
 * @param {Date} date      wall-clock time the watch should show
 * @param {Date} [instant] the same moment as an absolute time in the chosen
 *   time zone; the moon depends on it
 * @param {{ southern?: boolean }} [opts]
 */
export function computeAdjustments(model, date, instant = date, { southern = false } = {}) {
  const indicators = indicatorsFor(model);
  const kind = CALENDAR_KIND[model.complication];
  const has = (i) => indicators.includes(i);

  const phase = getMoonPhase(instant);
  const moonAge = phase * LUNAR_CYCLE;
  const { name: moonName, desc: moonDesc } = getMoonPhaseName(phase, southern);
  const illumination = getMoonIllumination(phase);
  const time = formatTime12h(date);
  const day = getDayName(date);
  const month = getMonthName(date);
  const dateNum = date.getDate();
  const year = date.getFullYear();
  const minutes = date.getHours() * 60 + date.getMinutes();

  const values = {};
  if (has('day')) values.dayOfWeek = day;
  if (has('date')) values.date = String(dateNum);
  if (has('month')) values.month = month;
  if (has('year')) values.year = String(year);
  if (has('moon')) {
    values.moon = moonName;
    values.illumination = `${illumination}%`;
    values.lunarAge = `${moonAge.toFixed(1)} days`;
  }
  values.time = time;
  if (has('chrono')) {
    const { subdials } = model.chrono;
    const at = (n) => `${n} o'clock`;
    values.startStop = `Pusher at ${at(model.correctors.start)}`;
    values.reset = `Pusher at ${at(model.correctors.reset)}`;
    values.minuteCounter = at(subdials.minutes);
    values.smallSeconds = at(subdials.seconds);
  }

  const summary = has('chrono')
    ? `Set the time to ${time}, then learn to start, stop and reset the stopwatch`
    : has('date')
    ? `Set it to ${has('day') ? `${day}, ` : ''}${has('month') ? `${month} ` : 'the '}${has('month') ? dateNum : ordinal(dateNum)}${
        has('year') ? `, ${year}` : ''
      } at ${time}${has('moon') ? ` · ${moonName}` : ''}`
    : `Set the moon to ${moonName} (${illumination}% lit) and the time to ${time}`;

  const notes = [];

  if (model.danger && inDanger(model, minutes)) {
    notes.push(
      note(
        'warning',
        `${time} is inside the ${formatDanger(model)} changeover, when the calendar gears are moving. The steps set the calendar first with the hands at 6 o'clock, and move the hands to ${time} last.`,
      ),
    );
  } else if (model.danger) {
    notes.push(
      note(
        'info',
        `Don't use the correctors or quick-set between ${formatDanger(model)}: the calendar is changing over then, and forcing it can break a tooth.`,
      ),
    );
  }

  if (kind === 'simple' || kind === 'simple-month') {
    const prevMonthDays = daysInMonth(year, date.getMonth() - 1);
    if (dateNum === 1 && prevMonthDays < 31) {
      notes.push(
        note(
          'warning',
          `Last month had ${prevMonthDays} days, but the date wheel always counts to 31. If the watch ran through the month, it will show ${prevMonthDays + 1} today — advance it to the 1st.`,
        ),
      );
    }
    notes.push(
      note(
        'info',
        'The date wheel always counts to 31, so after shorter months you move it on by hand — five times a year.',
      ),
    );
  }
  if (kind === 'simple' && has('day')) {
    notes.push(
      note('info', 'Both windows change around midnight. On some watches the day follows a little after the date — that\'s normal.'),
    );
  }
  if (kind === 'annual') notes.push(...getAnnualCalendarNotes(date));
  if (kind === 'perpetual') notes.push(...getPerpetualCalendarNotes(date));

  if (has('chrono')) {
    notes.push(
      note('warning', 'Always stop the chronograph before pressing reset. On an ordinary chronograph, resetting while it runs strains the mechanism — only "flyback" models are built for it.'),
    );
    if (model.look.bezel === 'tachymeter') {
      notes.push(
        note('info', 'The numbers on the bezel are a tachymeter: start the chronograph at one kilometre (or mile) marker and stop it at the next. The bezel number next to the centre hand is your speed per hour.'),
      );
    }
    notes.push(note('info', 'Running the chronograph all the time uses a little more power. Most owners start it only when timing something.'));
  }

  if (has('moon')) {
    notes.push(
      note('info', `Tonight's moon: ${moonDesc}. Next new moon in about ${getDaysUntilNextPhase(phase, 0).toFixed(1)} days, next full moon in about ${getDaysUntilNextPhase(phase, 0.5).toFixed(1)}.`),
    );
    notes.push(note('info', 'Most moon discs drift by about a day every 2½–3 years, so check it against the sky now and then.'));
    if (southern) {
      notes.push(note('info', 'You\'re in the Southern Hemisphere, where the moon looks flipped left-to-right. Most moon-phase watches show the northern view.'));
    }
  }

  if (model.brand) {
    model.notes.forEach((text) => notes.push(note('info', text)));
    notes.push(note('info', `These steps follow the usual instructions for the ${model.brand} ${model.name}. Your watch's manual has the final word.`));
  }

  return {
    title: model.brand ? `${model.brand} ${model.name}` : model.name,
    summary,
    values,
    notes,
    target: { minutes, date: dateNum, day: date.getDay(), month: date.getMonth(), year, moonAge },
    scene: {
      showMoon: has('moon'),
      showDayDate: has('date') || has('day'),
      showMonth: has('month'),
      showYear: has('year'),
      showChrono: has('chrono'),
      moonPhase: phase,
      dayIndex: date.getDay(),
      dateNum,
      monthIndex: date.getMonth(),
      year,
    },
  };
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
