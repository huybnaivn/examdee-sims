// Titration of a monoprotic acid (HCl or CH₃COOH) in the flask with NaOH from the burette, at 25 °C.
//
// pH comes from the exact charge balance  [H⁺] + [Na⁺] = [OH⁻] + [A⁻]  with
//   [Na⁺] = C_b·V_b / V,   [A⁻] = α·C_a·V_a / V,   α = K_a / (K_a + [H⁺])  (α = 1 for the strong acid),
// solved for [H⁺] by bisection. No approximation is switched on or off along the curve, so the same
// function gives the start, the buffer region, the equivalence point and the excess-base branch.
// Activity coefficients are taken as 1 and the volumes as additive, as in the textbook.

export const KW = 1e-14; // (mol/L)², 25 °C
export const KA_ACETIC = 1.75e-5; // CH₃COOH, 25 °C
export const DROP = 0.05; // mL, one drop from the burette (20 drops per mL)
export const BURETTE = 50; // mL
export const TOLERANCE = 0.05; // mL: stopping this close to the equivalence volume counts as a hit

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const ACIDS = {
  strong: { formula: "HCl", ka: Infinity },
  weak: { formula: "CH₃COOH", ka: KA_ACETIC },
};

// Colour-change ranges (pH) commonly given for these indicators; colours are [r, g, b] below `lo` and above `hi`.
export const INDICATORS = {
  phenolphthalein: { name: "Phenolphthalein", lo: 8.2, hi: 10, colors: [[240, 246, 255], [233, 64, 150]], names: ["không màu", "hồng nhạt", "hồng"] },
  methylOrange: { name: "Methyl da cam", lo: 3.1, hi: 4.4, colors: [[226, 48, 48], [250, 204, 40]], names: ["đỏ", "da cam", "vàng"] },
  litmus: { name: "Quỳ tím", lo: 6, hi: 8, colors: [[222, 58, 70], [52, 92, 210]], names: ["đỏ", "tím", "xanh"] },
};

export const initialState = () => ({
  acid: "strong",
  ca: 0.12, // mol/L, acid in the flask
  va: 20, // mL of acid
  cb: 0.1, // mol/L, NaOH in the burette
  indicator: "phenolphthalein",
  showCurve: true, // draw the whole theoretical curve
  added: 0, // mL of NaOH run in so far
  ended: false, // the learner has declared the end point
});

export const acidOf = s => ACIDS[s.acid] ?? ACIDS.strong;
export const indicatorOf = s => INDICATORS[s.indicator] ?? INDICATORS.phenolphthalein;
/** mL of titrant added, whatever the state says. */
export const titrant = s => clamp(s.added, 0, BURETTE);

/** C₁V₁ = C₂V₂: volume of base (mL) that exactly neutralises the acid. */
export const equivalenceVolume = s => (s.ca * s.va) / s.cb;

/** pH in the flask after vb mL of base. */
export function pHAt(s, vb) {
  const total = s.va + vb;
  const acid = (s.ca * s.va) / total; // analytical concentration of the acid, mol/L
  const sodium = (s.cb * vb) / total;
  const ka = acidOf(s).ka;
  // charge imbalance, rising with [H⁺]; its zero is the answer
  const f = h => h + sodium - KW / h - (ka === Infinity ? acid : (acid * ka) / (ka + h));
  let lo = -1; // pH bounds
  let hi = 15;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (f(10 ** -mid) > 0) lo = mid; // too much H⁺: the pH is higher
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export const pH = s => pHAt(s, titrant(s));
/** Signed distance from the equivalence point (mL); positive = overshot. */
export const error = s => titrant(s) - equivalenceVolume(s);
export const onTarget = s => Math.abs(error(s)) <= TOLERANCE + 1e-9;

/** Run in `volume` mL more base. Returns the volume actually added. */
export function addTitrant(s, volume) {
  if (s.ended || !(volume > 0)) return 0;
  const before = titrant(s);
  s.added = Math.round(Math.min(BURETTE, before + volume) * 100) / 100; // stay on the 0.01 mL grid
  return s.added - before;
}

/** Back to a full burette and a fresh flask. */
export function restart(s) {
  s.added = 0;
  s.ended = false;
  return s;
}

/** Declare the end point. The numbers are what the `titration-ended` result reports. */
export function endTitration(s) {
  s.ended = true;
  return { volumeAdded: titrant(s), pH: pH(s), equivalenceVolume: equivalenceVolume(s), error: error(s) };
}

/**
 * Colour of an indicator at a pH: `t` is 0 below the range, 1 above it and in between inside,
 * `name` the Vietnamese colour name, `rgb` the blended colour.
 */
export function indicatorColor(id, pHValue) {
  const ind = INDICATORS[id] ?? INDICATORS.phenolphthalein;
  const t = clamp((pHValue - ind.lo) / (ind.hi - ind.lo), 0, 1);
  return {
    t,
    name: ind.names[t <= 0 ? 0 : t >= 1 ? 2 : 1],
    rgb: ind.colors[0].map((c, k) => Math.round(c + (ind.colors[1][k] - c) * t)),
  };
}
