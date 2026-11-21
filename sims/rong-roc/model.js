// Lifting a load with pulleys. The rope is light and does not stretch.
// "fixed": one fixed pulley. "movableN": a block-and-tackle (palăng) with N movable pulleys on the
// lower block and N fixed pulleys on the upper block, so 2N rope segments hold the lower block.
// Friction in the axles is lumped into one efficiency η (0 < η ≤ 1): F = F_no-friction / η.

export const G = 10; // m/s², the value Vietnamese textbooks use for P = 10·m
export const LIFT_SPEED = 0.25; // m/s, load speed while "Chạy" pulls the rope

export const SYSTEMS = { fixed: 0, movable1: 1, movable2: 2, movable3: 3 };

export const initialState = () => ({
  system: "movable1",
  mass: 20, // kg, load
  pulleyMass: 0, // kg, each movable pulley
  efficiency: 100, // %, friction only
  target: 1, // m, height to lift the load to
  height: 0.4, // m, current height of the load
});

/** Number of movable pulleys; anything unknown counts as the fixed pulley. */
export const movable = s => SYSTEMS[s.system] ?? 0;
/** Rope segments holding the load (or the lower block): 1 for the fixed pulley, 2n for n movable ones. */
export const segments = s => Math.max(1, 2 * movable(s));

/** Everything the learner reads off, for the current height. */
export function solve(s) {
  const n = movable(s);
  const k = segments(s);
  const eta = Math.min(1, Math.max(0.01, s.efficiency / 100));
  const P = s.mass * G; // weight of the load
  const Pr = n * s.pulleyMass * G; // the movable pulleys rise with the load
  const force = (P + Pr) / k / eta;
  const h = height(s);
  const rope = k * h; // rope pulled through the hand
  const workIn = force * rope; // A_tp
  const workOut = P * h; // A_ci
  return { n, k, P, Pr, force, height: h, rope, workIn, workOut, efficiency: (P / (P + Pr)) * eta };
}

/** Height of the load, kept within [0, target] even for a forged state. */
export const height = s => Math.min(Math.max(0, s.target), Math.max(0, s.height || 0));

/** Pull `ds` metres of rope (negative lets it back). Returns true when the load has just reached the target. */
export function pull(s, ds) {
  const before = height(s);
  s.height = Math.min(s.target, Math.max(0, before + ds / segments(s)));
  if (s.height > s.target - 1e-9) s.height = s.target; // no rounding residue in the reported outcome
  return before < s.target && s.height >= s.target;
}

/** Advance the automatic pull by dt seconds. */
export function step(s, dt) {
  return pull(s, LIFT_SPEED * segments(s) * dt);
}
