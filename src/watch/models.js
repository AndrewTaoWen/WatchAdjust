/*
 * Watch models: how each one is set (crown positions, correctors, the hours
 * to avoid) and how it looks. Every complication has a "Typical" model; brand
 * models follow the published setting instructions for that family, kept to
 * what is consistent across references — owners should still check their
 * manual, and the UI says so.
 *
 * Crown position `does`:
 *   wind      – turning winds the mainspring
 *   quickset  – turning changes a calendar indicator ({ forward, backward })
 *   calendar  – each forward click advances the whole calendar one day
 *   time      – turning moves the hands (and the calendar at midnight)
 *
 * Correctors are recessed buttons on the case; `at` is the clock position.
 * Chronographs use the same map for their pushers (`start`, `reset`) and add
 * a `chrono` block describing the sub-dials.
 */

/** Which displays each complication has. */
export const INDICATORS = {
  'moon-phase': ['time', 'moon'],
  'day-date': ['time', 'date', 'day'],
  'annual-calendar': ['time', 'date', 'day', 'month'],
  'perpetual-calendar': ['time', 'date', 'day', 'month', 'year'],
  'complete-calendar': ['time', 'date', 'day', 'month', 'moon'],
  chronograph: ['time', 'chrono'],
};

/** How the date moves at midnight. */
export const CALENDAR_KIND = {
  'moon-phase': 'none',
  'day-date': 'simple', // 31-day disc, month unknown
  'annual-calendar': 'annual', // knows 30/31, not February
  'perpetual-calendar': 'perpetual', // knows everything
  'complete-calendar': 'simple-month', // 31-day disc; month steps on at the 31st→1st
  chronograph: 'none',
};

const CONSERVATIVE_DANGER = [21, 3];

const WIND = { label: 'Pushed in', short: 'In', does: 'wind' };

