// Day, night and the seasons. Angles in degrees, day of year 1..365 (non-leap year, 1 = 1 January).
//
// Declination of the Sun (simple textbook formula, error about 1–2 days / under 2°):
//   δ = −23,44° · cos(360° · (N + 10) / 365)
// Day length (geometric sunrise/sunset, no refraction): cos H₀ = −tan φ · tan δ, day = 2·H₀ / 15° per hour.
// Noon altitude of the Sun: h = 90° − |φ − δ|.

export const TILT = 23.44; // °, tilt of the Earth's axis
export const YEAR = 365;
export const POLAR_CIRCLE = 90 - TILT; // 66,56°
export const DAYS_PER_SECOND = 30; // playback speed
const RAD = Math.PI / 180;

export const initialState = () => ({
  day: 172, // day of the year, may be fractional while playing
  latitude: 21.03, // ° north (Hà Nội)
});

/** Angle of the Earth on its orbit (rad). The axis tilts towards +x, so at angle 2π (Đông chí) it leans away from the Sun. */
export const orbitAngle = day => (2 * Math.PI * (day + 10)) / YEAR;

export const declination = day => -TILT * Math.cos(orbitAngle(day));

/** Component of the north-pole direction pointing at the Sun: > 0 when the North Pole leans towards the Sun. */
export const northTowardSun = day => -Math.cos(orbitAngle(day)) * Math.sin(TILT * RAD);

/** Hours of daylight at latitude φ when the declination is δ. */
export function dayLength(lat, dec) {
  const num = Math.sin(lat * RAD) * Math.sin(dec * RAD);
  const den = Math.cos(lat * RAD) * Math.cos(dec * RAD);
  if (Math.abs(den) < 1e-12) return num > 1e-12 ? 24 : num < -1e-12 ? 0 : 12; // at a pole
  const cosH = -num / den;
  if (cosH <= -1) return 24; // polar day
  if (cosH >= 1) return 0; // polar night
  return (2 * Math.acos(cosH)) / RAD / 15;
}

/** Altitude of the Sun at local noon (°); negative means it does not rise. */
export const noonAltitude = (lat, dec) => 90 - Math.abs(lat - dec);

/** Keep the day inside [1, 366). The kit does not clamp it while playing or dragging. */
export const wrapDay = day => {
  if (!Number.isFinite(day)) return 1;
  return ((((day - 1) % YEAR) + YEAR) % YEAR) + 1;
};

export function step(s, dt) {
  s.day = wrapDay(s.day + DAYS_PER_SECOND * dt);
  return s;
}

/** Solstices and equinoxes of this model (δ = 0 or ±23,44°). */
export const SEASONS = [
  { name: "Xuân phân", day: YEAR / 4 - 10 },
  { name: "Hạ chí", day: YEAR / 2 - 10 },
  { name: "Thu phân", day: (3 * YEAR) / 4 - 10 },
  { name: "Đông chí", day: YEAR - 10 },
];

const MONTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
/** "21/6" for day 172. */
export function dateLabel(day) {
  let d = Math.floor(wrapDay(day));
  let m = 0;
  while (d > MONTHS[m]) d -= MONTHS[m++];
  return `${d}/${m + 1}`;
}
