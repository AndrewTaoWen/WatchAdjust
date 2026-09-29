import { describe, it, expect } from 'vitest';
import { MODELS, CALENDAR_KIND, indicatorsFor } from '../src/watch/models.js';
import { createState, applyAction } from '../src/watch/mechanism.js';
import { planSteps, calendarValues } from '../src/calculations/planner.js';
import { getMoonAge, LUNAR_CYCLE } from '../src/calculations/moonPhase.js';

const values = (d) => calendarValues(d, getMoonAge(d));

function run(model, state, actions) {
  let s = state;
  const log = [];
  for (const a of [].concat(actions)) {
    const r = applyAction(s, model, a);
    s = r.state;
    log.push(...r.messages);
  }
  return { state: s, log };
}

/** Follow the planner's own buttons until it says the watch is set. */
function setWatch(model, targetDate, start) {
  const target = values(targetDate);
  const prevDate = new Date(targetDate);
  prevDate.setDate(prevDate.getDate() - 1);
  const previous = values(prevDate);
  let state = start;
  for (let i = 0; i < 40; i++) {
    const { steps, allSet } = planSteps({ model, target, previous, state });
    if (allSet) return { state, target, iterations: i };
    const next = steps.find((s) => !s.optional && !s.info && !s.done && s.actions?.length);
    if (!next) throw new Error(`Stuck: ${steps.filter((s) => !s.done && !s.info).map((s) => s.id).join(', ')}`);
    const r = run(model, state, next.actions[next.actions.length - 1].action);
    const danger = r.log.find((m) => m.type === 'danger');
    if (danger) throw new Error(`Hit the danger zone on step ${next.id}`);
    state = r.state;
  }
  throw new Error('Did not converge');
}

const moonClose = (a, b) => {
  const d = Math.abs(a - b) % LUNAR_CYCLE;
  return Math.min(d, LUNAR_CYCLE - d) < 0.75;
};

const TARGETS = [
  new Date(2026, 8, 28, 21, 45), // in the 9 pm–3 am window
  new Date(2026, 8, 29, 2, 10), // after midnight: calendar set to the day before
  new Date(2026, 9, 1, 10, 8), // month boundary after a 30-day month
  new Date(2027, 2, 1, 12, 0), // March 1st
];

describe('planner drives every model to the target', () => {
  for (const model of MODELS) {
    for (const targetDate of TARGETS) {
      it(`${model.id} → ${targetDate.toString().slice(0, 21)}`, () => {
        const startDate = new Date(targetDate);
        startDate.setDate(startDate.getDate() - 23);
        startDate.setHours(16, 40);
        const start = createState(model, { ...values(startDate), amPmKnown: false });

        const { state, target } = setWatch(model, targetDate, start);
        const indicators = indicatorsFor(model);
        const kind = CALENDAR_KIND[model.complication];

        const timeDiff = Math.abs(state.minutes - target.minutes) % (kind === 'none' ? 720 : 1440);
        expect(Math.min(timeDiff, (kind === 'none' ? 720 : 1440) - timeDiff)).toBeLessThanOrEqual(2);
        if (indicators.includes('date')) expect(state.date).toBe(target.date);
        if (indicators.includes('day')) expect(state.day).toBe(target.day);
        if (indicators.includes('month')) expect(state.month).toBe(target.month);
        if (indicators.includes('year')) expect(state.year).toBe(target.year);
        if (indicators.includes('moon')) expect(moonClose(state.moonAge, target.moonAge)).toBe(true);
        expect(state.crown).toBe(0);
        if (model.screwDown) expect(state.screwed).toBe(true);
      });
    }
  }
});

describe('mechanism', () => {
  const rolex = MODELS.find((m) => m.id === 'rolex-day-date-40');
  const seiko = MODELS.find((m) => m.id === 'seiko-presage-day-date');
  const iwc = MODELS.find((m) => m.id === 'iwc-portugieser-perpetual');
  const annual = MODELS.find((m) => m.id === 'typical-annual-calendar');

  it('will not pull a screwed-down crown', () => {
    const { state, log } = run(rolex, createState(rolex), { type: 'pull' });
    expect(state.crown).toBe(0);
    expect(log[0].type).toBe('warning');
  });

  it('blocks quick-set in the changeover window', () => {
    const s = createState(seiko, { minutes: 22 * 60, crown: 1, date: 5 });
    const { state, log } = run(seiko, s, { type: 'turn', dir: 1 });
    expect(state.date).toBe(5);
    expect(log[0].type).toBe('danger');
  });

  it('refuses to turn a linked calendar backwards', () => {
    const s = createState(iwc, { minutes: 600, crown: 1, date: 5 });
    const { state, log } = run(iwc, s, { type: 'turn', dir: -1 });
    expect(state.date).toBe(5);
    expect(log[0].type).toBe('warning');
  });

  it('annual calendar goes from April 30 to May 1 but from February 28 to 29', () => {
    const april = run(annual, createState(annual, { minutes: 23 * 60 + 50, crown: 2, date: 30, month: 3 }), {
      type: 'turn',
      minutes: 20,
    }).state;
    expect([april.date, april.month]).toEqual([1, 4]);
    const feb = run(annual, createState(annual, { minutes: 23 * 60 + 50, crown: 2, date: 28, month: 1 }), {
      type: 'turn',
      minutes: 20,
    }).state;
    expect([feb.date, feb.month]).toEqual([29, 1]);
  });
});
