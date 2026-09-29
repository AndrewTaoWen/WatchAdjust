import './style.css';
import { WatchScene } from './watch/WatchScene.js';
import { computeAdjustments, COMPLICATIONS } from './calculations/complications.js';
import { planSteps, calendarValues, formatMinutes } from './calculations/planner.js';
import { getMoonAge, isSouthernTimezone, PHASE_AGES, LUNAR_CYCLE } from './calculations/moonPhase.js';
import { modelsFor, getModel, modelLabel, indicatorsFor, positionFor } from './watch/models.js';
import { createState, applyAction, TIME_STEP } from './watch/mechanism.js';
import {
  renderInstructions,
  populateTimezones,
  setTimezoneSelect,
  toDatetimeLocalValue,
  parseDatetimeLocal,
  nowInTimezone,
  wallClockToInstant,
} from './ui/panel.js';
import { handleTermClick } from './ui/glossary.js';

const $ = (id) => document.getElementById(id);
const canvas = $('watch-canvas');
const picker = $('complication-picker');
const modelSelect = $('model');
const modelBlurb = $('model-blurb');
const targetDateInput = $('target-date');
const timezoneSelect = $('timezone');
const hemisphereSelect = $('hemisphere');
const tzCurrentEl = $('tz-current');
const locateMeBtn = $('locate-me');
const locationStatusEl = $('location-status');
const instructionsEl = $('instructions');
const practiceSetup = $('practice-setup');
const playBtn = $('play');
const timebar = document.querySelector('.timebar:not(.crownbar)');
const crownbar = $('crownbar');
const toastEl = $('toast');
const readoutDate = document.querySelector('.tb-date');
const readoutTime = document.querySelector('.tb-time');
const themeToggle = $('theme-toggle');

const watch = new WatchScene(canvas);
const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
if (coarsePointer) $('viewport-hint').textContent = 'Drag to turn · Pinch to zoom';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const state = {
  type: COMPLICATIONS[0].id,
  model: modelsFor(COMPLICATIONS[0].id)[0],
  date: new Date(),
  mode: 'guide', // 'guide' | 'practice'
  done: new Set(), // manual ticks in guide mode
  active: null,
  playing: false,
  result: null,
  plan: null,
  watch: null, // simulated watch state in practice mode
  latitude: null,
};

// ---------- Complication & model pickers ----------

picker.innerHTML = COMPLICATIONS.map(
  (c, i) => `
    <label class="pick">
      <input type="radio" name="complication" value="${c.id}" ${i === 0 ? 'checked' : ''} />
      <span class="pick-icon" aria-hidden="true">${c.icon}</span>
      <span class="pick-text">
        <span class="pick-name">${c.name}</span>
        <span class="pick-tag">${c.tagline}</span>
      </span>
    </label>`,
).join('');

picker.addEventListener('change', (e) => {
  state.type = e.target.value;
  populateModels();
  setModel(modelsFor(state.type)[0]);
});

function populateModels() {
  const models = modelsFor(state.type);
  modelSelect.innerHTML = models
    .map((m) => `<option value="${m.id}">${m.brand ? modelLabel(m) : `${m.name} (generic)`}</option>`)
    .join('');
}

modelSelect.addEventListener('change', () => setModel(getModel(modelSelect.value)));

function setModel(model) {
  state.model = model;
  modelSelect.value = model.id;
  modelBlurb.textContent = model.brand
    ? `${model.blurb} Steps follow the usual instructions for this model — your manual has the final word.`
    : 'A typical watch of this kind. Pick a brand model to see its specific controls.';
  watch.setModel(model);
  applyStrap(model.look.strap);
  state.done = new Set();
  state.active = null;
  watch.highlightPart(null);
  resetWatchState();
  renderPracticeForm();
  refresh();
}

// ---------- Hemisphere ----------

function isSouthern() {
  const pref = hemisphereSelect.value;
  if (pref !== 'auto') return pref === 'south';
  if (state.latitude != null) return state.latitude < 0;
  return isSouthernTimezone(timezoneSelect.value);
}

hemisphereSelect.addEventListener('change', refresh);

// ---------- Rendering ----------

const readoutDateFmt = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const readoutTimeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

function targetValues() {
  const tz = timezoneSelect.value;
  const date = state.date;
  const target = calendarValues(date, getMoonAge(wallClockToInstant(date, tz)));
  const prev = new Date(date);
  prev.setDate(prev.getDate() - 1);
  const previous = calendarValues(prev, getMoonAge(wallClockToInstant(prev, tz)));
  return { target, previous };
}

