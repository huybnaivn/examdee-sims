// Uniform motion on a straight track. Runner A may stop for a while at the middle of the track.
// Distances in m, times in s, speeds in m/s.

export const NAMES = ["A", "B", "C"];

export const initialState = () => ({
  length: 100, // m, length of the track
  vA: 8, // m/s
  vB: 5,
  vC: 6,
  three: true, // runner C takes part
  stop: true, // A stops at the middle of the track
  stopTime: 4, // s
  time: 9, // s, stopwatch
  finished: false,
  showSlope: false,
  question: "fastest",
  answer: "A",
  guess: 5, // m/s, learner's numeric answer
});

export const toKmh = v => v * 3.6;
export const toMs = kmh => kmh / 3.6;

/** Runners taking part, each { name, v, stopAt, stopTime }. stopAt is a distance (m) or -1. */
export function runners(s) {
  const list = [
    { name: "A", v: s.vA, stopAt: s.stop ? s.length / 2 : -1, stopTime: s.stop ? Math.max(0, s.stopTime) : 0 },
    { name: "B", v: s.vB, stopAt: -1, stopTime: 0 },
  ];
  if (s.three) list.push({ name: "C", v: s.vC, stopAt: -1, stopTime: 0 });
  return list;
}

/** Moment the runner reaches the stop point and leaves it again (s), or null. */
export function stopWindow(r) {
  if (r.stopAt < 0 || r.stopTime <= 0) return null;
  const t1 = r.stopAt / r.v;
  return { t1, t2: t1 + r.stopTime };
}

export const finishTime = (r, length) => length / r.v + (stopWindow(r) ? r.stopTime : 0);

/** Distance covered at time t (m): s = v·t, constant while stopped, capped at the finish line. */
export function position(r, length, t) {
  t = Math.max(0, t);
  const w = stopWindow(r);
  let d;
  if (!w || t <= w.t1) d = r.v * t;
  else if (t <= w.t2) d = r.stopAt;
  else d = r.stopAt + r.v * (t - w.t2);
  return Math.min(length, d);
}

/** Average speed over the whole trip, stop included: v_tb = s / t. */
export const averageSpeed = (r, length) => length / finishTime(r, length);

export const raceEnd = s => Math.max(...runners(s).map(r => finishTime(r, s.length)));

/** Advance the stopwatch. Returns true on the step the last runner crosses the line. */
export function step(s, dt) {
  if (s.finished) return false;
  const end = raceEnd(s);
  s.time = Math.min(end, Math.max(0, s.time) + dt);
  if (s.time >= end) {
    s.finished = true;
    return true;
  }
  return false;
}

/** Names that arrive first (ties all count). */
export function winners(s) {
  const times = runners(s).map(r => finishTime(r, s.length));
  const best = Math.min(...times);
  return runners(s).filter((_, i) => times[i] - best < 1e-9).map(r => r.name);
}

/** Names with the steepest moving segment, i.e. the largest speed while moving. */
export function fastest(s) {
  const best = Math.max(...runners(s).map(r => r.v));
  return runners(s).filter(r => best - r.v < 1e-9).map(r => r.name);
}

/** Is the learner's answer to the current question right? */
export function check(s) {
  const [a] = runners(s);
  switch (s.question) {
    case "fastest":
      return fastest(s).includes(s.answer);
    case "first":
      return winners(s).includes(s.answer);
    case "still":
      return s.answer === (stopWindow(a) ? "A" : "none");
    case "speedB":
      return Math.abs(s.guess - s.vB) < 0.051;
    case "avgA":
      return Math.abs(s.guess - averageSpeed(a, s.length)) <= 0.1 + 1e-9;
    default:
      return false;
  }
}
