export function renderInstructions(container, result) {
  const { title, summary, values, steps, notes } = result;

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
    .map(
      (s, i) => `
        <li class="step">
          <span class="step-num">${i + 1}</span>
          <div class="step-body">
            <strong>${escapeHtml(s.title)}</strong>
            <p>${escapeHtml(s.detail)}</p>
          </div>
        </li>`,
    )
    .join('');

  const notesHtml = notes
    .map(
      (n) => `<div class="note note-${n.type}">${escapeHtml(n.text)}</div>`,
    )
    .join('');

  container.innerHTML = `
    <div class="result">
      <h2 class="result-title">${escapeHtml(title)}</h2>
      <p class="result-summary">${escapeHtml(summary)}</p>

      <div class="values-grid">${valuesHtml}</div>

      <h3 class="section-heading">How to adjust</h3>
      <ol class="steps">${stepsHtml}</ol>

      <h3 class="section-heading">Notes</h3>
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
    hour12: false,
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