function refresh({ panel = true } = {}) {
  const date = state.date;
  const southern = isSouthern();
  const instant = wallClockToInstant(date, timezoneSelect.value);
  const result = computeAdjustments(state.model, date, instant, { southern });
  state.result = result;

  const practice = state.mode === 'practice';
  const { target, previous } = targetValues();
  state.plan = planSteps({
    model: state.model,
    target,
    previous,
    state: practice ? state.watch : null,
    southern,
  });

  watch.setHemisphere(southern);
  if (practice) {
    showWatchState();
  } else {
    watch.setTargetDate(date);
    watch.applySceneState(result.scene);
  }

  readoutDate.textContent = readoutDateFmt.format(date);
  readoutTime.textContent = readoutTimeFmt.format(date);
  if (document.activeElement !== targetDateInput) {
    targetDateInput.value = toDatetimeLocalValue(date);
  }

  if (panel) renderPanel();
}

function renderPanel() {
  const info = COMPLICATIONS.find((c) => c.id === state.type);
  const practice = state.mode === 'practice';
  renderInstructions(instructionsEl, state.result, {
    about: info.about,
    name: info.name,
    steps: state.plan.steps,
    practice,
    allSet: state.plan.allSet,
    done: state.done,
    active: state.active,
  });

  if (practice) {
    syncPracticeForm();
    updateCrownbar();
    // Guide the eye to whatever the next step needs.
    const steps = state.plan.steps;
    const next = steps.find((s) => !s.done && !s.optional && !s.info);
    const chosen = state.active != null ? steps[state.active] : next;
    watch.highlightPart(state.plan.allSet ? null : chosen?.part ?? null);
  }
}

// ---------- Guide mode: steps ↔ watch highlight ----------

function setActiveStep(index, { render = true } = {}) {
  state.active = index;
  const part = index == null ? null : state.plan?.steps[index]?.part ?? null;
  watch.highlightPart(part);
  if (render) renderPanel();
}

instructionsEl.addEventListener('click', (e) => {
  const term = e.target.closest('.term');
  if (term) {
    handleTermClick(term);
    return;
  }

  const actionBtn = e.target.closest('.step-action');
  if (actionBtn) {
    const step = state.plan.steps[Number(actionBtn.dataset.step)];
    const action = step?.actions?.[Number(actionBtn.dataset.action)];
    if (action) runActions(action.action);
    return;
  }

  if (e.target.closest('.step-check')) return; // checkbox handled on change

  const stepEl = e.target.closest('.step');
  if (!stepEl || !stepEl.dataset.part) return;
  const index = Number(stepEl.dataset.index);
  setActiveStep(state.active === index ? null : index);
});

instructionsEl.addEventListener('change', (e) => {
  if (e.target.type !== 'checkbox') return;
  const index = Number(e.target.closest('.step').dataset.index);
  if (e.target.checked) state.done.add(index);
  else state.done.delete(index);

  // Move the highlight on to the next unfinished step so users can just tick through.
  const steps = state.plan.steps;
  const next = steps.findIndex((s, i) => !state.done.has(i) && s.part && !s.info);
  setActiveStep(e.target.checked && next !== -1 ? next : state.active);
  instructionsEl.querySelector(`.step[data-index="${index}"] input`)?.focus();
});

// Hover preview on devices with a mouse.
if (!coarsePointer) {
  instructionsEl.addEventListener('pointerover', (e) => {
    const stepEl = e.target.closest('.step');
    if (stepEl?.dataset.part && state.active == null && state.mode === 'guide') {
      watch.highlightPart(stepEl.dataset.part);
    }
  });
  instructionsEl.addEventListener('pointerleave', () => {
    if (state.active == null && state.mode === 'guide') watch.highlightPart(null);
  });
}

$('reset-view').addEventListener('click', () => {
  state.active = null;
  watch.highlightPart(null);
  watch.resetView();
  renderPanel();
});

// ---------- Mode tabs ----------

const tabGuide = $('tab-guide');
const tabPractice = $('tab-practice');

