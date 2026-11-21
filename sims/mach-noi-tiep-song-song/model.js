// Two or three resistors (bulbs) across an ideal source, in series or in parallel.
// Each resistor has its own switch. Volts, ohms, amperes, watts.

export const initialState = () => ({
  mode: "series", // "series" | "parallel"
  useR3: true, // third resistor present
  voltage: 12, // V
  r1: 10, // Ω
  r2: 20,
  r3: 30,
  k1: true, // switch next to R1 closed
  k2: true,
  k3: true,
});

/**
 * Solve the circuit.
 * Returns { req, total, power, items: [{ r, closed, i, u, p }] }.
 * `req` is Infinity when no current can flow (open circuit).
 */
export function solve(s) {
  const n = s.useR3 ? 3 : 2;
  const r = [s.r1, s.r2, s.r3].slice(0, n);
  const closed = [s.k1, s.k2, s.k3].slice(0, n).map(Boolean);
  let req;
  let currents;
  if (s.mode === "parallel") {
    // every closed branch sees the full source voltage
    currents = r.map((R, k) => (closed[k] ? s.voltage / R : 0));
    const conductance = r.reduce((sum, R, k) => sum + (closed[k] ? 1 / R : 0), 0);
    req = conductance > 0 ? 1 / conductance : Infinity;
  } else {
    // one path: a single open switch breaks it
    req = closed.every(Boolean) ? r.reduce((sum, R) => sum + R, 0) : Infinity;
    currents = r.map(() => s.voltage / req);
  }
  const total = s.mode === "parallel" ? currents.reduce((sum, i) => sum + i, 0) : currents[0];
  const items = r.map((R, k) => ({ r: R, closed: closed[k], i: currents[k], u: currents[k] * R, p: currents[k] ** 2 * R }));
  return { req, total, power: s.voltage * total, items };
}

/** Bulb brightness 0..1 from its power; full brightness at P_FULL watts. */
export const P_FULL = 6;
export const brightness = p => Math.min(1, Math.sqrt(Math.max(0, p) / P_FULL));

/**
 * Current in each stretch of wire, for the charge animation.
 * Series: [I]. Parallel with n branches: n rail stretches (stretch j carries the
 * current of branches j..n-1, so stretch 0 is the main line) then the n branches.
 */
export function wireCurrents(s) {
  const c = solve(s);
  if (s.mode !== "parallel") return [c.total];
  const branch = c.items.map(it => it.i);
  return [...branch.map((_, j) => branch.slice(j).reduce((sum, i) => sum + i, 0)), ...branch];
}

export const FLOW = 1.6; // dot spacings per coulomb

/** Advance the charge animation. `_phase` is transient. */
export function step(s, dt) {
  const currents = wireCurrents(s);
  const old = s._phase?.length === currents.length ? s._phase : currents.map(() => 0);
  s._phase = currents.map((i, j) => (old[j] + i * dt * FLOW) % 1);
  return s;
}
