// Alkali metals (and Ca, Mg) in cold water with phenolphthalein. Pure logic, no DOM.
//
// Molar masses are the rounded values used in Vietnamese textbook problems.
// `vigour` is an ordinal teaching scale (0–1) for the animation, not a measured rate:
// documented is K > Na > Li for the alkali metals, Ca reacts steadily, Mg barely reacts with cold water.

export const VM = 24.79; // molar volume of a gas at standard conditions (25 °C, 1 bar), L/mol

export const METALS = [
  { sym: "Li", name: "lithium", M: 7, group: 1, vigour: 0.3, density: 0.53, look: "Nổi, sủi bọt khí đều, không nóng chảy." },
  { sym: "Na", name: "sodium", M: 23, group: 1, vigour: 0.65, density: 0.97, look: "Nổi, nóng chảy thành giọt tròn, chạy nhanh trên mặt nước, có tiếng xèo xèo." },
  { sym: "K", name: "potassium", M: 39, group: 1, vigour: 1, density: 0.86, look: "Nóng chảy, chạy rất nhanh trên mặt nước, khí H₂ bốc cháy với ngọn lửa màu tím nhạt." },
  { sym: "Ca", name: "calcium", M: 40, group: 2, vigour: 0.3, density: 1.55, look: "Chìm xuống, sủi bọt khí đều; dung dịch hơi đục do Ca(OH)₂ ít tan." },
  { sym: "Mg", name: "magnesium", M: 24, group: 2, vigour: 0, density: 1.74, look: "Hầu như không thấy bọt khí: Mg phản ứng rất chậm với nước lạnh (phản ứng khi đun nóng)." },
];

export const RANK_OPTIONS = ["none", "Li<Na<K", "Li<K<Na", "Na<Li<K", "Na<K<Li", "K<Li<Na", "K<Na<Li"];
export const RANK_ANSWER = "Li<Na<K";

export const initialState = () => ({
  metal: 1, // index into METALS
  mass: 0.23, // g
  dropped: false,
  progress: 0, // 0–1 animation progress after the drop
  rank: "none", // learner's reactivity order, one of RANK_OPTIONS
  rankVerdict: -1, // −1 not checked, 0 wrong, 1 right
});

export const metal = i => METALS[Math.min(METALS.length - 1, Math.max(0, Math.round(i) || 0))];

/** Balanced equation in plain ASCII ("->" is the arrow, digits after a symbol are subscripts). */
export function equation(i) {
  const { sym, group } = metal(i);
  return group === 1 ? `2${sym} + 2H2O -> 2${sym}OH + H2` : `${sym} + 2H2O -> ${sym}(OH)2 + H2`;
}

/** Formula of the base formed. */
export const base = i => (metal(i).group === 1 ? `${metal(i).sym}OH` : `${metal(i).sym}(OH)2`);

/** Fraction of the metal that reacts within the observation (cold water). */
export const extent = i => (metal(i).vigour > 0 ? 1 : 0);

/** Amounts for `mass` grams. nH2 is for complete reaction, vH2 for what is seen to form, at standard conditions. */
export function amounts(i, mass) {
  const m = metal(i);
  const nMetal = Math.max(0, mass) / m.M;
  const nH2 = m.group === 1 ? nMetal / 2 : nMetal; // 2M → 1 H₂ ; M → 1 H₂
  return { nMetal, nH2, vH2: nH2 * VM * extent(i) };
}

/** Animation length after the drop, seconds: the more vigorous, the shorter. */
export const duration = i => 2 + 5 * (1 - metal(i).vigour);

/** Advance the animation. Returns true when it has just finished. */
export function step(s, dt) {
  if (!s.dropped) return false;
  const before = s.progress;
  s.progress = Math.min(1, Math.max(0, s.progress) + dt / duration(s.metal));
  return before < 1 && s.progress >= 1;
}

/** Turn "Ca(OH)2" style text into display text with subscripts and an arrow. */
export const sub = t => t.replace(/->/g, "→").replace(/([A-Za-z)])(\d+)/g, (_, a, d) => a + [...d].map(c => "₀₁₂₃₄₅₆₇₈₉"[c]).join(""));
