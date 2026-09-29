import { linkTerms } from './glossary.js';

/**
 * @param {HTMLElement} container
 * @param {object} result   from computeAdjustments
 * @param {object} ui
 * @param {object[]} ui.steps     from planSteps
 * @param {boolean} [ui.practice] steps track a simulated watch (auto-ticked, with action buttons)
 * @param {boolean} [ui.allSet]
 * @param {Set<number>} [ui.done] manual ticks in guide mode
 * @param {number|null} [ui.active]
 */
export function renderInstructions(container, result, ui) {
  const { summary, values, notes } = result;
  const { about = '', name = '', steps, practice = false, allSet = false, done = new Set(), active = null } = ui;
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

  const current = practice ? steps.findIndex((s) => !s.done && !s.optional && !s.info) : -1;
  let number = 0;
  const stepsHtml = steps
    .map((s, i) => {
      const detail = linkTerms(escapeHtml(s.detail), seen);
      if (s.info) {
        return `<li class="step-info"><strong>${escapeHtml(s.title)}</strong><p>${detail}</p></li>`;
      }
      number += 1;
      const isDone = practice ? s.done : done.has(i);
      const isActive = practice ? (active ?? current) === i : active === i;
      const marker = practice
        ? `<span class="step-num" aria-hidden="true">${number}</span>
           <span class="sr-only">${isDone ? 'Done' : i === current ? 'Next step' : 'To do'}</span>`
        : `<label class="step-check">
             <input type="checkbox" ${isDone ? 'checked' : ''} aria-label="Mark step ${number} as done" />
             <span class="step-num" aria-hidden="true">${number}</span>
           </label>`;
      const actions =
        practice && !isDone && s.actions?.length
          ? `<div class="step-actions">${s.actions
              .map((a, j) => `<button type="button" class="step-action" data-step="${i}" data-action="${j}">${escapeHtml(a.label)}</button>`)
              .join('')}</div>`
          : '';
      const show =
        !practice && s.part
          ? `<button type="button" class="step-show" aria-pressed="${isActive}">${isActive ? 'Showing on watch' : 'Show on watch'}</button>`
          : '';
      return `
        <li class="step${isDone ? ' is-done' : ''}${isActive ? ' is-active' : ''}${practice && i === current ? ' is-current' : ''}${
          s.optional ? ' is-optional' : ''
        }" data-index="${i}" data-part="${s.part ?? ''}">
          ${marker}
          <div class="step-body">
            <strong>${escapeHtml(s.title)}${s.optional ? ' <span class="tag">optional</span>' : ''}</strong>
            <p>${detail}</p>
            ${actions}${show}
          </div>
        </li>`;
    })
    .join('');

  const isTicked = (s) => (practice ? s.done : done.has(steps.indexOf(s)));
  // Optional steps only count once they're done.
  const counted = steps.filter((s) => !s.info && (!s.optional || isTicked(s)));
  const doneCount = counted.filter(isTicked).length;

  const notesHtml = notes
    .map((n) => `<div class="note note-${n.type}">${linkTerms(escapeHtml(n.text), seen)}</div>`)
    .join('');

  container.innerHTML = `
    <div class="result">
      ${
        about
          ? `<details class="about"${practice ? '' : ' open'}>
              <summary>What is a ${escapeHtml(name)}?</summary>
              <p>${linkTerms(escapeHtml(about), seen)}</p>
            </details>`
          : ''
      }

      <p class="result-summary">${escapeHtml(summary)}</p>
      <div class="values-grid">${valuesHtml}</div>

      ${allSet ? '<div class="success" role="status">✓ Your watch is set. Nicely done!</div>' : ''}

      <div class="section-head">
        <h3 class="section-heading">${practice ? 'Steps for your watch' : 'How to set it'}</h3>
        <span class="progress">${doneCount}/${counted.length} done</span>
      </div>
      <p class="section-hint">${
        practice
          ? 'Use the buttons, the crown bar under the watch, or tap and drag the crown itself. Steps tick off as your watch matches.'
          : 'Tap a step to see where it is on the watch. Underlined words explain themselves.'
      }</p>
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
