// Jet propulsion.
// Rocket: starts at rest, ejects gas at speed u relative to the rocket with mass flow μ = |dm/dt|.
//   Thrust F = u·μ. Without gravity Δv = u·ln(m₀/m) (Tsiolkovsky). With gravity the rocket stands
//   on the pad until F > m·g.
// Recoil: a gun (m₁) at rest fires a bullet (m₂, v₂): m₁v₁ + m₂v₂ = 0.

export const G = 9.81; // m/s²

export const initialState = () => ({
  mode: "rocket", // "rocket" | "recoil"
  dryMass: 1000, // kg, rocket without fuel
  fuelMass: 3000, // kg at launch
  exhaustSpeed: 2500, // u, m/s relative to the rocket
  massFlow: 100, // μ, kg/s
  gravity: false, // launch from the ground (g = 9,81 m/s²) instead of free space
  bursts: 5, // N: the fuel ejected in N equal portions, for the step-by-step comparison
  time: 0, // s since launch
  v: 0, // m/s, rocket velocity (up / forward positive)
  x: 0, // m, distance travelled (height above the pad with gravity)
  pGas: 0, // kg·m/s, total momentum of the ejected gas
  launched: false,
  done: false, // fuel used up (rocket) / bullet has left the screen (recoil)
  gunMass: 4, // kg
  bulletMass: 10, // g
  bulletSpeed: 800, // m/s
});

const pos = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
export const burnTime = s => s.fuelMass / s.massFlow;
export const thrust = s => s.exhaustSpeed * s.massFlow;
export const fuelLeft = s => Math.max(0, s.fuelMass - s.massFlow * pos(s.time, 0, burnTime(s)));
export const mass = s => s.dryMass + fuelLeft(s);
export const gOf = s => (s.gravity ? G : 0);

/** Tsiolkovsky: Δv = u·ln(m₀/m). */
export const tsiolkovsky = (u, m0, m) => u * Math.log(m0 / m);
export const formulaSpeed = s => tsiolkovsky(s.exhaustSpeed, s.dryMass + s.fuelMass, mass(s));

/**
 * The same fuel thrown out in n equal portions, each at speed u relative to the rocket after the throw.
 * Momentum conservation for one portion Δm: m·v = (m − Δm)(v + Δv) + Δm(v + Δv − u) ⇒ Δv = u·Δm/m,
 * with m the mass before the throw. The sum tends to u·ln(m₀/m) as n grows.
 */
export function burstSpeed(u, m0, fuel, n) {
  const dm = fuel / n;
  let v = 0;
  for (let m = m0, i = 0; i < n; i++, m -= dm) v += (u * dm) / m;
  return v;
}

const deriv = (s, t, v) => {
  const burning = t <= burnTime(s); // steps end exactly at burn-out, so the end point still has thrust
  const m = s.dryMass + Math.max(0, s.fuelMass - s.massFlow * t);
  const a = (burning ? thrust(s) / m : 0) - gOf(s);
  return { a, dp: burning ? s.massFlow * (v - s.exhaustSpeed) : 0 }; // gas leaves at v − u
};

/** Advance the rocket by dt (RK4 on v, x and the gas momentum). Stops exactly at burn-out. */
export function stepRocket(s, dt) {
  const tb = burnTime(s);
  s.time = pos(s.time, 0, tb);
  const h = Math.min(dt, tb - s.time);
  if (h <= 0) return (s.done = true), s;
  const onPad = s.gravity && s.x <= 0 && s.v <= 0;
  if (onPad && deriv(s, s.time, 0).a <= 0) {
    // thrust ≤ weight: the pad holds the rocket; the gas still carries momentum away (the Earth takes the rest)
    s.pGas += h * deriv(s, s.time + h / 2, 0).dp;
  } else {
    const k1 = deriv(s, s.time, s.v);
    const k2 = deriv(s, s.time + h / 2, s.v + (h / 2) * k1.a);
    const k3 = deriv(s, s.time + h / 2, s.v + (h / 2) * k2.a);
    const k4 = deriv(s, s.time + h, s.v + h * k3.a);
    s.x += h * s.v + (h * h / 6) * (k1.a + k2.a + k3.a);
    s.v += (h / 6) * (k1.a + 2 * k2.a + 2 * k3.a + k4.a);
    s.pGas += (h / 6) * (k1.dp + 2 * k2.dp + 2 * k3.dp + k4.dp);
    if (s.gravity && s.x < 0) (s.x = 0), (s.v = Math.max(0, s.v));
  }
  s.time += h;
  if (s.time >= tb - 1e-9) s.done = true;
  return s;
}

/** Recoil speed of the gun (m/s, negative = backwards). Bullet mass is in grams. */
export const recoilSpeed = s => -((s.bulletMass / 1000) * s.bulletSpeed) / s.gunMass;
