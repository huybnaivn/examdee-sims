// Diffusion and osmosis, two scenes.
//
// "membrane": two compartments of solution separated by a membrane. Solute particles move at
// random (random walk); a permeable membrane lets them through, a semi-permeable one does not.
// Water crosses either membrane; its net flow (mL/s) from left to right is
//   J = K · [(c_R − c_L) − G · (V_R − V_L)]
// i.e. toward the side with more solute (osmosis), held back by the hydrostatic pressure of the
// higher liquid column. c = n / V (particles per mL), V in mL.
//
// "cell": a cell whose solute cannot leave, in an outside solution of concentration c_out (%).
//   dV/dt = KC · (c_in − c_out − P),  c_in = C_IN0 / V,  V relative to the starting volume.
// A plant cell wall pushes back once the protoplast fills it (P = WALL · (V − 1) for V > 1);
// a red blood cell has no wall and bursts (tan máu) at V ≥ BURST.

export const V0 = 10; // mL per compartment at the start
export const K = 0.15; // mL/s per (particle/mL)
export const G = 0.2; // (particle/mL) per mL of level difference: hydrostatic back-pressure
export const V_MIN = 2; // mL, a compartment never empties completely
export const SPEED = 1; // compartment widths per second
export const PASS = 0.5; // chance a particle hitting a permeable membrane goes through
export const MAX_PARTICLES = 60; // per side at the start

export const C_IN0 = 0.9; // % solute inside the cell at its starting volume
export const KC = 0.25; // 1/(s·%)
export const WALL = 8; // % per unit of relative volume above 1 (plant cell wall stiffness)
export const BURST = 1.8; // relative volume at which a red blood cell bursts
export const V_CELL_MIN = 0.25;
export const ISO_TOL = 0.001; // % : only the same concentration counts as isotonic (slider step is 0,05 %)

export const initialState = () => ({
  scene: "membrane", // "membrane" | "cell"
  membrane: "semi", // "semi" (bán thấm: chỉ cho nước qua) | "permeable" (cho cả nước và chất tan qua)
  left0: 40, // solute particles on the left at the start
  right0: 10,
  cell: "rbc", // "rbc" (hồng cầu) | "plant" (tế bào thực vật)
  outside: 2, // % solute in the solution around the cell
  prediction: "", // "" | "same" | "swell" | "burst" | "shrink"
  seed: 2026,
  // running values
  rng: 2026, // mulberry32 state
  time: 0, // s
  nL: 40,
  nR: 10,
  vL: V0, // mL
  vR: V0,
  equilibrium: false,
  eqTime: 0, // s, when equilibrium was reached
  volume: 1, // relative cell volume (protoplast for a plant cell)
  burst: false,
  cellDone: false,
});

/** One mulberry32 draw in [0, 1); advances s.rng. */
export function rand(s) {
  let t = (s.rng = (s.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const int = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number.isFinite(v) ? v : lo)));

/** Clamp keys that have no control, so a forged state cannot break the model. */
export function tidy(s) {
  s.left0 = int(s.left0, 0, MAX_PARTICLES);
  s.right0 = int(s.right0, 0, MAX_PARTICLES);
  const total = s.left0 + s.right0;
  s.nL = int(s.nL, 0, total);
  s.nR = total - s.nL;
  s.vL = Math.min(2 * V0 - V_MIN, Math.max(V_MIN, Number.isFinite(s.vL) ? s.vL : V0));
  s.vR = 2 * V0 - s.vL;
  s.rng = (Number.isFinite(s.rng) ? s.rng : 0) >>> 0;
  s.seed = (Number.isFinite(s.seed) ? s.seed : 0) >>> 0;
  s.volume = Math.min(BURST, Math.max(V_CELL_MIN, Number.isFinite(s.volume) ? s.volume : 1));
  if (!(s.time >= 0)) s.time = 0;
  if (!(s.eqTime >= 0)) s.eqTime = 0;
  return s;
}

// ---------- membrane scene ----------

export const conc = (n, v) => n / v;
export const waterFlow = s => K * (conc(s.nR, s.vR) - conc(s.nL, s.vL) - G * (s.vR - s.vL));

/** Particle positions: x in [0, 2] (left compartment [0, 1)), y as a fraction of that side's liquid height. */
export function particles(s) {
  if (s._p && s._p.length === s.nL + s.nR) return s._p;
  tidy(s);
  // A private generator, so drawing never changes the saved run.
  const r = { rng: (s.rng ^ 0x9e3779b9) >>> 0 };
  const make = left => {
    const a = rand(r) * 2 * Math.PI;
    return { x: (left ? 0 : 1) + 0.03 + 0.94 * rand(r), y: 0.03 + 0.94 * rand(r), a };
  };
  s._p = [...Array.from({ length: s.nL }, () => make(true)), ...Array.from({ length: s.nR }, () => make(false))];
  s._flux = 0;
  return s._p;
}