function setMode(mode) {
  if (mode === state.mode) return;
  stopPlaying();
  state.mode = mode;
  state.active = null;
  const practice = mode === 'practice';
  tabGuide.setAttribute('aria-selected', String(!practice));
  tabPractice.setAttribute('aria-selected', String(practice));
  practiceSetup.hidden = !practice;
  timebar.hidden = practice;
  crownbar.hidden = !practice;
  watch.showDangerWindow(practice);
  watch.setInteractive(practice ? crownHandlers : null);
  if (!practice) {
    watch.setCrownPosition(0);
    watch.highlightPart(null);
  }
  refresh();
}

tabGuide.addEventListener('click', () => setMode('guide'));
tabPractice.addEventListener('click', () => setMode('practice'));
[tabGuide, tabPractice].forEach((tab) =>
  tab.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const other = tab === tabGuide ? tabPractice : tabGuide;
    other.focus();
    other.click();
    e.preventDefault();
  }),
);

// ---------- Practice: the simulated watch ----------

/** Start from a watch that stopped a few days ago — the common real-life case. */
function resetWatchState() {
  const stopped = new Date(state.date);
  stopped.setDate(stopped.getDate() - 3);
  stopped.setHours(10, 8, 0, 0);
  const values = calendarValues(stopped, getMoonAge(wallClockToInstant(stopped, timezoneSelect.value)));
  state.watch = createState(state.model, { ...values, amPmKnown: false });
  watch.setCrownPosition(0);
}

function showWatchState() {
  const ws = state.watch;
  const hands = new Date(2000, 0, 1, Math.floor(ws.minutes / 60), Math.round(ws.minutes % 60));
  watch.setTargetDate(hands);
  watch.applySceneState({
    ...state.result.scene,
    moonPhase: ws.moonAge / LUNAR_CYCLE,
    dayIndex: ws.day,
    dateNum: ws.date,
    monthIndex: ws.month,
    year: ws.year,
  });
  watch.setCrownPosition(ws.crown);
}

let toastTimer = null;
function toast(message) {
  if (!message || message.type === 'quiet') return;
  toastEl.textContent = message.text;
  toastEl.dataset.type = message.type;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.hidden = true;
  }, message.type === 'danger' ? 6000 : 3500);
}

function apply(action) {
  const { state: next, messages } = applyAction(state.watch, state.model, action);
  const blocked = messages.some((m) => m.type === 'danger' || m.type === 'warning');
  state.watch = next;
  if (action.type === 'turn' && !blocked) {
    const dir = action.minutes != null ? Math.sign(action.minutes) : action.dir;
    watch.turnCrown(dir || 1, action.clicks ?? Math.ceil(Math.abs(action.minutes ?? 10) / TIME_STEP));
  }
  if (action.type === 'press' && !blocked) watch.pressCorrector(action.corrector);
  messages.forEach(toast);
  return !blocked;
}

let running = false;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Run step actions on the simulated watch. Long hand movements are split
 * into small turns so you can watch the hands sweep and the date flip.
 */
async function runActions(actions) {
  if (running) return;
  running = true;
  try {
    for (const action of [].concat(actions)) {
      if (action.type === 'turn' && action.minutes != null && Math.abs(action.minutes) > 30 && !reducedMotion) {
        const frames = Math.min(90, Math.max(12, Math.round(Math.abs(action.minutes) / 20)));
        let moved = 0;
        for (let f = 1; f <= frames; f++) {
          const goal = Math.round((action.minutes * f) / frames);
          if (!apply({ type: 'turn', minutes: goal - moved })) return;
          moved = goal;
          refresh({ panel: f === frames });
          await nextFrame();
        }
      } else if ((action.clicks ?? 1) > 1 && !reducedMotion) {
        for (let c = 0; c < action.clicks; c++) {
          if (!apply({ ...action, clicks: 1 })) return;
          refresh({ panel: false });
          await wait(70);
        }
      } else if (!apply(action)) {
        return;
      }
    }
  } finally {
    running = false;
    refresh();
  }
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(r));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Crown on the 3D watch
const crownHandlers = {
  onCrownTap() {
    const last = state.model.positions.length - 1;
    runActions(state.watch.crown < last ? { type: 'pull' } : { type: 'setCrown', position: 0 });
  },
  onCrownTurn(dir) {
    apply({ type: 'turn', dir });
    refresh();
  },
  onCorrectorPress(name) {
    runActions({ type: 'press', corrector: name });
  },
};

// Crown bar
const crownPos = $('crown-pos');
const crownDoes = $('crown-does');
const crownScrew = $('crown-screw');

