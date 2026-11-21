// Objects released together from rest at the top of the same incline.
// Rolling bodies roll without slipping (v = ωR); the block slides without friction.
// For a body with I = k·m·R²: a = g·sin α / (1 + k).

export const G = 9.81; // m/s²
const RAD = Math.PI / 180;

// k = I/(mR²); the block does not rotate, so k = 0.
export const BODIES = [
  { id: "block", k: 0, name: "Khối hộp trượt", short: "Khối hộp" },
  { id: "sphere", k: 2 / 5, name: "Quả cầu đặc", short: "Cầu đặc" },
  { id: "cylinder", k: 1 / 2, name: "Trụ đặc", short: "Trụ đặc" },
  { id: "ring", k: 1, name: "Trụ rỗng (vành)", short: "Trụ rỗng" },
];

export const initialState = () => ({
  angle: 30, // α, degrees
  length: 2, // m, distance along the incline from start to finish
  mass: 1, // kg, the same for every object
  radius: 0.1, // m, the same for every rolling object
  time: 0, // s since release
  done: false, // all objects have reached the finish
  slow: false, // play 4 times slower
});

export const accel = (s, k) => (G * Math.sin(s.angle * RAD)) / (1 + k);
export const finishTime = (s, k) => Math.sqrt((2 * s.length) / accel(s, k));
export const lastFinish = s => Math.max(...BODIES.map(b => finishTime(s, b.k)));

const t = s => Math.max(0, Math.min(s.time, 100)); // time has no control, so clamp it here

/** Distance travelled along the incline (m), stops at the finish. */
export const distance = (s, k) => Math.min(0.5 * accel(s, k) * t(s) ** 2, s.length);
/** Speed of the centre of mass (m/s), constant after the finish. */
export const speed = (s, k) => accel(s, k) * Math.min(t(s), finishTime(s, k));
/** Angle turned (rad) by a rolling body: it rolls without slipping, so θ = d/R. */
export const turned = (s, k) => (k ? distance(s, k) / s.radius : 0);

/** Energies (J) with the bottom of the incline as the zero of potential energy. */
export function energy(s, k) {
  const v = speed(s, k);
  const omega = k ? v / s.radius : 0; // v = ωR
  const inertia = k * s.mass * s.radius ** 2;
  const potential = s.mass * G * (s.length - distance(s, k)) * Math.sin(s.angle * RAD);
  const translational = 0.5 * s.mass * v * v;
  const rotational = 0.5 * inertia * omega * omega;
  return { potential, translational, rotational, total: potential + translational + rotational };
}

/** Finish order, fastest first. */
export const ranking = s => [...BODIES].sort((a, b) => finishTime(s, a.k) - finishTime(s, b.k));

export function step(s, dt) {
  s.time = Math.min(t(s) + dt, lastFinish(s));
  if (s.time >= lastFinish(s)) s.done = true;
  return s;
}
