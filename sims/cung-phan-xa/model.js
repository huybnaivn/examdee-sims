// Reflex arc and reaction time.
//
// Part 1. A nerve impulse runs along each nerve fibre at the conduction speed v (m/s). Time of a path:
//   t = L / v + (time spent in the central nervous system)
// Typical values (textbook ranges, used as estimates): myelinated fibres 50–120 m/s, unmyelinated
// 0,5–2 m/s; one synapse delays the impulse by about 0,5–1 ms; a conscious decision in the brain takes
// on the order of 0,1–0,2 s. Path lengths are for an adult arm: fingertip → spinal cord ≈ 0,9 m,
// spinal cord → forearm muscle ≈ 0,6 m, spinal cord ↔ brain ≈ 0,5 m.
//
// Part 2. Reaction time from a dropped ruler: it falls freely, d = g t² / 2, so t = √(2d / g).

export const G = 9.81;
export const MIN_RT = 100; // ms; a tap sooner than this after the signal is anticipation, not reaction
export const RULER = 0.5; // m, length of the ruler
export const MAX_TRIALS = 10;

/** Arc components in the order the impulse passes them. */
export const COMPONENTS = ["receptor", "afferent", "centre", "efferent", "effector"];
export const NAMES = {
  receptor: "Thụ quan",
  afferent: "Nơron hướng tâm",
  centre: "Trung ương thần kinh",
  efferent: "Nơron li tâm",
  effector: "Cơ quan phản ứng",
};

/**
 * Stages of each path. A stage is conduction along a fibre (len > 0, time len / v) or processing in
 * the central nervous system (delay > 0, independent of v).
 */
export const PATHS = {
  spinal: [
    { id: "aff", part: "afferent", len: 0.9, delay: 0 },
    { id: "cord", part: "centre", len: 0, delay: 0.002 }, // two synapses in the spinal cord
    { id: "eff", part: "efferent", len: 0.6, delay: 0 },
  ],
  conscious: [
    { id: "aff", part: "afferent", len: 0.9, delay: 0 },
    { id: "up", part: "centre", len: 0.5, delay: 0 }, // spinal cord → brain
    { id: "brain", part: "centre", len: 0, delay: 0.15 }, // perceiving and deciding
    { id: "down", part: "centre", len: 0.5, delay: 0 }, // brain → spinal cord
    { id: "eff", part: "efferent", len: 0.6, delay: 0 },
  ],
};

const path = kind => PATHS[kind] ?? PATHS.spinal;
const speed = v => Math.min(150, Math.max(0.1, Number(v) || 0.1));
export const stageTime = (stage, v) => stage.len / speed(v) + stage.delay;
export const pathLength = kind => path(kind).reduce((a, st) => a + st.len, 0);
export const conductionTime = (kind, v) => pathLength(kind) / speed(v);
export const centralDelay = kind => path(kind).reduce((a, st) => a + st.delay, 0);
export const totalTime = (kind, v) => path(kind).reduce((a, st) => a + stageTime(st, v), 0);

/** Where the impulse is at time t (s) after the stimulus: stage index and fraction along it. */
export function signalAt(kind, v, t) {
  const stages = path(kind);
  let start = 0;
  for (let i = 0; i < stages.length; i++) {
    const d = stageTime(stages[i], v);
    if (t < start + d) return { index: i, frac: Math.max(0, (t - start) / d), done: false };
    start += d;
  }
  return { index: stages.length - 1, frac: 1, done: true };
}

/** True when the list names the five components in the order the impulse passes them. */
export const checkOrder = list => list.length === COMPONENTS.length && list.every((c, i) => c === COMPONENTS[i]);

export const rulerDistance = (t, g = G) => (g * t * t) / 2; // m, t in s
export const rulerTime = (d, g = G) => Math.sqrt((2 * Math.max(0, d)) / g); // s, d in m
export const readRuler = d => Math.round(d * 1000) / 1000; // read to the nearest millimetre

/** Mean and sample standard deviation (divide by n − 1). */
export function stats(xs) {
  const n = xs.length;
  if (!n) return { n: 0, mean: 0, sd: 0 };
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1)) : 0;
  return { n, mean, sd };
}

/** "false-start" for a tap before the signal or sooner than MIN_RT after it, "valid" otherwise. */
export function classifyTap(phase, rtMs) {
  if (phase === "waiting") return "false-start";
  if (phase !== "go") return "ignore";
  return rtMs < MIN_RT ? "false-start" : "valid";
}

/** Seedable generator (mulberry32): numbers in [0, 1). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random waiting time before the signal, 1,5–4 s, so the learner cannot anticipate it. */
export const waitFor = seed => 1.5 + 2.5 * rng(seed)();

export const initialState = () => ({
  part: "arc", // "arc" or "game"
  speedV: 60, // m/s, conduction speed
  slow: 0.02, // playback speed of the arc animation (1/50)
  compare: true, // also run the conscious path
  t: 0.012, // s since the stimulus
  showNames: false,
  o1: "effector",
  o2: "centre",
  o3: "receptor",
  o4: "efferent",
  o5: "afferent",
  orderAttempts: 0,
  ordered: false,
  orderChecked: false,
  mode: "screen", // "screen" (screen turns green) or "ruler" (ruler drop)
  setSize: 5,
  phase: "idle", // idle | waiting | go | false | slow | missed | trial | set
  clock: 0, // s since the trial started
  waitUntil: 2, // s, when the signal comes
  seed: 7,
  trials: [], // reaction times of the current set, ms
  falseStarts: 0,
  lastRt: 0, // ms
  lastDistance: 0, // m, ruler reading of the last trial
});

/** Start a trial: wait a random time, then give the signal. */
export function startTrial(s) {
  if (s.phase === "set" || s.trials.length >= s.setSize) s.trials = [];
  s.seed = (s.seed + 1) >>> 0;
  s.waitUntil = waitFor(s.seed);
  s.clock = 0;
  s.phase = "waiting";
}

/** Record a tap `rtMs` after the signal (any value while waiting). Returns what it was. */
export function tap(s, rtMs) {
  const kind = classifyTap(s.phase, rtMs);
  if (kind === "false-start") {
    s.falseStarts = Math.min(999, s.falseStarts + 1);
    s.phase = "false";
  } else if (kind === "valid") {
    if (timeout(s, rtMs)) return "missed";
    let rt = rtMs;
    if (s.mode === "ruler") {
      s.lastDistance = readRuler(rulerDistance(rtMs / 1000));
      rt = rulerTime(s.lastDistance) * 1000; // the time the learner computes from the reading
    }
    s.lastRt = rt;
    s.trials.push(rt);
    s.phase = s.trials.length >= s.setSize ? "set" : "trial";
  }
  return kind;
}

export const MAX_SCREEN_RT = 2000; // ms; slower than this does not count

/** End the trial when the learner waits too long (or the ruler has fallen through). */
export function timeout(s, elapsedMs) {
  if (s.phase !== "go") return false;
  const limit = s.mode === "ruler" ? rulerTime(RULER) * 1000 : MAX_SCREEN_RT;
  if (elapsedMs <= limit) return false;
  s.phase = s.mode === "ruler" ? "missed" : "slow";
  return true;
}
