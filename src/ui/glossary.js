/** Short definitions for watch jargon, shown inline when a term is tapped. */
export const GLOSSARY = {
  crown: 'The knob on the side of the case. Turn it to wind or set the watch; pull it out in "clicks" to change what it adjusts.',
  'quick-set': 'A crown position (usually one click out) that jumps the date forward without moving the hands through 24 hours.',
  corrector: 'A tiny recessed button on the side of the case. Press it gently with a wooden or plastic stylus — never a metal pin.',
  pushers: 'Buttons on the side of the case, like on a chronograph, used to adjust a function.',
  aperture: 'The small cut-out window in the dial where a display — like the moon disc — shows through.',
  subdial: 'A smaller dial set inside the main dial, with its own hand.',
  'moon disc': 'A rotating disc painted with two moons. It turns one notch a day, so the moon appears to grow and shrink in the aperture.',
  'date window': 'The little window in the dial that shows the day of the month.',
  'leap year': 'A year with a February 29th — every 4 years, except century years not divisible by 400 (2100 is not a leap year).',
  'lunar age': 'Days since the last new moon. A full lunar cycle is about 29.5 days.',
};

const TERMS = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
const TERM_RE = new RegExp(`\\b(${TERMS.map((t) => t.replace(/[-]/g, '\\-')).join('|')})\\b`, 'gi');

/**
 * Wrap the first mention of each glossary term in already-escaped HTML with a
 * tappable button. Terms are plain words, so this is safe on escaped text.
 */
export function linkTerms(escapedHtml, seen = new Set()) {
  return escapedHtml.replace(TERM_RE, (match) => {
    const key = match.toLowerCase();
    if (seen.has(key)) return match;
    seen.add(key);
    return `<button type="button" class="term" data-term="${key}" aria-expanded="false">${match}</button>`;
  });
}

/** Toggle an inline definition beneath the text block containing the term. */
export function handleTermClick(button) {
  const host = button.closest('.step-body, .note, .about');
  if (!host) return;

  const existing = host.querySelector('.term-def');
  const wasOpenForThis = existing?.dataset.term === button.dataset.term;
  existing?.remove();
  host.querySelectorAll('.term[aria-expanded="true"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  if (wasOpenForThis) return;

  const def = document.createElement('p');
  def.className = 'term-def';
  def.dataset.term = button.dataset.term;
  def.innerHTML = `<strong>${button.textContent}</strong> — ${GLOSSARY[button.dataset.term]}`;
  host.appendChild(def);
  button.setAttribute('aria-expanded', 'true');
}
