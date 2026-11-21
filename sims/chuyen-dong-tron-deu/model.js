// Uniform circular motion about the origin, counter-clockwise, angle measured from the Ox axis.
// "Cutting the string" removes the centripetal force: the object then moves in a straight line
// along the tangent at constant speed. SI units, angles in radians.

export const START_ANGLE = Math.PI / 3;

export const initialState = () => ({
  radius: 1.5, // m
  input: "period", // which quantity the learner sets: "period" | "frequency" | "speed"
  period: 4, // s
  frequency: 0.5, // Hz
  speed: 3, // m/s
  mass: 1, // kg
  showVectors: true,
  angle: START_ANGLE, // rad, total angle from Ox (keeps growing past 2π)
  time: 0, // s
  cut: false, // string cut
  flight: 0, // s since the string was cut
});

/** ω, v, T, f, a_ht and F_ht from the radius and whichever quantity is the input. */
export function kinematics(s) {
  const omega = s.input === "frequency" ? 2 * Math.PI * s.frequency : s.input === "speed" ? s.speed / s.radius : (2 * Math.PI) / s.period;
  const accel = omega * omega * s.radius;
  return { omega, speed: omega * s.radius, period: (2 * Math.PI) / omega, frequency: omega / (2 * Math.PI), accel, force: s.mass * accel };
}

/** Position, velocity and acceleration vectors (y up). After the cut the acceleration is zero. */
export function vectors(s) {
  const k = kinematics(s);
  const cos = Math.cos(s.angle);
  const sin = Math.sin(s.angle);
  const d = s.cut ? k.speed * s.flight : 0; // distance travelled along the tangent
  return {
    x: s.radius * cos - d * sin,
    y: s.radius * sin + d * cos,
    vx: -k.speed * sin,
    vy: k.speed * cos,
    ax: s.cut ? 0 : -k.accel * cos,
    ay: s.cut ? 0 : -k.accel * sin,
  };
}

/** Whole revolutions completed since the start. */
export const laps = s => Math.floor((s.angle - START_ANGLE) / (2 * Math.PI) + 1e-9);

export function step(s, dt) {
  s.time += dt;
  if (s.cut) s.flight += dt;
  else s.angle += kinematics(s).omega * dt;
  return s;
}

export function cut(s) {
  s.cut = true;
  s.flight = 0;
  return s;
}

/** Tie the object back on, at the point where it left the circle. */
export function reattach(s) {
  s.cut = false;
  s.flight = 0;
  return s;
}
