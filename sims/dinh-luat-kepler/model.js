// A planet around the Sun on a Kepler ellipse. Units: AU, year, solar mass, so GM = 4π² AU³/năm².
// The Sun sits at the focus F₁ = origin; perihelion lies on +x, the planet moves counter-clockwise.
// Positions come from Kepler's equation E − e·sin E = M; the tests check them against Newton's law.

export const GM = 4 * Math.PI ** 2;
export const KM_S = 4.74; // 1 AU/năm ≈ 4,74 km/s

export const PRESETS = [
  { value: "custom", label: "Tự chọn", a: 0, e: 0 },
  { value: "mercury", label: "Sao Thủy", a: 0.387, e: 0.206 },
  { value: "venus", label: "Sao Kim", a: 0.723, e: 0.007 },
  { value: "earth", label: "Trái Đất", a: 1, e: 0.017 },
  { value: "mars", label: "Sao Hỏa", a: 1.524, e: 0.093 },
  { value: "jupiter", label: "Sao Mộc", a: 5.203, e: 0.049 },
];

export const initialState = () => ({
  a: 1.5, // AU, semi-major axis
  e: 0.6, // eccentricity
  sweep: 10, // % of the period, the time span of each shaded sector
  preset: "custom",
  showSectors: true,
  showSpeeds: true,
  showChart: true,
  t: 0.12, // năm since perihelion
  planets: [], // [{ a: AU, e }] orbits added to the T²–a³ chart
});

export const period = a => Math.sqrt(a ** 3 * (4 * Math.PI ** 2) / GM); // T² = 4π²a³/GM
export const focusDistance = (a, e) => a * e; // c
export const semiMinor = (a, e) => a * Math.sqrt(1 - e * e);
export const perihelion = (a, e) => a * (1 - e);
export const aphelion = (a, e) => a * (1 + e);
/** Vis-viva: v² = GM(2/r − 1/a). */
export const speedAt = (a, r) => Math.sqrt(GM * (2 / r - 1 / a));

/** Position and velocity t years after perihelion. */
export function position(a, e, t) {
  const n = (2 * Math.PI) / period(a);
  const M = n * t;
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < 50; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-13) break;
  }
  const b = semiMinor(a, e);
  const Edot = n / (1 - e * Math.cos(E));
  return { x: a * (Math.cos(E) - e), y: b * Math.sin(E), vx: -a * Math.sin(E) * Edot, vy: b * Math.cos(E) * Edot };
}

/** Area swept by the Sun–planet line between t1 and t2, summed as thin triangles from the focus. */
export function sweptArea(a, e, t1, t2, n = 400) {
  let area = 0;
  let p = position(a, e, t1);
  for (let i = 1; i <= n; i++) {
    const q = position(a, e, t1 + ((t2 - t1) * i) / n);
    area += 0.5 * Math.abs(p.x * q.y - q.x * p.y);
    p = q;
  }
  return area;
}

/** The two sectors swept in the same time Δt, centred on perihelion and on aphelion. */
export function sectors(s) {
  const T = period(s.a);
  const dt = (s.sweep / 100) * T;
  return {
    dt,
    near: sweptArea(s.a, s.e, -dt / 2, dt / 2),
    far: sweptArea(s.a, s.e, T / 2 - dt / 2, T / 2 + dt / 2),
  };
}

/** One chart point per semi-major axis. */
export function addPlanet(s) {
  s.planets = [...s.planets.filter(p => Math.abs(p.a - s.a) > 0.005), { a: s.a, e: s.e }].sort((p, q) => p.a - q.a).slice(-10);
  return s;
}

/** Advance the planet: one orbit takes 8 s on screen whatever its period. */
export function step(s, dt) {
  const T = period(s.a);
  s.t = (((s.t + (dt * T) / 8) % T) + T) % T;
  return s;
}

export const sanitizePlanets = list =>
  Array.isArray(list)
    ? list
        .filter(p => p && Number.isFinite(p.a) && Number.isFinite(p.e) && p.a >= 0.1 && p.a <= 10 && p.e >= 0 && p.e < 1)
        .slice(0, 10)
        .map(p => ({ a: p.a, e: p.e }))
    : [];
