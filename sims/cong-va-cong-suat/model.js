// Mechanical work and power. Two machines do the same task side by side.
// Task "lift": raise a load of mass m through height h at constant speed (F = P = m·g, α = 0°).
// Task "push": drag a box a distance s along a level floor at constant speed with a rope at α above
// the horizontal; friction coefficient μ. SI units: kg, m, N, J, s, W.

export const G = 9.81; // m/s²
export const HP = 746; // W, 1 mã lực (horsepower) ≈ 746 W

/** Machine presets. `power` is the total (input) power in W; "motor" uses the matching slider. */
export const MACHINES = {
  person: { name: "Người", power: 75 },
  winch: { name: "Tời điện 0,5 kW", power: 500 },
  hp1: { name: "Động cơ 1 mã lực", power: HP },
  crane: { name: "Cần cẩu 5 kW", power: 5000 },
  motor: { name: "Động cơ tự chọn", power: null },
};

export const initialState = () => ({
  task: "lift", // "lift" | "push"
  mass: 50, // kg
  distance: 6, // m: height h (lift) or path length s (push)
  mu: 0.3, // friction coefficient (push)
  angle: 20, // ° between the rope and the floor (push)
  efficiency: 80, // %, H = A_ci / A_tp
  machine1: "person",
  machine2: "hp1",
  power1: 2, // kW, used when machine1 = "motor"
  power2: 2, // kW, used when machine2 = "motor"
  targetTime: 30, // s, the time the job must be done in (machine 1)
  time: 0, // s, simulated clock since the start
});

/** A = F·s·cosα (α in degrees). */
export const work = (force, dist, alphaDeg) => force * dist * Math.cos((alphaDeg * Math.PI) / 180);

/** Total power of machine k (1 or 2) in W. */
export function machinePower(s, k) {
  const id = s[`machine${k}`];
  const m = MACHINES[id] ?? MACHINES.person;
  return m.power ?? Math.max(0.01, s[`power${k}`]) * 1000;
}

/**
 * The forces on the load while it moves at constant speed, each with its angle to the
 * displacement and its work. The first entry is the force the machine applies.
 */
export function forces(s) {
  const weight = s.mass * G;
  const d = s.distance;
  if (s.task === "push") {
    const a = (s.angle * Math.PI) / 180;
    // constant speed: F·cosα = μ·N and N = P − F·sinα
    const pull = (s.mu * weight) / (Math.cos(a) + s.mu * Math.sin(a));
    const normal = weight - pull * Math.sin(a);
    const friction = s.mu * normal;
    return [
      { key: "F", name: "Lực kéo F", force: pull, alpha: s.angle, work: work(pull, d, s.angle) },
      { key: "P", name: "Trọng lực P", force: weight, alpha: 90, work: work(weight, d, 90) },
      { key: "N", name: "Phản lực N", force: normal, alpha: 90, work: work(normal, d, 90) },
      { key: "Fms", name: "Lực ma sát", force: friction, alpha: 180, work: work(friction, d, 180) },
    ];
  }
  return [
    { key: "F", name: "Lực kéo F", force: weight, alpha: 0, work: work(weight, d, 0) },
    { key: "P", name: "Trọng lực P", force: weight, alpha: 180, work: work(weight, d, 180) },
  ];
}

/** Useful work A_ci (done by the pulling force), total work A_tp = A_ci / H. */
export function task(s) {
  const useful = forces(s)[0].work;
  const h = Math.max(1, s.efficiency) / 100;
  return { useful, total: useful / h };
}

/** Time machine k needs: t = A_tp / P. */
export const duration = (s, k) => task(s).total / machinePower(s, k);

/** Progress of machine k at the current clock, 0..1. */
export const progress = (s, k) => Math.min(1, Math.max(0, s.time) / duration(s, k));

/**
 * Advance the clock. Returns the machines (1, 2) that finished during this step.
 * A finished race restarts from zero.
 */
export function step(s, dt) {
  const t = [duration(s, 1), duration(s, 2)];
  if (s.time >= Math.max(...t)) s.time = 0;
  const before = s.time;
  s.time = Math.min(Math.max(...t), s.time + dt);
  return [1, 2].filter(k => before < t[k - 1] && s.time >= t[k - 1]);
}

/** Power in W expressed in W, kW and mã lực. */
export const powerUnits = w => ({ W: w, kW: w / 1000, HP: w / HP });
