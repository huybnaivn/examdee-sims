// Collision model of the reaction A + B → AB: hard discs in a 2-D box.
//
// An A–B collision reacts when the kinetic energy of the relative motion along the line of
// centres is at least the activation energy Ea. For a gas in thermal equilibrium this makes the
// fraction of effective collisions exp(−Ea / RT), the Arrhenius factor.
//
// Illustrative scales: about a hundred particles and an Ea of a few kJ/mol, far smaller than for real
// reactions, so that the reaction is visible within seconds. The temperature is held constant by
// the surroundings: a particle leaves a wall, and a new AB particle starts, with a thermal velocity,
// and all speeds are rescaled so that the mean kinetic energy per particle stays RT (two dimensions).
// Without this the gas would cool, because every reaction removes a fast pair.

export const R = 8.314e-3; // kJ/(mol·K)
export const EA = 5; // kJ/mol, without catalyst
export const EA_CATALYST = 2.5; // kJ/mol, with catalyst
export const BOX = { w: 100, h: 60 }; // length units
export const RADIUS = [1.3, 1.3, 1.8]; // A, B, AB
export const MASS = [1, 1, 2]; // in units of the mass of A
export const PER_MOLAR = 80; // particles in the box per mol/L
export const LIMITS = { temperature: [250, 600], conc: [0.2, 1] };
export const RATE_FRACTION = 0.25; // the initial rate is averaged until this fraction has reacted
const T0 = 300; // K
const V0 = 10; // length units per second: thermal speed (per axis) of A at T0
const ENERGY = (R * T0) / (V0 * V0); // kJ/mol per (mass unit · speed²)
const MAX_PARTICLES = Math.round(LIMITS.conc[1] * PER_MOLAR);

const A = 0;
const B = 1;
const AB = 2;

export function initialState() {
  return restart({
    temperature: 400, // K
    concA: 0.8, // mol/L at t = 0
    concB: 0.4,
    catalyst: false,
    speed: 1, // playback speed: 1, 4 or 16 times
    seed: 1, // seed of the random generator for this run
    rng: 1, // current state of the generator (uint32)
    time: 0, // s
    nA: 0, // particles now
    nB: 0,
    nAB: 0,
    collisions: 0, // A–B collisions so far
    effective: 0, // of which reacted
    halfTime: 0, // s, when half of the limiting reactant had reacted; 0 = not yet
    endTime: 0, // s, when a reactant ran out; 0 = not yet
    initialRate: 0, // mol/(L·s), 0 = not measured yet
  });
}

/** Start the run again from t = 0 with the current settings and seed. */
export function restart(s) {
  s.rng = s.seed >>> 0;
  s.time = 0;
  s.nA = Math.round(s.concA * PER_MOLAR);
  s.nB = Math.round(s.concB * PER_MOLAR);
  s.nAB = 0;
  s.collisions = s.effective = 0;
  s.halfTime = s.endTime = s.initialRate = 0;
  delete s._p;
  delete s._hist;
  delete s._flash;
  return s;
}

/**
 * State coming from the host: keep known keys of the right type. If it does not describe a run in
 * progress that fits its own settings (for example only the settings were given), start at t = 0.
 */
export function sanitize(incoming, base) {
  const s = { ...base };
  for (const key of Object.keys(base)) {
    const v = incoming[key];
    if (typeof v === typeof base[key] && (typeof v !== "number" || Number.isFinite(v))) s[key] = v;
  }
  const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));
  s.temperature = clamp(s.temperature, LIMITS.temperature);
  s.concA = clamp(s.concA, LIMITS.conc);
  s.concB = clamp(s.concB, LIMITS.conc);
  const whole = [s.nA, s.nB, s.nAB].every(n => Number.isInteger(n) && n >= 0);
  const fits = whole && s.nA + s.nAB === Math.round(s.concA * PER_MOLAR) && s.nB + s.nAB === Math.round(s.concB * PER_MOLAR);
  return fits && s.time >= 0 ? s : restart(s);
}

