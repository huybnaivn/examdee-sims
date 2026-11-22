// Heart and circulation, a documented simple model (illustrative, not clinical).
//
// Exercise level e (0..1) raises both:
//   heart rate      f  = f₀ + (190 − f₀)·e            (nhịp/phút; 190 is a typical maximum)
//   stroke volume   V  = V₀·(1 + 0,4·e)               (mL)
//   cardiac output  Q  = f·V                          (mL/phút, shown in L/phút)
//   cycle duration  T  = 60 / f                       (s)
// Cardiac cycle: the three textbook phases keep their 0,1 : 0,3 : 0,4 s proportions
// (pha co tâm nhĩ, pha co tâm thất, pha dãn chung) at every heart rate.
// Blood pressure:  mean pressure  P = Q·R, with R = R₀/(1 + 2e) (vessels in muscles widen),
//   pulse pressure ΔP = k·V, systolic = P + ⅔ΔP, diastolic = P − ⅓ΔP (so P = diastolic + ΔP/3).
//   R₀ and k are chosen so that rest (75 nhịp/phút, 70 mL) gives about 120/80 mmHg.

export const MAX_RATE = 190;
export const R0 = 93 / 5.25; // mmHg·phút/L, mean pressure 93 mmHg at Q = 5,25 L/phút
export const K_PULSE = 40 / 70; // mmHg per mL of stroke volume

// The loop a red blood cell follows, starting in the right atrium. After the last comes the first.
export const STATIONS = [
  { name: "Tâm nhĩ phải", short: "TNP" },
  { name: "Tâm thất phải", short: "TTP" },
  { name: "Động mạch phổi", short: "ĐM phổi" },
  { name: "Mao mạch phổi", short: "MM phổi" },
  { name: "Tĩnh mạch phổi", short: "TM phổi" },
  { name: "Tâm nhĩ trái", short: "TNT" },
  { name: "Tâm thất trái", short: "TTT" },
  { name: "Động mạch chủ", short: "ĐM chủ" },
  { name: "Mao mạch các cơ quan", short: "MM cơ quan" },
  { name: "Tĩnh mạch chủ", short: "TM chủ" },
];

// av: van nhĩ – thất (van ba lá, van hai lá); sl: van động mạch (van động mạch phổi, van động mạch chủ).
export const PHASES = [
  { name: "Pha co tâm nhĩ", share: 0.1 / 0.8, av: true, sl: false },
  { name: "Pha co tâm thất", share: 0.3 / 0.8, av: false, sl: true },
  { name: "Pha dãn chung", share: 0.4 / 0.8, av: true, sl: false },
];

export const initialState = () => ({
  restRate: 75, // nhịp/phút
  restSV: 70, // mL
  exercise: 0, // %
  slow: true, // play 4 times slower
  t: 0, // s into the current cardiac cycle
  flow: 0, // 0..1, phase of the blood particles round the loop
  traceStart: -1, // station where the learner's trace began, −1 none
  traceLen: 0, // stations traced in order so far (0..10)
  traceMistakes: 0,
  pick: -1, // keyboard picker for the trace, −1 = nothing chosen
});

const num = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

/** Effective values at the current exercise level. */
export function heart(s) {
  const e = num(s.exercise, 0, 100, 0) / 100;
  const rate = num(s.restRate, 30, MAX_RATE, 75) + (MAX_RATE - num(s.restRate, 30, MAX_RATE, 75)) * e;
  const sv = num(s.restSV, 20, 150, 70) * (1 + 0.4 * e);
  const output = (rate * sv) / 1000; // L/phút
  const mean = output * (R0 / (1 + 2 * e));
  const pulse = K_PULSE * sv;
  return { e, rate, sv, output, period: 60 / rate, mean, pulse, systolic: mean + (2 / 3) * pulse, diastolic: mean - pulse / 3 };
}

/** Phase index (0..2) and progress within it (0..1) at fraction x (0..1) of the cycle. */
export function phaseAt(x) {
  x = ((x % 1) + 1) % 1;
  let start = 0;
  for (let i = 0; i < PHASES.length; i++) {
    if (x < start + PHASES[i].share || i === PHASES.length - 1) return { index: i, progress: (x - start) / PHASES[i].share };
    start += PHASES[i].share;
  }
}

/** Which valves are open in a phase. */
export const valves = index => {
  const p = PHASES[index];
  return { tricuspid: p.av, mitral: p.av, pulmonary: p.sl, aortic: p.sl };
};

export function step(s, dt) {
  const h = heart(s);
  s.t = (num(s.t, 0, 1e9, 0) + dt) % h.period;
  s.flow = (num(s.flow, 0, 1, 0) + dt * 0.04 * h.output) % 1; // illustrative particle speed ∝ Q
  return s;
}

/**
 * The learner taps station i while tracing a red blood cell. The trace may start at any station
 * and must then follow STATIONS in order (wrapping round). Returns { correct, done }.
 */
export function tap(s, i) {
  const n = STATIONS.length;
  if (!Number.isInteger(i) || i < 0 || i >= n) return { correct: false, done: false };
  const len = num(Math.floor(s.traceLen), 0, n, 0);
  if (len === 0 || len >= n || !(Number.isInteger(s.traceStart) && s.traceStart >= 0 && s.traceStart < n)) {
    Object.assign(s, { traceStart: i, traceLen: 1, traceMistakes: 0 });
    return { correct: true, done: false };
  }
  if (i !== (s.traceStart + len) % n) {
    s.traceMistakes = num(s.traceMistakes, 0, 1e6, 0) + 1;
    return { correct: false, done: false };
  }
  s.traceLen = len + 1;
  return { correct: true, done: s.traceLen === n };
}

/** Stations already traced, in order. */
export function traced(s) {
  const n = STATIONS.length;
  if (!(Number.isInteger(s.traceStart) && s.traceStart >= 0 && s.traceStart < n)) return [];
  const len = num(Math.floor(s.traceLen), 0, n, 0);
  return Array.from({ length: len }, (_, k) => (s.traceStart + k) % n);
}
