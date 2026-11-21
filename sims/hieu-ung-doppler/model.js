// A sound source S and a listener (người nghe) N move at constant velocities along the x axis
// (metres, m/s, positive to the right) in still air. Pure model.
//
// Sign convention for the Doppler formula f′ = f·(v + v_N)/(v − v_S):
//   v_N > 0 when the listener moves towards the source, v_S > 0 when the source moves towards
//   the listener; both are negative when moving away. These are components along the line SN.

export const SOUND = 340; // m/s, speed of sound in air
export const EMIT = 0.05; // s between the wavefronts that are drawn (far fewer than one per period)
export const WORLD = 200; // m, the scene spans −WORLD … WORLD
export const START = 150; // m, the source starts this far from the centre, on the side it comes from
const MAX_AGE = (3 * WORLD) / SOUND; // s, older fronts are off screen

export const initialState = () =>
  restart({
    frequency: 500, // Hz
    sourceVelocity: 100, // m/s, positive to the right
    listenerVelocity: 0, // m/s, positive to the right
    sourceX: 0,
    listenerX: 0,
    time: 0, // s
  });

/** Listener to the centre, source START away on the side from which the two close in. */
export function restart(s) {
  s.sourceX = s.sourceVelocity - s.listenerVelocity < 0 ? START : -START;
  s.listenerX = 0;
  s.time = 0;
  return s;
}

/** +1 if the listener is to the right of the source, −1 if to the left (0 counts as right). */
export const side = s => (s.listenerX >= s.sourceX ? 1 : -1);

/** Velocity components towards each other along the line, for the given side (see convention above). */
export const approachSpeeds = (s, dir = side(s)) => ({
  source: s.sourceVelocity * dir,
  listener: -s.listenerVelocity * dir,
});

/**
 * Frequency heard, f′ = f·(v + v_N)/(v − v_S). Returns 0 when no sound from the source can reach
 * the listener on this side: the source outruns its own sound (v_S ≥ v), or the listener does.
 */
export function heardFrequency(s, dir = side(s)) {
  const { source, listener } = approachSpeeds(s, dir);
  if (SOUND - source <= 0 || SOUND + listener <= 0) return 0;
  return (s.frequency * (SOUND + listener)) / (SOUND - source);
}

/** Mach number |v_S|/v, and the half-angle θ of the shock cone, sin θ = v/v_S (null below Mach 1). */
export const mach = s => Math.abs(s.sourceVelocity) / SOUND;
export const machAngle = s => (mach(s) > 1 ? Math.asin(1 / mach(s)) : null);

/**
 * Wavefronts on screen: circles emitted at the times k·EMIT, each centred where the source was when
 * it was emitted (on the source's path, y = 0), radius v·age. The motion is taken to have started
 * long ago, so the picture is already steady.
 */
export function fronts(s) {
  const list = [];
  const phase = ((s.time % EMIT) + EMIT) % EMIT;
  for (let age = phase; age < MAX_AGE; age += EMIT) {
    list.push({ x: s.sourceX - s.sourceVelocity * age, y: 0, r: SOUND * age, age });
  }
  return list;
}

/** Advance dt seconds. Returns true when the source has just passed the listener. */
export function step(s, dt) {
  const before = side(s);
  s.sourceX += s.sourceVelocity * dt;
  s.listenerX += s.listenerVelocity * dt;
  s.time += dt;
  return side(s) !== before;
}

/** True once the source or the listener has left the scene. */
export const outside = s => Math.abs(s.sourceX) > WORLD + 20 || Math.abs(s.listenerX) > WORLD;
