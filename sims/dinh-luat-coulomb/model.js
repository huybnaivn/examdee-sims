// Coulomb's law for two point charges in vacuum (air), on one line.
// Charge 1 is on the left, charge 2 on the right. Charges in µC, distance in cm, force in N.

export const K = 9e9; // N·m²/C²

export const initialState = () => ({
  q1: 4, // µC
  q2: -6, // µC
  distance: 20, // cm
});

/** Magnitude of the force on either charge, F = k·|q1·q2| / r², in newtons. */
export const force = s => (K * Math.abs(s.q1 * s.q2) * 1e-12) / (s.distance / 100) ** 2;

/** "attract" for unlike signs, "repel" for like signs, "none" if a charge is zero. */
export const interaction = s => {
  const product = s.q1 * s.q2;
  return product > 0 ? "repel" : product < 0 ? "attract" : "none";
};

/**
 * Force on each charge along the line, in newtons, positive to the right.
 * Like charges push apart (charge 1 to the left), unlike charges pull together.
 */
export const forces = s => {
  const f = Math.sign(s.q1 * s.q2) * force(s) + 0; // + 0 turns -0 into 0
  return { on1: -f + 0, on2: f };
};

/** Pick a readable unit: { value, unit } with value in [1, 1000) where possible. */
export function scaleForce(newtons) {
  const f = Math.abs(newtons);
  if (f === 0) return { value: 0, unit: "N" };
  if (f >= 1000) return { value: f / 1000, unit: "kN" };
  if (f >= 1) return { value: f, unit: "N" };
  if (f >= 1e-3) return { value: f * 1e3, unit: "mN" };
  return { value: f * 1e6, unit: "µN" };
}
