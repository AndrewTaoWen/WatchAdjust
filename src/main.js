import './style.css';
import { WatchScene } from './watch/WatchScene.js';
import { computeAdjustments, COMPLICATIONS } from './calculations/complications.js';
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
const targetDateInput = $('target-date');
const timezoneSelect = $('timezone');
const tzCurrentEl = $('tz-current');
const locateMeBtn = $('locate-me');
const locationStatusEl = $('location-status');
const instructionsEl = $('instructions');
const playBtn = $('play');
const readoutDate = document.querySelector('.tb-date');
const readoutTime = document.querySelector('.tb-time');
const themeToggle = $('theme-toggle');

const watch = new WatchScene(canvas);
const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
if (coarsePointer) $('viewport-hint').textContent = 'Drag to turn · Pinch to zoom';

const state = {
  type: COMPLICATIONS[0].id,
  date: new Date(),
  done: new Set(),
  active: null,
  playing: false,
  result: null,
};

// ---------- Complication picker ----------

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
  state.done = new Set();
  setActiveStep(null, { render: false });
  refresh();
});

// ---------- Rendering ----------

const readoutDateFmt = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const readoutTimeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

function refresh({ panel = true } = {}) {
  const date = state.date;
  const instant = wallClockToInstant(date, timezoneSelect.value);
  const result = computeAdjustments(state.type, date, instant);
  state.result = result;

  watch.setTargetDate(date);
  watch.applySceneState(result.scene);

  readoutDate.textContent = readoutDateFmt.format(date);
  readoutTime.textContent = readoutTimeFmt.format(date);
  if (document.activeElement !== targetDateInput) {
    targetDateInput.value = toDatetimeLocalValue(date);
  }

  if (panel) renderPanel();
}

function renderPanel() {
  const info = COMPLICATIONS.find((c) => c.id === state.type);
  renderInstructions(instructionsEl, state.result, {
    about: info.about,
    name: info.name,
    done: state.done,
    active: state.active,
  });
}

// ---------- Steps ↔ watch highlight ----------

function setActiveStep(index, { render = true } = {}) {
  state.active = index;
  const part = index == null ? null : state.result?.steps[index]?.part ?? null;
  watch.highlightPart(part);
  if (render) renderPanel();
}

instructionsEl.addEventListener('click', (e) => {
  const term = e.target.closest('.term');
  if (term) {
    handleTermClick(term);
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
  const steps = state.result.steps;
  const next = steps.findIndex((s, i) => !state.done.has(i) && s.part);
  setActiveStep(e.target.checked && next !== -1 ? next : state.active);
  instructionsEl.querySelector(`.step[data-index="${index}"] input`)?.focus();
});

// Hover preview on devices with a mouse.
if (!coarsePointer) {
  instructionsEl.addEventListener('pointerover', (e) => {
    const stepEl = e.target.closest('.step');
    if (stepEl?.dataset.part && state.active == null) watch.highlightPart(stepEl.dataset.part);
  });
  instructionsEl.addEventListener('pointerleave', () => {
    if (state.active == null) watch.highlightPart(null);
  });
}

$('reset-view').addEventListener('click', () => setActiveStep(null));

// ---------- Strap ----------

const STRAP_KEY = 'watchadjust-strap';
const strapInputs = document.querySelectorAll('input[name="strap"]');

function applyStrap(style) {
  watch.setStrap(style);
  strapInputs.forEach((input) => {
    input.checked = input.value === style;
  });
}

try {
  const saved = localStorage.getItem(STRAP_KEY);
  if (saved === 'steel' || saved === 'leather') applyStrap(saved);
} catch {
  // Storage unavailable — keep the default strap.
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

// Keyboard: ←/→ day, Shift+←/→ month, Space play — when not typing in a field.
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, select, textarea, [contenteditable]')) return;
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
    const { timezone, placeName } = await locateUser();
    setTimezoneSelect(timezoneSelect, timezone);
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
refresh();
