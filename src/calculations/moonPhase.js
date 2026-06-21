const LUNAR_CYCLE = 29.530588853;
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14, 0);

export function getMoonPhase(date) {
  const ms = date.getTime();
  const daysSince = (ms - KNOWN_NEW_MOON) / (1000 * 60 * 60 * 24);
  const phase = ((daysSince % LUNAR_CYCLE) + LUNAR_CYCLE) % LUNAR_CYCLE / LUNAR_CYCLE;
  return phase;
}

export function getMoonIllumination(phase) {
  return Math.round((1 - Math.cos(phase * 2 * Math.PI)) / 2 * 100);
}

export function getMoonPhaseName(phase) {
  const names = [
    { max: 0.03, name: 'New Moon', desc: 'moon disc fully dark (no moon visible)' },
    { max: 0.22, name: 'Waxing Crescent', desc: 'thin crescent on the right side' },
    { max: 0.28, name: 'First Quarter', desc: 'right half illuminated' },
    { max: 0.47, name: 'Waxing Gibbous', desc: 'more than half lit, growing toward full' },
    { max: 0.53, name: 'Full Moon', desc: 'moon disc fully illuminated' },
    { max: 0.72, name: 'Waning Gibbous', desc: 'more than half lit, shrinking from full' },
    { max: 0.78, name: 'Last Quarter', desc: 'left half illuminated' },
    { max: 0.97, name: 'Waning Crescent', desc: 'thin crescent on the left side' },
    { max: 1.0, name: 'New Moon', desc: 'moon disc fully dark (no moon visible)' },
  ];
  return names.find((n) => phase <= n.max) ?? names[0];
}

/** Rotation angle for moon disc (0 = new moon at aperture center) */
export function getMoonDiscRotation(phase) {
  return phase * Math.PI * 2;
}

export function getDaysUntilNextPhase(phase, targetPhase = 0) {
  let diff = targetPhase - phase;
  if (diff <= 0) diff += 1;
  return diff * LUNAR_CYCLE;
}
