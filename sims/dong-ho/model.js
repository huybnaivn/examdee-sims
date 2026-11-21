// Analog clock. Time of day is kept as hour (0–23) and minute (0–59); angles are in degrees,
// clockwise from 12 o'clock.

export const DAY = 24 * 60;

export const initialState = () => ({
  mode: "read", // "read" | "set" | "elapsed"
  hour: 7,
  minute: 15,
  targetHour: 8, // set mode: the time to show (1–12)
  targetMinute: 45,
  solved: false, // set mode: target reached already (one goal event per target)
  startHour: 7, // elapsed mode: start time (0–23)
  startMinute: 30,
});

const wrap = (v, n) => ((v % n) + n) % n;
const int = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number.isFinite(v) ? v : lo)));

/** Minutes since midnight, made whole and wrapped into one day. */
export const total = (h, m) => wrap(int(h, -1e6, 1e6) * 60 + int(m, -1e6, 1e6), DAY);
export const split = t => ({ hour: Math.floor(wrap(t, DAY) / 60), minute: wrap(t, DAY) % 60 });

export const minuteAngle = m => wrap(m, 60) * 6;
/** The hour hand turns 30° an hour and 0,5° a minute. */
export const hourAngle = (h, m) => wrap(h, 12) * 30 + wrap(m, 60) * 0.5;

/** Part of the day as in the Vietnamese primary textbook. */
export function period(h24) {
  if (h24 === 0 || h24 >= 22) return "đêm";
  if (h24 <= 10) return "sáng";
  if (h24 <= 12) return "trưa";
  if (h24 <= 18) return "chiều";
  return "tối";
}

/** 24-hour → 12-hour with the part of the day: 19 → { hour: 7, period: "tối" }. */
export const to12 = h24 => ({ hour: wrap(h24, 12) || 12, period: period(wrap(h24, 24)) });

/** 12-hour with the part of the day → 24-hour: 7 "tối" → 19, 12 "đêm" → 0. */
export function to24(h12, p) {
  const base = wrap(h12, 12);
  return [base, base + 12].find(h => period(h) === p) ?? base;
}

/** Reading in words: "7 giờ 15 phút"; past the half hour also "8 giờ kém 15 phút". */
export function words(h24, m) {
  const h = wrap(h24, 12) || 12;
  const main = m === 0 ? `${h} giờ` : `${h} giờ ${m} phút`;
  const half = m === 30 ? `${h} giờ rưỡi` : null;
  const before = m > 30 ? `${(h % 12) + 1} giờ kém ${60 - m} phút` : null;
  return { main, alt: half ?? before };
}

/** Elapsed time from start to end, going forward (through noon or midnight if needed). */
export const elapsed = (sh, sm, eh, em) => wrap(total(eh, em) - total(sh, sm), DAY);

export const duration = t => {
  const h = Math.floor(t / 60);
  const m = t % 60;
  if (!h) return `${m} phút`;
  return m ? `${h} giờ ${m} phút` : `${h} giờ`;
};

/** An analog face cannot tell morning from evening: compare on 12 hours. */
export const matches = (h, m, th, tm) => wrap(h, 12) === wrap(th, 12) && m === tm;

/**
 * Turn the minute hand to `deg`. Passing 12 carries the hour forward or back,
 * since a real clock's hands are geared together. Returns the new total minutes.
 */
export function dragMinute(t, deg) {
  const m = wrap(Math.round(deg / 6), 60);
  let d = m - wrap(t, 60);
  if (d > 30) d -= 60;
  if (d <= -30) d += 60;
  return wrap(t + d, DAY);
}

/** Turn the hour hand to `deg`; the minute hand follows. Crossing 12 moves on to the next half day. */
export function dragHour(t, deg) {
  const k = wrap(Math.round(deg * 2), 720); // minutes into the 12-hour round
  let d = k - wrap(t, 720);
  if (d > 360) d -= 720;
  if (d <= -360) d += 720;
  return wrap(t + d, DAY);
}

/** A new target: whole hour 1–12 and a multiple of 5 minutes, different from `avoid`. */
export function newTarget(rand = Math.random, avoid) {
  for (;;) {
    const hour = 1 + Math.floor(rand() * 12);
    const minute = 5 * Math.floor(rand() * 12);
    if (!avoid || !matches(hour, minute, avoid.hour, avoid.minute)) return { hour, minute };
  }
}

export const pad = n => String(n).padStart(2, "0");
