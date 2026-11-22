// A wooden block pulled with a spring scale (lực kế) across a horizontal surface.
// The hand pulls harder and harder (RAMP newtons per second) while the block stays put: static friction
// equals the pull. When the pull passes the limit μn·N the block starts to slide; from then on the hand
// keeps it moving at a steady speed, so the scale reads the sliding friction μt·N (KHTN 6: kéo đều).
// N = P = 10·m (g taken as 10 N/kg, as in the textbook).

// Coefficients for a dry wooden block, typical classroom values (rounded):
// μn static, μt sliding, μl rolling (block on round rollers).
export const SURFACES = {
  kinh: { name: "Mặt kính", muS: 0.25, muK: 0.2, muR: 0.005 },
  go: { name: "Mặt gỗ", muS: 0.45, muK: 0.35, muR: 0.01 },
  tham: { name: "Thảm", muS: 0.6, muK: 0.5, muR: 0.04 },
  giay: { name: "Giấy nhám", muS: 0.8, muK: 0.65, muR: 0.03 },
};
export const ROUGHNESS = ["kinh", "go", "tham", "giay"]; // smoothest to roughest = smallest to largest friction
export const G = 10; // N/kg
export const RAMP = 2; // N/s, how fast the pull grows before the block moves
export const SPEED = 0.1; // m/s, steady sliding speed
export const TRACK = 0.4; // m the block travels before the run ends
export const TAU = 0.12; // s, how fast the scale settles from the peak to the sliding value

// The initial picture is a finished run on wood (so the graph is not empty): ▶ Chạy pulls again from rest.
export function initialState() {
  const s = {
    surface: "go",
    support: "wide", // "wide" (mặt rộng) | "narrow" (mặt hẹp) | "rollers" (đặt trên con lăn)
    mass: 0.5, // kg
    time: 0, // s since the pull started
    fKinh: 0, // last measured sliding friction on each surface (N), 0 = not measured yet
    fGo: 0,
    fTham: 0,
    fGiay: 0,
    rank1: "", // the learner's ranking, smallest friction first
    rank2: "",
    rank3: "",
    rank4: "",
    verdict: "", // "" | "right" | "wrong", result of the last ranking check
  };
  s.time = endTime(s);
  s.fGo = moving(s);
  return s;
}

export const MEASURED_KEY = { kinh: "fKinh", go: "fGo", tham: "fTham", giay: "fGiay" };

export const normal = s => s.mass * G;

/** Largest pull the block can take without moving (N). On rollers it rolls as soon as rolling friction is beaten. */
export const maxStatic = s => (s.support === "rollers" ? SURFACES[s.surface].muR : SURFACES[s.surface].muS) * normal(s);

/** Friction while moving (N): sliding μt·N, or rolling μl·N on rollers. Contact area does not enter. */
export const moving = s => (s.support === "rollers" ? SURFACES[s.surface].muR : SURFACES[s.surface].muK) * normal(s);

/** Friction for a given pull F on a block at rest: static friction matches F up to the limit. */
export function frictionFor(s, F) {
  const limit = maxStatic(s);
  return F <= limit ? { force: F, kind: "static", slides: false } : { force: moving(s), kind: s.support === "rollers" ? "rolling" : "sliding", slides: true };
}

/** Moment the block starts to move (s). */
export const startTime = s => maxStatic(s) / RAMP;
/** Moment the run ends (s). */
export const endTime = s => startTime(s) + TRACK / SPEED;

/** Spring-scale reading at time t (N). */
export function pullAt(s, t) {
  const t0 = startTime(s);
  if (t <= t0) return RAMP * t;
  const fs = maxStatic(s);
  const fk = moving(s);
  return fk + (fs - fk) * Math.exp(-(t - t0) / TAU);
}

/** Block displacement at time t (m). */
export const positionAt = (s, t) => Math.min(TRACK, Math.max(0, t - startTime(s)) * SPEED);

/** Phase at the current time: "static", "moving" or "done". */
export function phase(s) {
  if (s.time <= startTime(s)) return "static";
  return s.time >= endTime(s) ? "done" : "moving";
}

export function step(s, dt) {
  s.time = Math.min(endTime(s), s.time + dt);
  return s;
}

/** True when rank1..rank4 list the surfaces from the smallest to the largest friction. */
export const rankingRight = s => [s.rank1, s.rank2, s.rank3, s.rank4].join() === [...ROUGHNESS].sort((a, b) => SURFACES[a].muK - SURFACES[b].muK).join();

/** Keep forged values sane: time inside the run, measurements non-negative. */
export function tidy(s) {
  if (!Object.hasOwn(SURFACES, s.surface)) s.surface = "go";
  if (!["wide", "narrow", "rollers"].includes(s.support)) s.support = "wide";
  if (!(s.mass > 0)) s.mass = 0.5;
  s.time = Number.isFinite(s.time) ? Math.min(Math.max(s.time, 0), endTime(s)) : 0;
  for (const k of Object.values(MEASURED_KEY)) s[k] = Number.isFinite(s[k]) ? Math.min(Math.max(s[k], 0), 100) : 0;
  if (!["", "right", "wrong"].includes(s.verdict)) s.verdict = "";
  return s;
}