function updateCrownbar() {
  const model = state.model;
  const ws = state.watch;
  const pos = model.positions[ws.crown];
  crownPos.textContent = ws.crown === 0 ? 'Crown pushed in' : `Crown: ${pos.label}`;
  let does;
  if (pos.does === 'wind') does = ws.screwed ? 'Screwed down — turn ↺ to unscrew' : 'Turn ↻ to wind';
  else if (pos.does === 'time') does = `Turn to move the hands · ${formatMinutes(ws.minutes)}`;
  else if (pos.does === 'calendar') does = 'Turn ↻ to advance the calendar';
  else if (pos.does === 'quickset') {
    does = [pos.forward && `↻ ${pos.forward}`, pos.backward && `↺ ${pos.backward}`].filter(Boolean).join(' · ');
  }
  crownDoes.textContent = does;
  $('crown-push').disabled = ws.crown === 0;
  $('crown-pull').disabled = ws.crown === model.positions.length - 1;
  crownScrew.hidden = !(model.screwDown && ws.crown === 0 && !ws.screwed);
}

$('crown-push').addEventListener('click', () => runActions({ type: 'push' }));
$('crown-pull').addEventListener('click', () => runActions({ type: 'pull' }));
crownScrew.addEventListener('click', () => runActions({ type: 'screw' }));

// Hold a turn button to keep turning.
function holdToRepeat(button, dir) {
  let timer = null;
  const turn = () => {
    apply({ type: 'turn', dir });
    refresh();
  };
  const stop = () => {
    clearTimeout(timer);
    timer = null;
  };
  button.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    turn();
    const repeat = (delay) => {
      timer = setTimeout(() => {
        turn();
        repeat(Math.max(40, delay * 0.8));
      }, delay);
    };
    repeat(350);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => button.addEventListener(ev, stop));
  button.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      turn();
    }
  });
}
holdToRepeat($('crown-fwd'), 1);
holdToRepeat($('crown-back'), -1);

// "What does your watch show now?"
function renderPracticeForm() {
  const model = state.model;
  const indicators = indicatorsFor(model);
  const linked = positionFor(model, 'calendar') !== -1;
  const opts = (items, selected) =>
    items.map(([v, label]) => `<option value="${v}"${String(v) === String(selected) ? ' selected' : ''}>${label}</option>`).join('');
  const field = (id, label, control) => `<label class="ws-field" for="${id}"><span>${label}</span>${control}</label>`;
  const range = (n, from = 0) => Array.from({ length: n }, (_, i) => [i + from, i + from]);

  const parts = [];
  parts.push(
    field(
      'ws-hour',
      'Time',
      `<span class="ws-time">
        <select id="ws-hour" class="select select-sm" data-ws="hour" aria-label="Hour">${opts(range(12, 1), 12)}</select>
        <span aria-hidden="true">:</span>
        <select id="ws-minute" class="select select-sm" data-ws="minute" aria-label="Minute">${opts(
          range(60).map(([v]) => [v, String(v).padStart(2, '0')]),
          0,
        )}</select>
      </span>`,
    ),
  );
  if (indicators.includes('date')) parts.push(field('ws-date', 'Date', `<select id="ws-date" class="select select-sm" data-ws="date">${opts(range(31, 1))}</select>`));
  if (indicators.includes('day') && !linked) {
    parts.push(field('ws-day', 'Day', `<select id="ws-day" class="select select-sm" data-ws="day">${opts(DAYS.map((d, i) => [i, d]))}</select>`));
  }
  if (indicators.includes('month')) {
    parts.push(field('ws-month', 'Month', `<select id="ws-month" class="select select-sm" data-ws="month">${opts(MONTHS.map((m, i) => [i, m]))}</select>`));
  }
  if (indicators.includes('year')) {
    const y = state.date.getFullYear();
    parts.push(field('ws-year', 'Year', `<select id="ws-year" class="select select-sm" data-ws="year">${opts(range(12, y - 10))}</select>`));
  }
  if (indicators.includes('moon') && !linked) {
    parts.push(
      field(
        'ws-moon',
        'Moon',
        `<select id="ws-moon" class="select select-sm" data-ws="moon">${opts(PHASE_AGES.map((p) => [p.age, p.name]))}</select>`,
      ),
    );
  }

  practiceSetup.innerHTML = `
    <div class="ws-card">
      <div class="ws-head">
        <h3 class="section-heading">What does your watch show now?</h3>
        <button type="button" class="chip-btn" id="ws-reset">Reset example</button>
      </div>
      <p class="section-hint">We start with a watch that stopped 3 days ago. Change these to match yours — or just practise.${
        linked ? ' The day and moon follow the date on this watch.' : ''
      }</p>
      <div class="ws-grid">${parts.join('')}</div>
    </div>`;
  syncPracticeForm();
}

