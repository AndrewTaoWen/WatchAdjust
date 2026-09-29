export const LUNAR_CYCLE = 29.530588853;

const DEG = Math.PI / 180;

/**
 * Moon phase as a fraction of the lunar cycle (0 = new, 0.5 = full).
 *
 * Uses the Sun–Moon elongation with the largest periodic terms from Meeus,
 * "Astronomical Algorithms" (ch. 48). The mean-cycle shortcut drifts by up to
 * ~14 hours because the Moon's orbit is elliptical; this stays within about
 * an hour of the true phase.
 */
export function getMoonPhase(date) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const T = (jd - 2451545) / 36525;

  const D = 297.8501921 + 445267.1114034 * T; // mean elongation
  const M = 357.5291092 + 35999.0502909 * T; // Sun's mean anomaly
  const Mp = 134.9633964 + 477198.8675055 * T; // Moon's mean anomaly

  // Phase angle i (0° = full moon)
  const i =
    180 -
    D -
    6.289 * Math.sin(Mp * DEG) +
    2.1 * Math.sin(M * DEG) -
    1.274 * Math.sin((2 * D - Mp) * DEG) -
    0.658 * Math.sin(2 * D * DEG) -
    0.214 * Math.sin(2 * Mp * DEG) -
    0.11 * Math.sin(D * DEG);

  const elongation = (((180 - i) % 360) + 360) % 360;
  return elongation / 360;
}

/** Days since new moon, as a watch's moon disc counts them. */
export function getMoonAge(date) {
  return getMoonPhase(date) * LUNAR_CYCLE;
}

export function getMoonIllumination(phase) {
  return Math.round(((1 - Math.cos(phase * 2 * Math.PI)) / 2) * 100);
}

const PHASES = [
  { max: 0.03, name: 'New Moon', lit: 'none' },
  { max: 0.22, name: 'Waxing Crescent', lit: 'crescent-waxing' },
  { max: 0.28, name: 'First Quarter', lit: 'half-waxing' },
  { max: 0.47, name: 'Waxing Gibbous', lit: 'gibbous-waxing' },
  { max: 0.53, name: 'Full Moon', lit: 'full' },
  { max: 0.72, name: 'Waning Gibbous', lit: 'gibbous-waning' },
  { max: 0.78, name: 'Last Quarter', lit: 'half-waning' },
  { max: 0.97, name: 'Waning Crescent', lit: 'crescent-waning' },
  { max: 1.0, name: 'New Moon', lit: 'none' },
];

/**
 * Name and a plain description of the phase. In the Southern Hemisphere the
 * moon appears flipped, so the lit side swaps.
 */
export function getMoonPhaseName(phase, southern = false) {
  const entry = PHASES.find((n) => phase <= n.max) ?? PHASES[0];
  const waxingSide = southern ? 'left' : 'right';
  const waningSide = southern ? 'right' : 'left';
  const desc = {
    none: 'moon disc fully dark (no moon visible)',
    'crescent-waxing': `thin crescent on the ${waxingSide} side`,
    'half-waxing': `${waxingSide} half lit`,
    'gibbous-waxing': 'more than half lit, growing toward full',
    full: 'moon disc fully lit',
    'gibbous-waning': 'more than half lit, shrinking from full',
    'half-waning': `${waningSide} half lit`,
    'crescent-waning': `thin crescent on the ${waningSide} side`,
  }[entry.lit];
  return { name: entry.name, desc };
}

/** Representative moon ages (days) for each named phase — used by the "my watch shows" picker. */
export const PHASE_AGES = [
  { name: 'New Moon', age: 0 },
  { name: 'Waxing Crescent', age: 3.7 },
  { name: 'First Quarter', age: 7.4 },
  { name: 'Waxing Gibbous', age: 11.1 },
  { name: 'Full Moon', age: 14.8 },
  { name: 'Waning Gibbous', age: 18.5 },
  { name: 'Last Quarter', age: 22.1 },
  { name: 'Waning Crescent', age: 25.8 },
];

export function getDaysUntilNextPhase(phase, targetPhase = 0) {
  let diff = targetPhase - phase;
  if (diff <= 0) diff += 1;
  return diff * LUNAR_CYCLE;
}

/**
 * Best guess at the hemisphere from a time zone name, used until the user
 * shares a location or picks one explicitly.
 */
export function isSouthernTimezone(tz = '') {
  return (
    /^(Australia|Antarctica)\//.test(tz) ||
    /^Pacific\/(Auckland|Chatham|Fiji|Tongatapu|Apia|Efate|Noumea|Norfolk|Rarotonga|Tahiti)/.test(tz) ||
    /^America\/(Argentina|Santiago|Sao_Paulo|Montevideo|Asuncion|Lima|La_Paz|Punta_Arenas|Buenos_Aires|Cordoba|Mendoza|Recife|Bahia|Fortaleza|Maceio|Belem|Cuiaba|Campo_Grande|Porto_Velho|Rio_Branco|Manaus)/.test(tz) ||
    /^Africa\/(Johannesburg|Maputo|Harare|Lusaka|Windhoek|Gaborone|Maseru|Mbabane|Blantyre|Lubumbashi|Luanda|Dar_es_Salaam|Kigali|Bujumbura)/.test(tz) ||
    /^Indian\/(Antananarivo|Mauritius|Reunion|Mayotte|Comoro)/.test(tz)
  );
}