// mulberry32, with its state kept in s.rng so that a saved run continues the same sequence
export function random(s) {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const gauss = s => Math.sqrt(-2 * Math.log(1 - random(s))) * Math.cos(2 * Math.PI * random(s));

export const activationEnergy = s => (s.catalyst ? EA_CATALYST : EA);
/** Arrhenius factor: the expected fraction of A–B collisions that react. */
export const effectiveFraction = s => Math.exp(-activationEnergy(s) / (R * s.temperature));
/** Thermal speed along one axis for a particle of the given mass: √(RT/M) in model units. */
export const thermalSpeed = (temperature, mass = 1) => V0 * Math.sqrt(temperature / T0 / mass);
/** Energy (kJ/mol) of two particles approaching at relative speed vn along the line of centres. */
export const collisionEnergy = (vn, m1 = 1, m2 = 1) => 0.5 * ((m1 * m2) / (m1 + m2)) * vn * vn * ENERGY;
/**
 * Kinetic theory for dilute discs in two dimensions: expected A–B collisions per second.
 * Each pair sweeps a strip 2(rA + rB) wide at the mean relative speed σ√π.
 */
export const collisionRate = s =>
  (s.nA * s.nB * 2 * (RADIUS[A] + RADIUS[B]) * thermalSpeed(s.temperature) * Math.sqrt(Math.PI)) / (BOX.w * BOX.h);
export const concentration = count => count / PER_MOLAR; // mol/L

/**
 * Expected number of AB particles at time t (the average over many runs), from the rate law
 * dx/dt = k·(a₀ − x)·(b₀ − x) with k = effective fraction × collision rate per A–B pair.
 */
export function predictedProduct(s, t) {
  const hi = Math.max(s.nA, s.nB) + s.nAB; // counts at t = 0: what is left now plus what has reacted
  const lo = Math.min(s.nA, s.nB) + s.nAB;
  const k = effectiveFraction(s) * collisionRate({ ...s, nA: 1, nB: 1 });
  if (hi - lo < 1e-9) return (lo * lo * k * t) / (1 + lo * k * t);
  const e = Math.exp(-(hi - lo) * k * t);
  return (hi * lo * (1 - e)) / (hi - lo * e);
}
export const finished = s => Math.min(s.nA, s.nB) <= 0;

function thermalise(s, p) {
  const sigma = thermalSpeed(s.temperature, MASS[p.k]);
  p.vx = sigma * gauss(s);
  p.vy = sigma * gauss(s);
}

/** Build the transient particle list s._p from the counts, if it is missing. */
export function ensure(s) {
  if (s._p) return s._p;
  const p = (s._p = []);
  for (const [k, key] of [[A, "nA"], [B, "nB"], [AB, "nAB"]]) {
    s[key] = Math.min(MAX_PARTICLES, Math.max(0, Math.round(Number(s[key]) || 0))); // state may come from outside
    for (let i = 0; i < s[key]; i++) {
      const q = { k, x: 0, y: 0, vx: 0, vy: 0 };
      const r = RADIUS[k];
      for (let tries = 0; tries < 60; tries++) {
        q.x = r + random(s) * (BOX.w - 2 * r);
        q.y = r + random(s) * (BOX.h - 2 * r);
        if (!p.some(o => Math.hypot(o.x - q.x, o.y - q.y) < r + RADIUS[o.k])) break;
      }
      thermalise(s, q);
      p.push(q);
    }
  }
  s._hist = [[s.time, s.nA, s.nB, s.nAB]];
  s._flash = [];
  return p;
}

/** Elastic collision of two discs approaching each other. Conserves momentum and kinetic energy. */
export function bounce(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 1;
  const nx = dx / d;
  const ny = dy / d;
  const j = (2 * ((b.vx - a.vx) * nx + (b.vy - a.vy) * ny)) / (1 / MASS[a.k] + 1 / MASS[b.k]);
  a.vx += (j / MASS[a.k]) * nx;
  a.vy += (j / MASS[a.k]) * ny;
  b.vx -= (j / MASS[b.k]) * nx;
  b.vy -= (j / MASS[b.k]) * ny;
}

function react(s, a, b) {
  s.effective++;
  s.nA--;
  s.nB--;
  s.nAB++;
  a.x = (a.x + b.x) / 2;
  a.y = (a.y + b.y) / 2;
  a.k = AB;
  thermalise(s, a);
  b.dead = true;
  s._flash.push({ x: a.x, y: a.y, t: s.time });
  s._hist.push([s.time, s.nA, s.nB, s.nAB]);
  const start = s.nAB + Math.min(s.nA, s.nB); // limiting reactant at t = 0
  if (!s.initialRate && s.nAB >= RATE_FRACTION * start && s.time > 0) s.initialRate = concentration(s.nAB) / s.time;
  if (!s.halfTime && 2 * s.nAB >= start) s.halfTime = s.time;
  if (!s.endTime && finished(s)) s.endTime = s.time;
}

/** Advance by dt seconds. The clock stops once a reactant has run out; particles keep moving. */
export function step(s, dt) {
  const p = ensure(s);
  const done = finished(s);
  if (!done) s.time += dt;
  for (const q of p) {
    const r = RADIUS[q.k];
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    // Thermal walls (the thermostat): the particle comes off the wall with a fresh velocity at T.
    const sx = q.x < r ? 1 : q.x > BOX.w - r ? -1 : 0;
    const sy = q.y < r ? 1 : q.y > BOX.h - r ? -1 : 0;
    if (sx || sy) {
      const sigma = thermalSpeed(s.temperature, MASS[q.k]);
      const away = () => sigma * Math.sqrt(-2 * Math.log(1 - random(s))); // speed of particles crossing a plane
      q.vx = sx ? sx * away() : sigma * gauss(s);
      q.vy = sy ? sy * away() : sigma * gauss(s);
      q.x = Math.min(BOX.w - r, Math.max(r, q.x));
      q.y = Math.min(BOX.h - r, Math.max(r, q.y));
    }
  }
  // ponytail: all-pairs scan, fine for ≤ 160 particles; use a grid if the box ever holds many more
  let removed = false;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    if (a.dead) continue;
    for (let j = i + 1; j < p.length; j++) {
      const b = p[j];
      if (b.dead) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const reach = RADIUS[a.k] + RADIUS[b.k];
      const d2 = dx * dx + dy * dy;
      if (d2 >= reach * reach) continue;
      const d = Math.sqrt(d2) || 1;
      const vn = -((b.vx - a.vx) * dx + (b.vy - a.vy) * dy) / d; // closing speed
      if (vn <= 0) continue; // already moving apart
      if (a.k + b.k === A + B && a.k !== b.k) {
        s.collisions++;
        if (collisionEnergy(vn) >= activationEnergy(s)) {
          react(s, a, b);
          removed = true;
          continue;
        }
      }
      bounce(a, b);
    }
  }
  if (removed) s._p = p.filter(q => !q.dead);
  // thermostat: ½m<v²> = RT per particle, i.e. thermalSpeed(T)² in model units
  let kinetic = 0;
  for (const q of s._p) kinetic += 0.5 * MASS[q.k] * (q.vx * q.vx + q.vy * q.vy);
  if (kinetic > 0) {
    const f = Math.sqrt((s._p.length * thermalSpeed(s.temperature) ** 2) / kinetic);
    for (const q of s._p) (q.vx *= f), (q.vy *= f);
  }
  if (s._flash.length && s.time - s._flash[0].t > 0.5) s._flash.shift();
  return s;
}
