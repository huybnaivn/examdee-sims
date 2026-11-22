// Two or three capacitors across an ideal source, in series, in parallel or in a mixed arrangement.
// Units: capacitance µF, voltage V, charge µC (µF·V), energy µJ (µF·V²).

export const ARRANGEMENTS = ["series", "parallel", "mixed-a", "mixed-b"];
// mixed-a: C₁ nt (C₂ // C₃);  mixed-b: (C₁ nt C₂) // C₃
export const TARGETS = [0, 0.75, 1.2, 2.4, 4.5, 7.5]; // µF, 0 = no challenge
export const TOLERANCE = 0.005; // relative, for reaching a target

export const initialState = () => ({
  arrangement: "series",
  useC3: false, // series / parallel: a third capacitor (mixed arrangements always use three)
  voltage: 12, // V
  c1: 2, // µF
  c2: 4,
  c3: 6,
  target: 0, // µF, requested equivalent capacitance (0 = none)
});

export const seriesC = cs => 1 / cs.reduce((a, c) => a + 1 / c, 0);
export const parallelC = cs => cs.reduce((a, c) => a + c, 0);

/** Number of capacitors in use. */
export const count = s => (s.arrangement === "mixed-a" || s.arrangement === "mixed-b" || s.useC3 ? 3 : 2);

/**
 * Solve the bank: { ceq, q, energy, items: [{ c, q, u, w }] }.
 * Builds from the textbook rules only: series parts share Q, parallel parts share U.
 */
export function solve(s) {
  const U = s.voltage;
  const cs = [s.c1, s.c2, s.c3].slice(0, count(s)).map(c => Math.max(c, 1e-9));
  let ceq;
  let us; // voltage on each capacitor
  if (s.arrangement === "parallel") {
    ceq = parallelC(cs);
    us = cs.map(() => U);
  } else if (s.arrangement === "mixed-a") {
    const c23 = cs[1] + cs[2];
    ceq = seriesC([cs[0], c23]);
    const q = ceq * U;
    us = [q / cs[0], q / c23, q / c23];
  } else if (s.arrangement === "mixed-b") {
    const c12 = seriesC([cs[0], cs[1]]);
    ceq = c12 + cs[2];
    const q12 = c12 * U;
    us = [q12 / cs[0], q12 / cs[1], U];
  } else {
    ceq = seriesC(cs);
    const q = ceq * U;
    us = cs.map(c => q / c);
  }
  const items = cs.map((c, k) => ({ c, u: us[k], q: c * us[k], w: (c * us[k] ** 2) / 2 }));
  return { ceq, q: ceq * U, energy: (ceq * U * U) / 2, items };
}

export const reached = s => s.target > 0 && Math.abs(solve(s).ceq - s.target) <= TOLERANCE * s.target;
