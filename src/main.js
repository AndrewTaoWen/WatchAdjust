import './style.css';
import { WatchScene } from './watch/WatchScene.js';
import { computeAdjustments } from './calculations/complications.js';
import {
  renderInstructions,
  populateTimezones,
  setTimezoneSelect,
  toDatetimeLocalValue,
  parseDatetimeLocal,
  nowInTimezone,
} from './ui/panel.js';

const canvas = document.getElementById('watch-canvas');
const complicationSelect = document.getElementById('complication-type');
const targetDateInput = document.getElementById('target-date');
const useNowBtn = document.getElementById('use-now');
const timezoneSelect = document.getElementById('timezone');
const locateMeBtn = document.getElementById('locate-me');
const locationStatusEl = document.getElementById('location-status');
const instructionsEl = document.getElementById('instructions');

const watch = new WatchScene(canvas);

populateTimezones(timezoneSelect);

function getTargetDate() {
  return parseDatetimeLocal(targetDateInput.value);
}

function refresh() {
  const date = getTargetDate();
  const type = complicationSelect.value;
  const result = computeAdjustments(type, date);

  watch.setTargetDate(date);
  watch.applySceneState(result.scene);
  renderInstructions(instructionsEl, result);
}

function setToNow() {
  const now = nowInTimezone(timezoneSelect.value);
  targetDateInput.value = toDatetimeLocalValue(now);
  refresh();
}

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

    const now = nowInTimezone(timezone);
    targetDateInput.value = toDatetimeLocalValue(now);
    refresh();

    const zoneLabel = timezone.replace(/_/g, ' ');
    const placeText = placeName ? `${placeName} · ` : '';
    setLocationStatus(`${placeText}${zoneLabel}`, 'success');
  } catch (error) {
    const fallback = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezoneSelect(timezoneSelect, fallback);
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

targetDateInput.value = toDatetimeLocalValue(new Date());

complicationSelect.addEventListener('change', refresh);
targetDateInput.addEventListener('change', refresh);
timezoneSelect.addEventListener('change', refresh);
useNowBtn.addEventListener('click', setToNow);
locateMeBtn.addEventListener('click', locateMe);

refresh();
