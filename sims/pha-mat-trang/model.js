// Phases of the Moon (KHTN 6). The Moon goes once round its orbit in one synodic month of 29,5 days.
// θ is the Sun–Earth–Moon elongation measured from new moon: θ = 360°·day / 29,5.
// Seen from Earth, the lit fraction of the disc is (1 − cos θ) / 2.

export const PERIOD = 29.5; // days, synodic month

// Grade 6 textbook names; each covers 45° of θ, centred on 0°, 45°, …, 315°.
export const PHASES = [
  "Không trăng (trăng mới)",
  "Trăng lưỡi liềm đầu tháng",
  "Trăng bán nguyệt đầu tháng",
  "Trăng khuyết đầu tháng",
  "Trăng tròn",
  "Trăng khuyết cuối tháng",
  "Trăng bán nguyệt cuối tháng",
  "Trăng lưỡi liềm cuối tháng",
];

export const initialState = () => ({
  day: 4.5, // days since new moon
  speed: 2, // days per second while playing
  quiz: false, // quiz mode: place the Moon to show the asked phase
  target: 6, // index of the asked phase (0–7)
  solved: false, // the asked phase has been shown
});

const mod = (x, m) => ((x % m) + m) % m;

/** Day folded into [0, 29,5); a forged NaN becomes 0. */
export const wrapDay = day => (Number.isFinite(day) ? mod(day, PERIOD) : 0);

/** Elongation θ in degrees, 0 ≤ θ < 360. */
export const angleOf = day => (360 * wrapDay(day)) / PERIOD;

/** Day of the month at elongation θ (degrees). */
export const dayOf = deg => (mod(deg, 360) / 360) * PERIOD;

/** Fraction of the disc seen lit from Earth, 0 (new) to 1 (full). */
export const litFraction = deg => (1 - Math.cos((deg * Math.PI) / 180)) / 2;

/** Index into PHASES for elongation θ (degrees). */
export const phaseIndex = deg => Math.floor(mod(deg + 22.5, 360) / 45) % 8;

/**
 * Which side of the disc is lit for an observer in the northern hemisphere:
 * "right" while waxing (0° < θ < 180°), "left" while waning, "none" at new moon, "all" at full moon.
 */
export function litSide(deg) {
  const a = mod(deg, 360);
  if (a < 1e-9 || 360 - a < 1e-9) return "none";
  if (Math.abs(a - 180) < 1e-9) return "all";
  return a < 180 ? "right" : "left";
}

/** Lunar calendar date: mùng 1 at new moon, so full moon (day 14,75) falls on ngày 15. */
export const lunarDate = day => Math.floor(wrapDay(day)) + 1;

export const lunarLabel = day => {
  const d = lunarDate(day);
  return d <= 10 ? `mùng ${d}` : `ngày ${d}`;
};

/** Asked phase index, safe against a forged state. */
export const targetOf = s => Math.min(7, Math.max(0, Math.floor(s.target) || 0));

export const matches = s => phaseIndex(angleOf(s.day)) === targetOf(s);

export function step(s, dt) {
  s.day = wrapDay(s.day + dt * s.speed);
}

/** A new asked phase, different from the current one; `random` returns numbers in [0, 1). */
export function newQuestion(s, random = Math.random) {
  const now = targetOf(s);
  s.target = (now + 1 + Math.floor(random() * 7)) % 8;
  s.solved = false;
  return s.target;
}
