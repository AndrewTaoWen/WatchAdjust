import { CALENDAR_KIND, indicatorsFor, inDanger, formatDanger, positionFor } from '../watch/models.js';
import { LUNAR_CYCLE, getMoonPhaseName } from './moonPhase.js';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const CLOCK = ['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
const SAFE_PARK = 6 * 60; // 6:00 am — well clear of the midnight changeover
const WIND_TURNS = 20;
const mod = (n, m) => ((n % m) + m) % m;

export function formatMinutes(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

const times = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Calendar values a watch should show for a wall-clock date. */
export function calendarValues(date, moonAge) {
  return {
    minutes: date.getHours() * 60 + date.getMinutes(),
    date: date.getDate(),
    day: date.getDay(),
    month: date.getMonth(),
    year: date.getFullYear(),
    moonAge,
  };
}

function describe(indicator, v, southern) {
  switch (indicator) {
    case 'date':
      return String(v.date);
    case 'day':
      return DAYS[v.day];
    case 'month':
      return MONTHS[v.month];
    case 'year':
      return String(v.year);
    case 'moon':
      return getMoonPhaseName(v.moonAge / LUNAR_CYCLE, southern).name;
    default:
      return '';
  }
}

/** How to move one indicator on this model. */
function actuatorFor(model, indicator) {
  if (indicator in model.correctors) {
    return { kind: 'corrector', at: model.correctors[indicator] };
  }
  const fwd = model.positions.findIndex((p) => p.does === 'quickset' && p.forward === indicator);
  if (fwd !== -1) return { kind: 'crown', position: fwd, dir: 1 };
  const back = model.positions.findIndex((p) => p.does === 'quickset' && p.backward === indicator);
  if (back !== -1) return { kind: 'crown', position: back, dir: -1 };
  return null;
}

function crownLabel(model, index) {
  return index === 0 ? 'pushed in' : `at the ${model.positions[index].label}`;
}

/**
 * Build the steps to take a watch from `state` (or unknown, when null) to the
 * target. Each step carries a `done` flag when the state is known, and
 * `actions` that perform it on the simulated watch.
 *
 * @param {object} opts
 * @param {object} opts.model
 * @param {object} opts.target    calendarValues() for the target moment
 * @param {object} opts.previous  calendarValues() for the day before
 * @param {object|null} opts.state
 * @param {boolean} [opts.southern]
 */
export function planSteps({ model, target, previous, state = null, southern = false }) {
  const kind = CALENDAR_KIND[model.complication];
  const indicators = indicatorsFor(model);
  const known = Boolean(state);
  const timePos = positionFor(model, 'time');
  const T = target.minutes;
  const steps = [];

  // From the current hands (or from the 6:00 parking spot) the hands move
  // forward to the target time. If that passes midnight the calendar must be
  // set to the day before, so the midnight changeover lands it on the target.
  const from = known ? state.minutes : SAFE_PARK;
  // Without a date there's no AM/PM, so the hands only ever travel up to 12 hours.
  const forward = mod(T - from, kind === 'none' ? 720 : 1440);
  const crossesMidnight = kind !== 'none' && from > T;
  const goal = crossesMidnight ? previous : target;
  const moonGoal = mod(target.moonAge - forward / 1440, LUNAR_CYCLE);

  // ----- Screw-down crowns -----
  if (model.screwDown) {
    steps.push({
      id: 'unscrew',
      title: 'Unscrew the crown',
      detail: 'Turn the crown anticlockwise until it springs out. It is screwed down to keep water out, and you can\'t pull it until it is free.',
      part: 'crown',
      done: known ? !state.screwed || state.crown > 0 : undefined,
      actions: [{ label: 'Unscrew', action: { type: 'unscrew' } }],
    });
  }

  // ----- Wind (optional) -----
  steps.push({
    id: 'wind',
    optional: true,
    title: 'If it has stopped, wind it',
    detail: `With the crown pushed in, give it about ${WIND_TURNS} turns forward. That gets the movement running before you set it.`,
    part: 'crown',
    done: known ? state.windTurns >= WIND_TURNS : undefined,
    actions: [
      {
        label: `Wind ${WIND_TURNS} turns`,
        action: [
          { type: 'setCrown', position: 0 },
          { type: 'turn', dir: 1, clicks: WIND_TURNS },
        ],
      },
    ],
  });

  // ----- Find midnight, park at 6 -----
  if (kind !== 'none') {
    const safe = known && state.amPmKnown && !inDanger(model, state.minutes);
    // Unknown AM/PM: go forward through the next midnight, then on to 6:00.
    const toPark = known
      ? state.amPmKnown
        ? mod(SAFE_PARK - state.minutes, 1440)
        : 1440 - state.minutes + SAFE_PARK
      : 0;
    steps.push({
      id: 'park',
      title: 'Find midnight, then park the hands at 6',
      detail:
        `Pull the crown to the ${model.positions[timePos].label} and turn the hands forward until the date changes — that's midnight, so now you know AM from PM. Keep going to about 6 o'clock, clear of the ${formatDanger(model)} changeover, before touching the calendar.`,
      part: 'hands',
      done: known ? safe : undefined,
      actions: [
        {
          label: 'Do it',
          action: [
            { type: 'setCrown', position: timePos },
            { type: 'turn', minutes: toPark },
          ],
        },
      ],
    });
  } else if (model.danger) {
    steps.push({
      id: 'park',
      title: 'Move the hands clear of midnight',
      detail: `Pull the crown to the ${model.positions[timePos].label} and set the hands to about 6 o'clock, outside ${formatDanger(model)}, before using the moon corrector.`,
      part: 'hands',
      done: known ? !inDanger(model, state.minutes) : undefined,
      actions: [
        {
          label: 'Move to 6:00',
          action: [
            { type: 'setCrown', position: timePos },
            { type: 'turn', minutes: known ? mod(SAFE_PARK - state.minutes, 1440) : 0 },
          ],
        },
      ],
    });
  }

  if (crossesMidnight) {
    steps.push({
      id: 'why-previous',
      info: true,
      title: 'Set the calendar to the day before',
      detail: `On the way to ${formatMinutes(T)} the hands will pass midnight, which moves the calendar on one day. So set it to ${DAYS[goal.day]} the ${goal.date}${indicators.includes('month') ? ` ${MONTHS[goal.month]}` : ''} now.`,
      part: null,
    });
  }

  // ----- Calendar -----
  const calendarPos = positionFor(model, 'calendar');
  if (calendarPos !== -1) {
    // Linked calendar (IWC style): everything moves together, forwards only.
    const days = known
      ? Math.round(
          (Date.UTC(goal.year, goal.month, goal.date) - Date.UTC(state.year, state.month, state.date)) /
            86400000,
        )
      : null;
    const ahead = days != null && days < 0;
    steps.push({
      id: 'calendar',
      title: ahead ? 'The watch is ahead — let it rest' : 'Advance the calendar',
      detail: ahead
        ? `It shows a date ${times(-days, 'day', 'days')} ahead. This calendar can't go backwards: leave it stopped and restart it on the right day, or ask a watchmaker.`
        : `With the crown ${crownLabel(model, calendarPos)}, turn it forward one click per day until it shows ${describe('date', goal)} ${describe('month', goal)} ${goal.year}. The day, month, year and moon follow along.${
            days ? ` That's ${times(days, 'click', 'clicks')}.` : ''
          }`,
      part: 'crown',
      done: known ? days === 0 : undefined,
      actions:
        known && days > 0
          ? [
              {
                label: `Advance ${times(days, 'day', 'days')}`,
                action: [
                  { type: 'setCrown', position: calendarPos },
                  { type: 'turn', dir: 1, clicks: days },
                ],
              },
            ]
          : [],
    });
  } else {
    ['month', 'date', 'day', 'moon'].forEach((indicator) => {
      if (!indicators.includes(indicator)) return;
      const act = actuatorFor(model, indicator);
      if (!act) return;

      let count = null;
      let aheadBy = 0;
      let done;
      if (known) {
        if (indicator === 'month') {
          if (kind === 'perpetual') {
            count = (goal.year - state.year) * 12 + goal.month - state.month;
            if (count < 0) {
              aheadBy = -count;
              count = 0;
            }
          } else {
            count = mod(goal.month - state.month, 12);
          }
        } else if (indicator === 'date') {
          count = mod(goal.date - state.date, 31);
        } else if (indicator === 'day') {
          count = mod(goal.day - state.day, 7);
        } else if (indicator === 'moon') {
          const diff = mod(moonGoal - state.moonAge, LUNAR_CYCLE);
          count = diff > LUNAR_CYCLE - 0.5 ? 0 : Math.round(diff);
        }
        done = count === 0 && !aheadBy;
      }

      const value = indicator === 'moon' ? describe('moon', { moonAge: moonGoal }, southern) : describe(indicator, goal);
      const perpetualYear = indicator === 'month' && kind === 'perpetual';
      const what = perpetualYear ? `${value} ${goal.year}` : value;

      let detail;
      let part;
      let actions = [];
      if (act.kind === 'corrector') {
        part = `corrector-${indicator}`;
        detail = `Press the ${indicator} corrector — the small recessed button at ${CLOCK[act.at]} o'clock on the case side — until it shows ${what}.${
          count ? ` That's ${times(count, 'press', 'presses')}.` : ''
        }`;
        if (perpetualYear) detail += ' Each press moves one month; the year and leap cycle follow.';
        if (known && count) {
          actions = [
            { label: 'Press once', action: { type: 'press', corrector: indicator } },
            { label: `Press ×${count}`, action: { type: 'press', corrector: indicator, clicks: count } },
          ];
        }
      } else {
        part = 'crown';
        const way = act.dir > 0 ? 'forward' : 'the other way';
        detail = `With the crown ${crownLabel(model, act.position)}, turn it ${way} until the ${indicator} shows ${what}.${
          count ? ` That's ${times(count, 'click', 'clicks')}.` : ''
        }`;
        if (known && count) {
          actions = [
            {
              label: `Turn ×${count}`,
              action: [
                { type: 'setCrown', position: act.position },
                { type: 'turn', dir: act.dir, clicks: count },
              ],
            },
          ];
        }
      }
      if (aheadBy) {
        detail = `The watch is ${times(aheadBy, 'month', 'months')} ahead. A perpetual calendar can't go backwards: let it rest until the real date catches up, or ask a watchmaker.`;
      }

      steps.push({
        id: indicator,
        title: `Set the ${indicator} to ${what}`,
        detail,
        part,
        done,
        actions,
      });
    });
  }

  // ----- Time -----
  const timeDiff = known ? mod(T - state.minutes, kind === 'none' ? 720 : 1440) : null;
  const timeDone = known && (timeDiff <= 2 || timeDiff >= (kind === 'none' ? 718 : 1438));
  const calendarDone = steps.filter((s) => !s.optional && !s.info && s.id !== 'unscrew' && s.id !== 'park').every((s) => s.done);
  steps.push({
    id: 'time',
    title: `Set the time to ${formatMinutes(T)}`,
    detail: `Pull the crown to the ${model.positions[timePos].label} and turn the hands forward to ${formatMinutes(T)}${
      crossesMidnight ? ', through midnight — the calendar steps on to today as you pass it' : ''
    }. Always finish by moving forward: it takes up the slack in the gears.`,
    part: 'hands',
    done: known ? timeDone && calendarDone : undefined,
    actions: known && !timeDone
      ? [
          {
            label: `Turn to ${formatMinutes(T)}`,
            action: [
              { type: 'setCrown', position: timePos },
              { type: 'turn', minutes: timeDiff },
            ],
          },
        ]
      : [],
  });

  // ----- Finish -----
  // Only counts at the end — at the start the crown is "in" but nothing is set yet.
  const home = known && state.crown === 0 && (!model.screwDown || state.screwed) && timeDone && calendarDone;
  steps.push({
    id: 'finish',
    title: model.screwDown ? 'Push the crown in and screw it down' : 'Push the crown back in',
    detail: model.screwDown
      ? 'Push the crown all the way in, then turn it clockwise while pressing gently until it is snug. Don\'t force it.'
      : 'Push the crown all the way in so the watch runs and stays sealed.',
    part: 'crown',
    done: known ? home : undefined,
    actions: known && !home
      ? [
          {
            label: model.screwDown ? 'Push in & screw down' : 'Push in',
            action: [{ type: 'setCrown', position: 0 }, ...(model.screwDown ? [{ type: 'screw' }] : [])],
          },
        ]
      : [],
  });

  // Once the time is set, the preparation steps count as done even though the
  // crown is back in and the hands may now sit in the changeover window.
  const timeStep = steps.find((s) => s.id === 'time');
  if (timeStep.done) {
    steps.filter((s) => s.id === 'park' || s.id === 'unscrew').forEach((s) => {
      s.done = true;
    });
  }
  const required = steps.filter((s) => !s.optional && !s.info);
  const allSet = known && required.every((s) => s.done);

  return { steps, allSet };
}