export const MODELS = [
  // ---------- Typical watches ----------
  {
    id: 'typical-moon-phase',
    complication: 'moon-phase',
    brand: null,
    name: 'Typical moon phase watch',
    positions: [WIND, { label: '1st click', short: '1st', does: 'time' }],
    correctors: { moon: 10 },
    danger: CONSERVATIVE_DANGER,
    look: { metal: 'steel', dial: 'cream', bezel: 'smooth', hands: 'blued', strap: 'leather' },
    notes: [],
  },
  {
    id: 'typical-day-date',
    complication: 'day-date',
    brand: null,
    name: 'Typical day-date watch',
    positions: [
      WIND,
      { label: '1st click', short: '1st', does: 'quickset', forward: 'date', backward: 'day' },
      { label: '2nd click', short: '2nd', does: 'time' },
    ],
    correctors: {},
    danger: CONSERVATIVE_DANGER,
    look: { metal: 'steel', dial: 'cream', bezel: 'smooth', hands: 'blued', strap: 'leather' },
    notes: [],
  },
  {
    id: 'typical-annual-calendar',
    complication: 'annual-calendar',
    brand: null,
    name: 'Typical annual calendar',
    positions: [
      WIND,
      { label: '1st click', short: '1st', does: 'quickset', forward: 'date' },
      { label: '2nd click', short: '2nd', does: 'time' },
    ],
    correctors: { day: 10, month: 2 },
    danger: CONSERVATIVE_DANGER,
    look: { metal: 'steel', dial: 'silver', bezel: 'smooth', hands: 'blued', strap: 'leather' },
    notes: [],
  },
  {
    id: 'typical-perpetual-calendar',
    complication: 'perpetual-calendar',
    brand: null,
    name: 'Typical perpetual calendar',
    positions: [WIND, { label: '1st click', short: '1st', does: 'time' }],
    correctors: { date: 8, day: 10, month: 2 },
    danger: CONSERVATIVE_DANGER,
    look: { metal: 'steel', dial: 'white', bezel: 'smooth', hands: 'blued', strap: 'leather' },
    notes: [],
  },
  {
    id: 'typical-complete-calendar',
    complication: 'complete-calendar',
    brand: null,
    name: 'Typical complete calendar',
    positions: [
      WIND,
      { label: '1st click', short: '1st', does: 'quickset', forward: 'date' },
      { label: '2nd click', short: '2nd', does: 'time' },
    ],
    correctors: { day: 10, month: 2, moon: 4 },
    danger: CONSERVATIVE_DANGER,
    look: { metal: 'steel', dial: 'cream', bezel: 'smooth', hands: 'blued', strap: 'leather' },
    notes: [],
  },

  {
    id: 'typical-chronograph',
    complication: 'chronograph',
    brand: null,
    name: 'Typical chronograph',
    positions: [WIND, { label: '1st click', short: '1st', does: 'time' }],
    correctors: { start: 2, reset: 4 },
    danger: null,
    chrono: { subdials: { seconds: 9, minutes: 3, hours: 6 } },
    look: { metal: 'steel', dial: 'silver', bezel: 'smooth', hands: 'blued', strap: 'leather', subdials: 'match', caption: 'Chronograph' },
    notes: [],
  },

  // ---------- Brand models ----------
  {
    id: 'rolex-day-date-40',
    complication: 'day-date',
    brand: 'Rolex',
    name: 'Day-Date 40',
    blurb: 'The "President": gold case, fluted bezel, day spelled out at 12 and date at 3.',
    screwDown: true,
    positions: [
      { label: 'Screwed down / wind', short: 'In', does: 'wind' },
      { label: '1st click', short: '1st', does: 'quickset', forward: 'date', backward: 'day' },
      { label: '2nd click', short: '2nd', does: 'time' },
    ],
    correctors: {},
    danger: CONSERVATIVE_DANGER,
    look: {
      metal: 'yellowGold',
      dial: 'champagne',
      bezel: 'fluted',
      hands: 'gold',
      strap: 'steel',
      layout: { date: [0.8, 0] },
    },
    notes: [
      'The crown screws down to keep water out. Unscrew it first (turn it anticlockwise until it springs out) and always screw it back down firmly when you are done.',
      'In the setting position, one direction changes the day and the other the date — watch which window moves.',
      'The day disc usually carries two languages, so each day comes round twice.',
    ],
  },
  {
    id: 'seiko-presage-day-date',
    complication: 'day-date',
    brand: 'Seiko',
    name: 'Presage day-date (4R36)',
    blurb: 'An affordable automatic with day and date, set entirely from the crown.',
    positions: [
      WIND,
      { label: '1st click', short: '1st', does: 'quickset', forward: 'date', backward: 'day' },
      { label: '2nd click', short: '2nd', does: 'time' },
    ],
    correctors: {},
    danger: [21, 1],
    look: { metal: 'steel', dial: 'blue', bezel: 'smooth', hands: 'steel', strap: 'leather' },
    notes: [
      'Seiko advises not to change the day or date between 9 pm and 1 am, while the calendar is changing over.',
      'At the 1st click, turning one way changes the date and the other way the day.',
      'The 2nd click stops the seconds hand, so you can set the time to the second.',
    ],
  },
  {
    id: 'patek-annual-calendar',
    complication: 'annual-calendar',
    brand: 'Patek Philippe',
    name: 'Annual Calendar',
    blurb: 'The watch that introduced the annual calendar, here with a moon phase.',
    indicators: ['time', 'date', 'day', 'month', 'moon'],
    positions: [WIND, { label: '1st click', short: '1st', does: 'time' }],
    correctors: { date: 8, day: 10, month: 2, moon: 4 },
    danger: CONSERVATIVE_DANGER,
    look: { metal: 'whiteGold', dial: 'silver', bezel: 'smooth', hands: 'steel', strap: 'leather' },
    notes: [
      'The day, date, month and moon each have their own recessed corrector. Press them gently with the stylus supplied with the watch — never a pen or pin.',
      'The manual lists the hours when the correctors must not be used; we show a conservative 9 pm to 3 am.',
    ],
  },
  {
    id: 'iwc-portugieser-perpetual',
    complication: 'perpetual-calendar',
    brand: 'IWC',
    name: 'Portugieser Perpetual Calendar',
    blurb: 'Every calendar display is linked, and it shows the year in four digits.',
    indicators: ['time', 'date', 'day', 'month', 'year', 'moon'],
    forwardOnly: true,
    positions: [
      WIND,
      { label: '1st click', short: '1st', does: 'calendar' },
      { label: '2nd click', short: '2nd', does: 'time' },
    ],
    correctors: {},
    danger: CONSERVATIVE_DANGER,
    look: { metal: 'roseGold', dial: 'white', bezel: 'smooth', hands: 'gold', strap: 'leather' },
    notes: [
      'All the displays are linked: moving the date on also moves the day, month, year and moon. You can\'t set them separately.',
      'Never turn the calendar backwards. If the watch is ahead, let it rest until the real date catches up.',
      'Check your manual for exactly which crown position advances the calendar.',
    ],
  },
  {
    id: 'longines-master-moonphase',
    complication: 'complete-calendar',
    brand: 'Longines',
    name: 'Master Collection Moonphase',
    blurb: 'A classic complete calendar: day, date, month and moon.',
    positions: [
      WIND,
      { label: '1st click', short: '1st', does: 'quickset', forward: 'date' },
      { label: '2nd click', short: '2nd', does: 'time' },
    ],
    correctors: { day: 10, month: 2, moon: 4 },
    danger: CONSERVATIVE_DANGER,
    look: { metal: 'steel', dial: 'silver', bezel: 'smooth', hands: 'blued', strap: 'steel' },
    notes: [
      'The date is set with the crown; the day, month and moon with small correctors on the case side.',
      'Use the correctors gently, with a plastic or wooden stylus.',
    ],
  },
  {
    id: 'frederique-constant-moonphase',
    complication: 'moon-phase',
    brand: 'Frederique Constant',
    name: 'Classics Moonphase',
    blurb: 'A slim dress watch with a moon phase at 6 o\'clock.',
    positions: [WIND, { label: '1st click', short: '1st', does: 'time' }],
    correctors: { moon: 10 },
    danger: CONSERVATIVE_DANGER,
    look: { metal: 'roseGold', dial: 'silver', bezel: 'smooth', hands: 'gold', strap: 'leather' },
    notes: [
      'The moon is set with a small corrector on the case side: each press moves it on one day.',
    ],
  },

  {
    id: 'omega-speedmaster-professional',
    complication: 'chronograph',
    brand: 'Omega',
    name: 'Speedmaster Professional',
    blurb: 'The "Moonwatch": hand-wound, black dial, tachymeter bezel.',
    manualWind: true,
    positions: [WIND, { label: '1st click', short: '1st', does: 'time' }],
    correctors: { start: 2, reset: 4 },
    danger: null,
    chrono: { subdials: { seconds: 9, minutes: 3, hours: 6 } },
    look: { metal: 'steel', dial: 'black', bezel: 'tachymeter', hands: 'steel', strap: 'steel', subdials: 'match', caption: 'Professional' },
    notes: [
      'This is a hand-wound watch: it has no rotor, so wind it every day, ideally at the same time. Stop when you feel resistance — never force it.',
      'There is no date, so setting it is just the time: pull the crown out one click and turn.',
    ],
  },
  {
    id: 'rolex-daytona',
    complication: 'chronograph',
    brand: 'Rolex',
    name: 'Cosmograph Daytona',
    blurb: 'A racing chronograph with screw-down pushers and a tachymeter bezel.',
    screwDown: true,
    positions: [
      { label: 'Screwed down / wind', short: 'In', does: 'wind' },
      { label: '1st click', short: '1st', does: 'time' },
    ],
    correctors: { start: 2, reset: 4 },
    danger: null,
    chrono: { subdials: { seconds: 6, minutes: 3, hours: 9 }, screwDownPushers: true },
    look: { metal: 'steel', dial: 'white', bezel: 'tachymeter', hands: 'steel', strap: 'steel', subdials: 'black', caption: 'Cosmograph' },
    notes: [
      'Both the crown and the pushers screw down to keep water out. Unscrew the pushers before timing anything, and screw them back down afterwards — never press them underwater.',
      'The small seconds hand at 6 o\'clock shows the watch is running; the big centre hand is only for the chronograph.',
    ],
  },
];

export function modelsFor(complication) {
  return MODELS.filter((m) => m.complication === complication);
}

export function getModel(id) {
  return MODELS.find((m) => m.id === id) ?? MODELS[0];
}

export function indicatorsFor(model) {
  return model.indicators ?? INDICATORS[model.complication];
}

export function modelLabel(model) {
  return model.brand ? `${model.brand} ${model.name}` : model.name;
}

/** Is this time (minutes past midnight, 24h) in the model's no-adjust window? */
export function inDanger(model, minutes) {
  if (!model.danger) return false;
  const [from, to] = model.danger;
  const h = minutes / 60;
  return from > to ? h >= from || h < to : h >= from && h < to;
}

export function formatDanger(model) {
  if (!model.danger) return '';
  const fmt = (h) => `${h % 12 || 12} ${h < 12 ? 'am' : 'pm'}`;
  return `${fmt(model.danger[0])} and ${fmt(model.danger[1])}`;
}

/** Which crown position (index) does this job, if any. */
export function positionFor(model, does, indicator) {
  return model.positions.findIndex(
    (p) => p.does === does && (!indicator || p.forward === indicator || p.backward === indicator),
  );
}
