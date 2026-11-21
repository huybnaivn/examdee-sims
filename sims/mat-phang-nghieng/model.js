// A block on an incline. `pos` is the distance slid along the slope from the start, positive downhill.

const rad = deg => (deg * Math.PI) / 180;

export const initialState = () => ({
  angle: 30, // degrees, incline angle α
  mass: 5, // kg
  muS: 0.4, // coefficient of static friction
  muK: 0.3, // coefficient of kinetic friction (never above muS)
  gravity: 9.81, // m/s^2
  length: 2, // m, distance from the start to the bottom of the slope
  pos: 0, // m
  v: 0, // m/s, down the slope
  time: 0, // s since release
  released: false,
  done: false, // the run is over: at the bottom, or it never moved
  showComponents: true,
});

/** Forces on the block right now (magnitudes; friction points up the slope). */
export function forces(s) {
  const a = rad(s.angle);
  const weight = s.mass * s.gravity;
  const along = weight * Math.sin(a); // Px
  const normal = weight * Math.cos(a); // N = Py
  const muK = Math.min(s.muK, s.muS);
  const sliding = s.v > 0 || Math.tan(a) > s.muS;
  return {
    weight,
    along,
    normal,
    maxStatic: s.muS * normal,
    friction: sliding ? muK * normal : along, // static friction balances Px
    accel: sliding ? s.gravity * (Math.sin(a) - muK * Math.cos(a)) : 0,
    sliding,
  };
}

/** Time and speed at the bottom when released from rest, or null if the block does not slide. */
export function theory(s) {
  const f = forces({ ...s, v: 0 });
  if (!f.sliding) return null;
  return { accel: f.accel, time: Math.sqrt((2 * s.length) / f.accel), speed: Math.sqrt(2 * f.accel * s.length) };
}

/** Put the block back at the start, not yet released. */
export function restart(s) {
  s.pos = 0;
  s.v = 0;
  s.time = 0;
  s.released = false;
  s.done = false;
  return s;
}

export function release(s) {
  restart(s).released = true;
  return s;
}

/** Advance by dt. Acceleration is constant, so each step (and the arrival at the bottom) is exact. */
export function step(s, dt) {
  if (!s.released || s.done) return s;
  // pos and v have no control, so a forged state is clamped here
  s.pos = Math.min(Math.max(s.pos, 0), s.length);
  s.v = Math.max(s.v, 0);
  const f = forces(s);
  const a = f.accel;
  const left = s.length - s.pos;
  if (!f.sliding || (a <= 0 && s.v + a * dt <= 0)) {
    // held by static friction (or, only from a forged state, braked to rest on the way)
    if (a < 0) s.pos = Math.min(s.length, s.pos + (s.v * s.v) / (-2 * a));
    s.v = 0;
    s.done = true;
  } else if (s.v * dt + (a * dt * dt) / 2 >= left) {
    const vEnd = Math.sqrt(s.v * s.v + 2 * a * left);
    s.time += a === 0 ? left / s.v : (vEnd - s.v) / a;
    s.v = vEnd;
    s.pos = s.length;
    s.done = true;
  } else {
    s.pos += s.v * dt + (a * dt * dt) / 2;
    s.v += a * dt;
    s.time += dt;
  }
  return s;
}
