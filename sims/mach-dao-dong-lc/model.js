// LC circuit: a charged capacitor C discharging through an inductor L, with an optional small
// series resistance R. q is the charge on plate A, i = dq/dt (positive when plate A gains charge).
//   L·q″ + R·q′ + q/C = 0
// State keeps L in mH, C in µF, Q₀ in µC (as on the sliders); q, i and time are in C, A and s.
// The animation is slowed down: one undamped period always takes VISUAL_PERIOD seconds on screen.

export const VISUAL_PERIOD = 3; // s on screen per period T
export const LIMITS = { inductance: [1, 100], capacitance: [1, 100], charge0: [10, 200], resistance: [0, 20] };

const si = s => ({ L: s.inductance * 1e-3, C: s.capacitance * 1e-6, R: s.resistance, Q0: s.charge0 * 1e-6 });

/** ω = 1/√(LC) (rad/s) */
export const omega = s => 1 / Math.sqrt(si(s).L * si(s).C);
/** T = 2π√(LC) (s) */
export const period = s => 2 * Math.PI * Math.sqrt(si(s).L * si(s).C);
/** I₀ = ω·Q₀ (A) */
export const maxCurrent = s => omega(s) * si(s).Q0;
/** W = Q₀²/(2C) (J), the energy stored at the start */
export const initialEnergy = s => si(s).Q0 ** 2 / (2 * si(s).C);

/** W_C = q²/(2C), W_L = L·i²/2 (J) */
export function energy(s) {
  const { L, C } = si(s);
  const electric = (s.q * s.q) / (2 * C);
  const magnetic = (L * s.i * s.i) / 2;
  return { electric, magnetic, total: electric + magnetic };
}

/** Recharge the capacitor to Q₀ and start again with no current. */
export function recharge(s) {
  s.q = si(s).Q0;
  s.i = 0;
  s.time = 0;
  s.measuredPeriod = 0;
  s.lastCross = -1;
  s._hist = [];
  return s;
}

/** Keep forged or out-of-range values physical: settings in range, |q| ≤ Q₀, |i| ≤ I₀, t ≥ 0. */
export function tidy(s) {
  for (const [key, [lo, hi]] of Object.entries(LIMITS)) s[key] = Math.min(hi, Math.max(lo, s[key]));
  const Q0 = si(s).Q0;
  const I0 = maxCurrent(s);
  s.q = Math.min(Q0, Math.max(-Q0, s.q));
  s.i = Math.min(I0, Math.max(-I0, s.i));
  s.time = Math.max(0, s.time);
  if (!(s.lastCross <= s.time)) s.lastCross = -1;
  return s;
}

/** Advance dt seconds of screen time (RK4). Returns true when a full period has just been measured. */
export function step(s, dt) {
  const { L, C, R } = si(s);
  const h = (dt * period(s)) / VISUAL_PERIOD; // physical seconds
  const di = (q, i) => -q / (L * C) - (R / L) * i;
  const { q, i } = s;
  const k1q = i;
  const k1i = di(q, i);
  const k2q = i + (h / 2) * k1i;
  const k2i = di(q + (h / 2) * k1q, k2q);
  const k3q = i + (h / 2) * k2i;
  const k3i = di(q + (h / 2) * k2q, k3q);
  const k4q = i + h * k3i;
  const k4i = di(q + h * k3q, k4q);
  s.q = q + (h / 6) * (k1q + 2 * k2q + 2 * k3q + k4q);
  s.i = i + (h / 6) * (k1i + 2 * k2i + 2 * k3i + k4i);
  s.time += h;
  let measured = false;
  // time one full period between successive upward zero crossings of q (interpolated)
  if (q < 0 && s.q >= 0) {
    const cross = s.time - h + (h * -q) / (s.q - q);
    if (s.lastCross >= 0) {
      s.measuredPeriod = cross - s.lastCross;
      measured = true;
    }
    s.lastCross = cross;
  }
  s._hist ??= [];
  s._hist.push([s.time, s.q, s.i]);
  while (s._hist.length > 2 && s._hist[0][0] < s.time - 2.2 * period(s)) s._hist.shift();
  return measured;
}

const DEFAULTS = {
  inductance: 10, // mH
  capacitance: 10, // µF
  charge0: 100, // µC
  resistance: 0, // Ω
  q: 0, // C, charge on plate A
  i: 0, // A
  time: 0, // s
  measuredPeriod: 0, // s, 0 until a full period has been timed
  lastCross: -1, // s, time q last rose through zero
};

/** Opens 1⅛ periods after the capacitor was connected, so the graphs already show the oscillation. */
export function initialState() {
  const s = recharge({ ...DEFAULTS });
  for (let k = 0; k < 1.125 * VISUAL_PERIOD * 120; k++) step(s, 1 / 120);
  return s;
}