export function restartMembrane(s) {
  tidy(s);
  s.rng = s.seed;
  s.time = 0;
  s.nL = s.left0;
  s.nR = s.right0;
  s.vL = s.vR = V0;
  s.equilibrium = false;
  s.eqTime = 0;
  s._p = null;
  s._calm = 0;
  s._j = s._d = undefined;
}

/**
 * Advance the membrane scene by dt seconds. Returns true on the step equilibrium is first reached:
 * the (smoothed) water flow has stopped and, for a permeable membrane, the (smoothed) concentrations
 * on the two sides agree to within 10 %, both held for one second.
 */
export function stepMembrane(s, dt) {
  const ps = particles(s);
  const hL = s.vL / V0;
  const hR = s.vR / V0;
  let net = 0; // particles that went left → right this step
  for (const p of ps) {
    p.a += (rand(s) - 0.5) * 2 * 3 * Math.sqrt(dt); // random change of direction
    const left = p.x < 1;
    const h = left ? hL : hR;
    let x = p.x + SPEED * Math.cos(p.a) * dt;
    let y = p.y + (SPEED * Math.sin(p.a) * dt) / Math.max(h, 0.2);
    if (x < 0.01 || x > 1.99) {
      x = p.x;
      p.a = Math.PI - p.a;
    }
    if (y < 0.01 || y > 0.99) {
      y = Math.min(0.99, Math.max(0.01, y));
      p.a = -p.a;
    }
    if (left !== x < 1) {
      if (s.membrane === "permeable" && rand(s) < PASS) {
        net += left ? 1 : -1;
        y = Math.min(0.99, (y * h) / (left ? hR : hL)); // keep the same height in mL terms
      } else {
        x = p.x;
        p.a = Math.PI - p.a;
      }
    }
    p.x = x;
    p.y = y;
  }
  s.nL -= net;
  s.nR += net;
  s._flux = (s._flux ?? 0) * 0.995 + net; // smoothed solute flux, for the arrow

  const J = waterFlow(s);
  s.vL = Math.min(2 * V0 - V_MIN, Math.max(V_MIN, s.vL - J * dt));
  s.vR = 2 * V0 - s.vL;
  s.time += dt;

  if (s.equilibrium) return false;
  // Particle counts flicker, so judge on values smoothed over about two seconds.
  const a = dt / 2;
  s._j = (s._j ?? J) + a * (J - (s._j ?? J));
  const diff = conc(s.nR, s.vR) - conc(s.nL, s.vL);
  s._d = (s._d ?? diff) + a * (diff - (s._d ?? diff));
  const mean = (s.nL + s.nR) / (2 * V0);
  const even = s.membrane === "semi" || Math.abs(s._d) <= 0.1 * mean + 0.05;
  s._calm = Math.abs(s._j) < 0.02 && even ? (s._calm ?? 0) + dt : 0;
  if (s._calm >= 1) {
    s.equilibrium = true;
    s.eqTime = s.time;
    return true;
  }
  return false;
}

// ---------- cell scene ----------

export const cellInside = s => C_IN0 / s.volume;

/** "isotonic" | "hypotonic" | "hypertonic", comparing the outside solution with the cell at the start. */
export const tonicity = outside =>
  Math.abs(outside - C_IN0) <= ISO_TOL ? "isotonic" : outside < C_IN0 ? "hypotonic" : "hypertonic";

const wall = (s, v) => (s.cell === "plant" && v > 1 ? WALL * (v - 1) : 0);
export const cellRate = (s, v = s.volume) => KC * (C_IN0 / v - s.outside - wall(s, v));

/** What happens to the cell in the end: "same" | "swell" | "burst" | "shrink". */
export function cellOutcome(cell, outside) {
  const t = tonicity(outside);
  if (t === "isotonic") return "same";
  if (t === "hypertonic") return "shrink";
  return cell === "rbc" && C_IN0 / outside >= BURST ? "burst" : "swell";
}

export function restartCell(s) {
  tidy(s);
  s.time = 0;
  s.volume = 1;
  s.burst = false;
  s.cellDone = false;
}

/** Advance the cell scene by dt seconds. Returns true on the step the cell settles (or bursts). */
export function stepCell(s, dt) {
  if (s.cellDone) return false;
  const rate = cellRate(s);
  s.volume = Math.max(V_CELL_MIN, s.volume + rate * dt);
  s.time += dt;
  if (s.cell === "rbc" && s.volume >= BURST) {
    s.volume = BURST;
    s.burst = true;
  }
  if (s.burst || Math.abs(rate) < 1e-4) s.cellDone = true;
  return s.cellDone;
}

/** Outcome actually reached by the run (valid once cellDone). */
export function reached(s) {
  if (s.burst) return "burst";
  if (s.volume > 1.005) return "swell";
  if (s.volume < 0.995) return "shrink";
  return "same";
}