function syncPracticeForm() {
  const ws = state.watch;
  if (!ws || practiceSetup.hidden) return;
  const set = (key, value) => {
    const el = practiceSetup.querySelector(`[data-ws="${key}"]`);
    if (el && document.activeElement !== el) el.value = String(value);
  };
  const h = Math.floor(ws.minutes / 60) % 12 || 12;
  set('hour', h);
  set('minute', Math.floor(ws.minutes % 60));
  set('date', ws.date);
  set('day', ws.day);
  set('month', ws.month);
  set('year', ws.year);
  const nearest = PHASE_AGES.reduce((best, p) => {
    const d = Math.abs(((p.age - ws.moonAge + LUNAR_CYCLE * 1.5) % LUNAR_CYCLE) - LUNAR_CYCLE / 2);
    return d < best.d ? { d, age: p.age } : best;
  }, { d: Infinity, age: 0 });
  set('moon', nearest.age);
}

practiceSetup.addEventListener('change', (e) => {
  const key = e.target.dataset.ws;
  if (!key) return;
  const ws = { ...state.watch };
  const v = Number(e.target.value);
  if (key === 'hour' || key === 'minute') {
    const hour = key === 'hour' ? v : Math.floor(ws.minutes / 60) % 12 || 12;
    const minute = key === 'minute' ? v : Math.floor(ws.minutes % 60);
    // Hands can't tell AM from PM — the steps will find midnight.
    ws.minutes = (hour % 12) * 60 + minute;
    ws.amPmKnown = false;
  } else if (key === 'moon') {
    ws.moonAge = v;
  } else {
    ws[key] = v;
  }
  // Linked calendars keep day and moon in step with the date.
  if (positionFor(state.model, 'calendar') !== -1 && ['date', 'month', 'year'].includes(key)) {
    const d = new Date(ws.year, ws.month, Math.min(ws.date, new Date(ws.year, ws.month + 1, 0).getDate()), 12);
    ws.day = d.getDay();
    ws.moonAge = getMoonAge(d);
  }
  state.watch = ws;
  refresh();
});

practiceSetup.addEventListener('click', (e) => {
  if (e.target.id === 'ws-reset') {
    resetWatchState();
    refresh();
  }
});

// ---------- Strap ----------

const STRAP_KEY = 'watchadjust-strap';
const strapInputs = document.querySelectorAll('input[name="strap"]');

function applyStrap(style) {
  watch.setStrap(style);
  strapInputs.forEach((input) => {
    input.checked = input.value === style;
  });
}

strapInputs.forEach((input) =>
  input.addEventListener('change', () => {
    applyStrap(input.value);
    try {
      localStorage.setItem(STRAP_KEY, input.value);
    } catch {
      // Storage unavailable — the choice still applies for this visit.
    }
  }),
);

// ---------- Time travel ----------

function shiftDate(step) {
  const d = new Date(state.date);
  const amount = parseInt(step, 10);
  if (step.endsWith('M')) {
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + amount);
    // Clamp Jan 31 + 1 month to Feb 28/29 rather than spilling into March.
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  } else {
    d.setDate(d.getDate() + amount);
  }
  state.date = d;
  refresh();
}

document.querySelectorAll('.tb-btn[data-step]').forEach((btn) => {
  btn.addEventListener('click', () => {
    stopPlaying();
    shiftDate(btn.dataset.step);
  });
});

// Play: run the clock fast so people can watch the date flip and the moon change.
const MINUTES_PER_SECOND = 60 * 24 * 1.2; // ~1.2 days per real second
let lastFrame = 0;
let lastPanelUpdate = 0;

function tick(now) {
  if (!state.playing) return;
  const dt = Math.min((now - lastFrame) / 1000, 0.1);
  lastFrame = now;
  state.date = new Date(state.date.getTime() + dt * MINUTES_PER_SECOND * 60000);

  // The 3D watch updates every frame; the text panel a few times a second.
  const panelDue = now - lastPanelUpdate > 400;
  if (panelDue) lastPanelUpdate = now;
  refresh({ panel: panelDue });
  requestAnimationFrame(tick);
}

