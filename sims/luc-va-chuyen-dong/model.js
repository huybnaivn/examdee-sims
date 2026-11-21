// A block on a horizontal surface pushed by a horizontal force. x and forces are positive to the right.

export const G = 9.81; // m/s^2

export const initialState = () => ({
  force: 30, // N, applied force
  mass: 5, // kg
  muS: 0.4, // coefficient of static friction
  muK: 0.3, // coefficient of kinetic friction (never above muS)
  x: 0, // m
  v: 0, // m/s
  time: 0, // s
});

/** Forces on the block right now. `sliding` is false only while static friction holds it. */
export function forces(s) {
  const normal = s.mass * G;
  const maxStatic = s.muS * normal;
  const kinetic = Math.min(s.muK, s.muS) * normal;
  const holds = s.v === 0 && Math.abs(s.force) <= maxStatic;
  // Static friction cancels the applied force; kinetic friction opposes the motion
  // (or, starting from rest, the direction the block is about to move).
  const friction = holds ? 0 - s.force : -Math.sign(s.v || s.force) * kinetic;
  const net = s.force + friction;
  return { normal, maxStatic, friction, net, accel: net / s.mass, sliding: !holds };
}

/** Advance by dt. Forces are constant during a step, so the step is exact; the block stops dead at v = 0. */
export function step(s, dt) {
  const a = forces(s).accel;
  const v = s.v + a * dt;
  if (s.v !== 0 && s.v * v <= 0) {
    s.x += (s.v * (-s.v / a)) / 2; // distance covered until friction brings it to rest
    s.v = 0;
  } else {
    s.x += s.v * dt + (a * dt * dt) / 2;
    s.v = v;
  }
  s.time += dt;
  return s;
}

/** Back to the start line at rest, keeping the chosen parameters. */
export function restart(s) {
  s.x = 0;
  s.v = 0;
  s.time = 0;
  return s;
}
