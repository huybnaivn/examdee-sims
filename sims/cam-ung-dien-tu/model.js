// Electromagnetic induction: a bar magnet moving along the axis of a coil.
//
// Flux model (documented simplification): the magnet is a point magnetic dipole on the coil's axis.
// The flux of a dipole through a coaxial circular turn of radius a, at distance x from its centre, is
//     Φ(x) = Φ₀ / (1 + (x/a)²)^(3/2)
// where Φ₀ (the "magnet strength" control) is the flux through one turn when the magnet is at the centre.
// All N turns sit at x = 0. Sign convention: the x axis points to the right; flux is positive when the
// field goes through the coil to the right, which is the case when the N pole faces right.
// The induced emf is e = −N·ΔΦ/Δt, computed from the change of Φ over each time step.
// e > 0 means the induced current makes a field to the right inside the coil (right-hand rule about +x).
//
// Units: positions in cm, speeds in cm/s, strength Φ₀ in mWb, flux in Wb, emf in V, time in s.

export const RADIUS = 4; // cm, coil radius a
export const XMAX = 18; // cm, the magnet centre stays inside ±XMAX
export const FAR = 12; // cm, beyond this the magnet counts as "out of the coil" on that side
export const VMAX = 100; // cm/s, the fastest the magnet follows a drag
const TAU = 0.06; // s, lag of the magnet behind the hand, smooths pointer jitter

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** The magnet at rest far to the left, about to start an automatic pass to the right. */
export const restState = () => ({
  x: -XMAX, // cm, where the learner wants the magnet (slider / drag)
  pos: -XMAX, // cm, where the magnet is
  turns: 200, // N
  strength: 1, // mWb, Φ₀
  flipped: false, // false: N pole faces right
  speed: 10, // cm/s for the automatic pass
  auto: true, // the magnet is gliding by itself toward autoTo
  autoTo: XMAX, // cm
  v: 0, // cm/s, current velocity
  emf: 0, // V
  time: 0, // s
  side: -1, // far side the magnet was last on: −1 left, 1 right
  peakEmf: 0, // V, largest |e| since leaving that side
  peakSpeed: 0, // cm/s, largest |v| since leaving that side
  passes: 0, // completed passes through the coil
  lastPeakEmf: 0, // V, of the last completed pass
  lastPeakSpeed: 0, // cm/s, of the last completed pass
});

/** Flux through ONE turn with the magnet at x (cm), in Wb. */
export const flux = (s, x = s.pos) => ((s.flipped ? -1 : 1) * s.strength * 1e-3) / (1 + (x / RADIUS) ** 2) ** 1.5;

/** Largest |e| of a pass at constant speed v (cm/s): N·Φ₀·v·max|dΦ/dx|, the maximum is at x = ±a/2. */
export const peakEmfAt = (s, v = s.speed) => (s.turns * s.strength * 1e-3 * (v / RADIUS) * 1.5) / 1.25 ** 2.5;

/** Start an automatic pass to the other side at constant speed. */
export function launch(s) {
  s.auto = true;
  s.autoTo = s.pos < 0 ? XMAX : -XMAX;
  return s;
}

/** Advance by dt seconds. Mutates and returns the state. */
export function step(s, dt) {
  const old = s.pos;
  if (s.auto) {
    const left = s.autoTo - s.pos;
    s.auto = Math.abs(left) > s.speed * dt;
    s.pos = s.auto ? s.pos + Math.sign(left) * s.speed * dt : s.autoTo;
    s.x = s.pos;
  } else if (Math.abs(s.x - s.pos) < 1e-3) {
    s.pos = s.x;
  } else {
    s.pos += clamp(((s.x - s.pos) * dt) / TAU, -VMAX * dt, VMAX * dt);
  }
  s.v = (s.pos - old) / dt;
  s.emf = (-s.turns * (flux(s, s.pos) - flux(s, old))) / dt + 0; // + 0 turns −0 into 0
  s.time += dt;
  s.peakEmf = Math.max(s.peakEmf, Math.abs(s.emf));
  s.peakSpeed = Math.max(s.peakSpeed, Math.abs(s.v));
  if (Math.abs(s.pos) >= FAR) {
    const here = Math.sign(s.pos);
    if (here !== s.side) {
      s.side = here;
      s.passes += 1;
      s.lastPeakEmf = s.peakEmf;
      s.lastPeakSpeed = s.peakSpeed;
    }
    s.peakEmf = 0;
    s.peakSpeed = 0;
  }
  return s;
}

/**
 * The sim opens part-way through that first pass, with the magnet just past the middle of the coil
 * (x = a/2, where e is largest), so the opening picture already shows an induced current.
 */
export function initialState() {
  const s = restState();
  while (s.pos < RADIUS / 2) step(s, 1 / 120);
  return s;
}

/** −1: flux magnitude through the coil is falling, 1: rising, 0: steady. */
export const fluxTrend = s => Math.sign(-s.emf * (s.flipped ? -1 : 1)) + 0;