function startPlaying() {
  if (state.mode !== 'guide') return;
  state.playing = true;
  playBtn.setAttribute('aria-pressed', 'true');
  playBtn.setAttribute('aria-label', 'Pause');
  playBtn.firstElementChild.textContent = '❚❚';
  instructionsEl.setAttribute('aria-live', 'off');
  lastFrame = performance.now();
  requestAnimationFrame(tick);
}

function stopPlaying() {
  if (!state.playing) return;
  state.playing = false;
  playBtn.setAttribute('aria-pressed', 'false');
  playBtn.setAttribute('aria-label', 'Play time forward');
  playBtn.firstElementChild.textContent = '▶';
  instructionsEl.setAttribute('aria-live', 'polite');
  // Snap to the minute so the panel shows a clean time.
  state.date.setSeconds(0, 0);
  refresh();
}

playBtn.addEventListener('click', () => (state.playing ? stopPlaying() : startPlaying()));

// Keyboard: ←/→ day, Shift+←/→ month, Space play — in guide mode, when not typing.
document.addEventListener('keydown', (e) => {
  if (state.mode !== 'guide') return;
  if (e.target.closest('input, select, textarea, [contenteditable], [role="tab"]')) return;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    const sign = e.key === 'ArrowLeft' ? '-' : '';
    stopPlaying();
    shiftDate(`${sign}1${e.shiftKey ? 'M' : 'd'}`);
    e.preventDefault();
  } else if (e.key === ' ' && !e.target.closest('button, summary, label')) {
    state.playing ? stopPlaying() : startPlaying();
    e.preventDefault();
  }
});

// ---------- Date, time zone, location ----------

function updateTzLabel() {
  tzCurrentEl.textContent = timezoneSelect.value.replace(/_/g, ' ');
}

function setToNow() {
  stopPlaying();
  state.date = nowInTimezone(timezoneSelect.value);
  refresh();
}

targetDateInput.addEventListener('change', () => {
  if (!targetDateInput.value) return;
  stopPlaying();
  state.date = parseDatetimeLocal(targetDateInput.value);
  refresh();
});

timezoneSelect.addEventListener('change', () => {
  state.latitude = null;
  updateTzLabel();
  refresh();
});

$('use-now').addEventListener('click', setToNow);

function setLocationStatus(message, type = 'info') {
  locationStatusEl.textContent = message;
  locationStatusEl.dataset.type = type;
}

async function locateMe() {
  locateMeBtn.disabled = true;
  locateMeBtn.textContent = 'Locating…';
  setLocationStatus('Requesting your location…');

  try {
    const { locateUser } = await import('./ui/location.js');
    const { timezone, placeName, coords } = await locateUser();
    setTimezoneSelect(timezoneSelect, timezone);
    state.latitude = coords.latitude;
    updateTzLabel();
    setToNow();

    const zoneLabel = timezone.replace(/_/g, ' ');
    const placeText = placeName ? `${placeName} · ` : '';
    setLocationStatus(`${placeText}${zoneLabel}`, 'success');
  } catch (error) {
    const fallback = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezoneSelect(timezoneSelect, fallback);
    updateTzLabel();
    setToNow();
    setLocationStatus(
      `${error.message} Using browser timezone (${fallback.replace(/_/g, ' ')}).`,
      'warning',
    );
  } finally {
    locateMeBtn.disabled = false;
    locateMeBtn.textContent = 'Locate me';
  }
}

locateMeBtn.addEventListener('click', locateMe);

// ---------- Theme ----------

const THEME_KEY = 'watchadjust-theme';

function currentTheme() {
  return (
    document.documentElement.dataset.theme ??
    (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
  );
}

function applyTheme(theme) {
  if (theme) document.documentElement.dataset.theme = theme;
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  themeToggle.setAttribute('aria-label', `Switch to ${next} theme`);
  themeToggle.firstElementChild.textContent = next === 'light' ? '☀' : '☾';
}

try {
  applyTheme(localStorage.getItem(THEME_KEY));
} catch {
  applyTheme(null);
}

themeToggle.addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    // Storage unavailable (private mode) — the toggle still works for this visit.
  }
});

// ---------- Start ----------

populateTimezones(timezoneSelect);
updateTzLabel();
state.date = nowInTimezone(timezoneSelect.value);
populateModels();
setModel(state.model);
try {
  const saved = localStorage.getItem(STRAP_KEY);
  if (saved === 'steel' || saved === 'leather') applyStrap(saved);
} catch {
  // Storage unavailable — keep the model's strap.
}
