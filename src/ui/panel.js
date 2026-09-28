import { linkTerms } from './glossary.js';

/**
 * @param {HTMLElement} container
 * @param {object} result from computeAdjustments
 * @param {{ about?: string, name?: string, done?: Set<number>, active?: number | null }} ui
 */
export function renderInstructions(container, result, ui = {}) {
  const { summary, values, steps, notes } = result;
  const { about = '', name = result.title, done = new Set(), active = null } = ui;
  const seen = new Set();

  const valuesHtml = Object.entries(values)
    .map(
      ([key, val]) => `
        <div class="value-row">
          <span class="value-key">${formatKey(key)}</span>
          <span class="value-val">${escapeHtml(val)}</span>
        </div>`,
    )
    .join('');

  const stepsHtml = steps
    .map((s, i) => {
      const isDone = done.has(i);
      const isActive = active === i;
      return `
        <li class="step${isDone ? ' is-done' : ''}${isActive ? ' is-active' : ''}" data-index="${i}" data-part="${s.part ?? ''}">
          <label class="step-check">
            <input type="checkbox" ${isDone ? 'checked' : ''} aria-label="Mark step ${i + 1} as done" />
            <span class="step-num" aria-hidden="true">${i + 1}</span>
          </label>
          <div class="step-body">
            <strong>${escapeHtml(s.title)}</strong>
            <p>${linkTerms(escapeHtml(s.detail), seen)}</p>
            ${
              s.part
                ? `<button type="button" class="step-show" aria-pressed="${isActive}">
                    ${isActive ? 'Showing on watch' : 'Show on watch'}
                  </button>`
                : ''
            }
          </div>
        </li>`;
    })
    .join('');

  const notesHtml = notes
    .map((n) => `<div class="note note-${n.type}">${linkTerms(escapeHtml(n.text), seen)}</div>`)
    .join('');

  const doneCount = steps.filter((_, i) => done.has(i)).length;

  container.innerHTML = `
    <div class="result">
      <details class="about" open>
        <summary>What is a ${escapeHtml(name)}?</summary>
        <p>${linkTerms(escapeHtml(about), seen)}</p>
      </details>

      <p class="result-summary">${escapeHtml(summary)}</p>

      <div class="values-grid">${valuesHtml}</div>

      <div class="section-head">
        <h3 class="section-heading">How to set it</h3>
        <span class="progress" aria-live="polite">${doneCount}/${steps.length} done</span>
      </div>
      <p class="section-hint">Tap a step to see where it is on the watch. Underlined words explain themselves.</p>
      <ol class="steps">${stepsHtml}</ol>

      <h3 class="section-heading">Good to know</h3>
      <div class="notes">${notesHtml}</div>
    </div>
  `;
}

function formatKey(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase());
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function populateTimezones(select) {
  const zones = Intl.supportedValuesOf('timeZone');
  const local = Intl.DateTimeFormat().resolvedOptions().timeZone;

  zones.forEach((zone) => {
    const opt = document.createElement('option');
    opt.value = zone;
    opt.textContent = zone.replace(/_/g, ' ');
    if (zone === local) opt.selected = true;
    select.appendChild(opt);
  });
}

export function setTimezoneSelect(select, timezone) {
  const option = Array.from(select.options).find((opt) => opt.value === timezone);
  if (option) {
    select.value = timezone;
    return true;
  }

  const opt = document.createElement('option');
  opt.value = timezone;
  opt.textContent = timezone.replace(/_/g, ' ');
  opt.selected = true;
  select.appendChild(opt);
  return true;
}

export function toDatetimeLocalValue(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Parse datetime-local as literal wall-clock components (what the watch should show). */
export function parseDatetimeLocal(value) {
  if (!value) return new Date();

  const [datePart, timePart] = value.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = (timePart ?? '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

export function nowInTimezone(timezone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date()).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]),
  );
  return new Date(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    0,
    0,
  );
}

/**
 * Interpret a wall-clock Date (built from local components) as a time in
 * `timezone` and return the matching absolute instant.
 */
export function wallClockToInstant(date, timezone) {
  const asUtc = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
  );
  let instant = asUtc - tzOffsetMs(asUtc, timezone);
  // Second pass settles DST transitions.
  instant = asUtc - tzOffsetMs(instant, timezone);
  return new Date(instant);
}

function tzOffsetMs(utcMs, timezone) {
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hourCycle: 'h23',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
      })
        .formatToParts(new Date(utcMs))
        .filter((p) => p.type !== 'literal')
        .map((p) => [p.type, Number(p.value)]),
    );
    const wall = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    return wall - Math.floor(utcMs / 60000) * 60000;
  } catch {
    return -new Date(utcMs).getTimezoneOffset() * 60000;
  }
}
