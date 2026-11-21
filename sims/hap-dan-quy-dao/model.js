// A planet orbiting a fixed star under Newtonian gravity.
// Scaled units: distance in astronomical units (AU), time in years, mass in solar masses (M☉).
// In these units G = 4π² AU³/(M☉·year²), so a planet 1 AU from a 1 M☉ star has a 1-year orbit.
// The planet's own mass cancels out of its motion, so energy and angular momentum are per unit mass.

export const G = 4 * Math.PI ** 2;
export const KM_S = 4.74047; // 1 AU/year in km/s
export const MM_S2 = 0.150198; // 1 AU/year² in mm/s²
export const STAR_RADIUS = 0.08; // AU; the planet is lost if it comes closer than this
export const ELLIPSE_FACTOR = 0.8; // "ellipse" preset: this fraction of the circular speed
// ponytail: fixed substeps keep the integrator symplectic (1/15360 year each). Energy error
// stays bounded, about 0,1 % at the closest allowed pass of the heaviest star; switch to a
// time-transformed leapfrog if near-collision passes ever need to look exact.
const SUBSTEPS = 128;

/** Speed of a circular orbit of radius r around a star of the given mass: √(G·M/r). */
export const circularSpeed = (starMass, r) => Math.sqrt((G * starMass) / r);

/** Place the planet at the initial distance, moving at right angles to the star direction. */
export function launch(s) {
  s.x = s.distance;
  s.y = 0;
  s.vx = 0;
  s.vy = s.speed;
  s.time = 0;
  s.orbits = 0;
  s.measuredPeriod = 0;
  s.lastCross = 0;
  s.crashed = false;
  return s;
}

export function initialState() {
  const s = launch({
    starMass: 1, // M☉
    distance: 1, // AU, initial
    speed: ELLIPSE_FACTOR * circularSpeed(1, 1), // AU/year, initial
    x: 0, // AU, star at the origin
    y: 0,
    vx: 0, // AU/year
    vy: 0,
    time: 0, // years since launch
    orbits: 0, // completed revolutions
    measuredPeriod: 0, // years, 0 until one revolution is done
    lastCross: 0, // time the planet last crossed the launch direction
    crashed: false,
    showVectors: true,
    showPredicted: true,
  });
  // Start a little way round so the velocity and force are visibly not at right angles.
  for (let i = 0; i < 18; i++) step(s, 1 / 120);
  return s;
}

/** Advance by dt years with velocity Verlet (kick-drift-kick), which is symplectic. */
export function step(s, dt) {
  if (s.crashed) return s;
  const mu = G * s.starMass;
  const h = dt / SUBSTEPS;
  let { x, y, vx, vy } = s;
  let k = -mu / Math.hypot(x, y) ** 3;
  for (let i = 0; i < SUBSTEPS; i++) {
    vx += (h / 2) * k * x;
    vy += (h / 2) * k * y;
    const y0 = y;
    x += h * vx;
    y += h * vy;
    const r = Math.hypot(x, y);
    k = -mu / r ** 3;
    vx += (h / 2) * k * x;
    vy += (h / 2) * k * y;
    s.time += h;
    if (y0 < 0 && y >= 0) {
      const t = s.time - (h * y) / (y - y0);
      s.measuredPeriod = t - s.lastCross;
      s.lastCross = t;
      s.orbits += 1;
    }
    if (r < STAR_RADIUS) {
      s.crashed = true;
      break;
    }
  }
  Object.assign(s, { x, y, vx, vy });
  return s;
}

/** Orbit computed from the current position and velocity (the two-body solution). */
export function elements(s) {
  const mu = G * s.starMass;
  const r = Math.hypot(s.x, s.y);
  const v2 = s.vx * s.vx + s.vy * s.vy;
  const energy = v2 / 2 - mu / r; // per unit mass, AU²/year²
  const momentum = s.x * s.vy - s.y * s.vx; // per unit mass, AU²/year
  const rv = s.x * s.vx + s.y * s.vy;
  const ex = ((v2 - mu / r) * s.x - rv * s.vx) / mu;
  const ey = ((v2 - mu / r) * s.y - rv * s.vy) / mu;
  const ecc = Math.hypot(ex, ey);
  const p = (momentum * momentum) / mu; // semi-latus rectum
  const bound = energy < 0;
  const a = bound ? -mu / (2 * energy) : Infinity; // semi-major axis
  return {
    r,
    speed: Math.sqrt(v2),
    energy,
    momentum,
    ecc,
    omega: Math.atan2(ey, ex), // direction of closest approach
    p,
    bound,
    a,
    peri: bound ? a * (1 - ecc) : p / (1 + ecc),
    apo: bound ? a * (1 + ecc) : Infinity,
    period: bound ? 2 * Math.PI * Math.sqrt(a ** 3 / mu) : Infinity, // Kepler's third law
  };
}
