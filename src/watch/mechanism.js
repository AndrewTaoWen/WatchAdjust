import { CALENDAR_KIND, inDanger, formatDanger } from './models.js';
import { LUNAR_CYCLE } from '../calculations/moonPhase.js';
import { daysInMonth } from '../calculations/calendar.js';

/*
 * A small simulation of a watch you can set: crown positions, correctors and
 * the calendar changing at midnight. Pure functions — every action returns a
 * new state plus messages to show the user.
 *
 * State:
 *   minutes    0–1439, what the hands show on a 24-hour day
 *   date       1–31, day 0–6 (Sun–Sat), month 0–11, year
 *   moonAge    days since new moon on the moon disc (0–29.53)
 *   crown      index into model.positions
 *   screwed    screw-down crown is screwed in
 *   amPmKnown  the hands have been taken through midnight, so AM/PM is right
 *   windTurns  crown turns in the winding position
 *
 * Chronograph:
 *   chronoRunning, chronoElapsed (seconds banked while stopped), chronoSince
 *   (timestamp it last started), pushersLocked (screw-down pushers), and
 *   chronoStarted / chronoStopped / chronoReset to track the lesson.
 */

export const TIME_STEP = 10; // minutes per crown click when setting the time
const MINUTES_PER_DAY = 1440;
const ANNUAL_MONTH_DAYS = [31, 30, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // February as 30

export function createState(model, values) {
  return {
    minutes: 0,
    date: 1,
    day: 1,
    month: 0,
    year: 2026,
    moonAge: 0,
    crown: 0,
    screwed: Boolean(model.screwDown),
    amPmKnown: false,
    windTurns: 0,
    chronoRunning: false,
    chronoElapsed: 0,
    chronoSince: 0,
    chronoStarted: false,
    chronoStopped: false,
    chronoReset: false,
    pushersLocked: Boolean(model.chrono?.screwDownPushers),
    ...values,
  };
}

/** Seconds on the chronograph at time `now` (ms, same clock as action.now). */
export function chronoElapsedAt(state, now) {
  return state.chronoElapsed + (state.chronoRunning ? Math.max(0, now - state.chronoSince) / 1000 : 0);
}

function pressChrono(s, model, name, now, messages) {
  if (s.pushersLocked) {
    messages.push({ type: 'warning', text: 'The pushers are screwed down. Unscrew them first.' });
    return;
  }
  if (name === 'start') {
    if (s.chronoRunning) {
      s.chronoElapsed = chronoElapsedAt(s, now);
      s.chronoRunning = false;
      if (s.chronoStarted) s.chronoStopped = true;
    } else {
      s.chronoRunning = true;
      s.chronoSince = now;
      s.chronoStarted = true;
    }
    return;
  }
  // reset
  if (s.chronoRunning && !model.chrono?.flyback) {
    messages.push({
      type: 'danger',
      text: 'Stop it first. Pressing reset while the chronograph runs can damage an ordinary chronograph — only "flyback" models allow it.',
    });
    return;
  }
  s.chronoElapsed = 0;
  s.chronoRunning = false;
  if (s.chronoStopped) s.chronoReset = true;
}

const mod = (n, m) => ((n % m) + m) % m;

// ---------- Calendar movements ----------

function monthLength(state, kind) {
  if (kind === 'perpetual') return daysInMonth(state.year, state.month);
  if (kind === 'annual') return ANNUAL_MONTH_DAYS[state.month];
  return 31;
}

function nextMonth(s, kind) {
  s.month = (s.month + 1) % 12;
  if (s.month === 0 && kind === 'perpetual') s.year += 1;
}

/** What happens at midnight: the whole calendar moves on one day. */
function advanceDay(s, kind) {
  if (kind === 'none') return;
  s.day = (s.day + 1) % 7;
  if (s.date >= monthLength(s, kind)) {
    s.date = 1;
    if (kind !== 'simple') nextMonth(s, kind);
  } else {
    s.date += 1;
  }
}

/** A corrector or quick-set click moves just one indicator. */
function stepIndicator(s, indicator, kind) {
  switch (indicator) {
    case 'date':
      s.date = (s.date % 31) + 1;
      break;
    case 'day':
      s.day = (s.day + 1) % 7;
      break;
    case 'month':
      nextMonth(s, kind === 'perpetual' ? 'perpetual' : 'annual');
      break;
    case 'moon':
      s.moonAge = mod(s.moonAge + 1, LUNAR_CYCLE);
      break;
    default:
      break;
  }
}

function moveHands(s, delta, kind, messages) {
  const total = s.minutes + delta;
  if (delta > 0) {
    const midnights = Math.floor(total / MINUTES_PER_DAY);
    for (let i = 0; i < midnights; i++) advanceDay(s, kind);
    if (midnights > 0) s.amPmKnown = true;
  } else if (total < 0 && kind !== 'none') {
    messages.push({
      type: 'info',
      text: 'Turning the hands backwards past midnight doesn\'t move the date back on most watches.',
    });
  }
  s.minutes = mod(total, MINUTES_PER_DAY);
  s.moonAge = mod(s.moonAge + delta / MINUTES_PER_DAY, LUNAR_CYCLE);
}

// ---------- Actions ----------

const INDICATOR_NAMES = { date: 'date', day: 'day', month: 'month', moon: 'moon', year: 'year' };

function dangerMessage(model) {
  return {
    type: 'danger',
    text: `Stop — the calendar is changing over between ${formatDanger(model)}. On a real watch this can break a tooth. Move the hands to about 6 o'clock first.`,
  };
}

/**
 * @param {object} state
 * @param {object} model
 * @param {{type: string, dir?: number, clicks?: number, minutes?: number, corrector?: string, position?: number}} action
 * @returns {{ state: object, messages: {type: string, text: string}[] }}
 */
export function applyAction(state, model, action) {
  const s = { ...state };
  const messages = [];
  const kind = CALENDAR_KIND[model.complication];
  const position = model.positions[s.crown];

  switch (action.type) {
    case 'unscrew':
      if (s.screwed) {
        s.screwed = false;
        messages.push({ type: 'info', text: 'Unscrewed — the crown springs out slightly. Now you can pull it.' });
      }
      break;

    case 'screw':
      if (model.screwDown && s.crown === 0 && !s.screwed) {
        s.screwed = true;
        messages.push({ type: 'success', text: 'Screwed down — the watch is water-resistant again.' });
      }
      break;

    case 'pull':
      if (s.screwed) {
        messages.push({ type: 'warning', text: 'The crown is screwed down. Unscrew it first (turn it anticlockwise).' });
      } else if (s.crown < model.positions.length - 1) {
        s.crown += 1;
      }
      break;

    case 'push':
      if (s.crown > 0) s.crown -= 1;
      break;

    case 'setCrown': {
      if (s.screwed && action.position > 0) {
        messages.push({ type: 'warning', text: 'The crown is screwed down. Unscrew it first (turn it anticlockwise).' });
      } else {
        s.crown = Math.max(0, Math.min(model.positions.length - 1, action.position));
      }
      break;
    }

    case 'turn': {
      const dir = Math.sign(action.dir ?? 1) || 1;
      const clicks = Math.max(1, action.clicks ?? 1);

      if (position.does === 'wind') {
        if (s.screwed) {
          if (dir < 0) {
            s.screwed = false;
            messages.push({ type: 'info', text: 'Unscrewed — the crown springs out slightly. Now you can pull it.' });
          } else {
            messages.push({ type: 'info', text: 'The crown is already screwed down.' });
          }
        } else if (dir > 0) {
          s.windTurns += clicks;
        }
        break;
      }

      if (position.does === 'time') {
        const minutes = action.minutes ?? dir * clicks * TIME_STEP;
        moveHands(s, minutes, kind, messages);
        break;
      }

      if (inDanger(model, s.minutes)) {
        messages.push(dangerMessage(model));
        break;
      }

      if (position.does === 'calendar') {
        if (dir < 0) {
          messages.push({
            type: 'warning',
            text: 'This calendar only goes forwards. If the watch is ahead, let it rest until the real date catches up.',
          });
          break;
        }
        for (let i = 0; i < clicks; i++) {
          advanceDay(s, 'perpetual');
          s.moonAge = mod(s.moonAge + 1, LUNAR_CYCLE);
        }
        break;
      }

      if (position.does === 'quickset') {
        const indicator = dir > 0 ? position.forward : position.backward;
        if (!indicator) {
          messages.push({ type: 'info', text: 'Nothing happens turning this way — try the other direction.' });
          break;
        }
        for (let i = 0; i < clicks; i++) stepIndicator(s, indicator, kind);
      }
      break;
    }

    case 'unlockPushers':
      if (s.pushersLocked) {
        s.pushersLocked = false;
        messages.push({ type: 'info', text: 'Pushers unscrewed — they\'re ready to use.' });
      }
      break;

    case 'lockPushers':
      if (s.chronoRunning) {
        messages.push({ type: 'warning', text: 'Stop the chronograph before screwing the pushers down.' });
      } else if (model.chrono?.screwDownPushers && !s.pushersLocked) {
        s.pushersLocked = true;
        messages.push({ type: 'success', text: 'Pushers screwed down — water-resistant again.' });
      }
      break;

    case 'press': {
      const name = action.corrector;
      if (!(name in model.correctors)) break;
      if (name === 'start' || name === 'reset') {
        pressChrono(s, model, name, action.now ?? Date.now(), messages);
        break;
      }
      if (inDanger(model, s.minutes)) {
        messages.push(dangerMessage(model));
        break;
      }
      const presses = Math.max(1, action.clicks ?? 1);
      for (let i = 0; i < presses; i++) stepIndicator(s, name, kind);
      messages.push({ type: 'quiet', text: `${INDICATOR_NAMES[name]} +${presses}` });
      break;
    }

    default:
      break;
  }

  return { state: s, messages };
}
