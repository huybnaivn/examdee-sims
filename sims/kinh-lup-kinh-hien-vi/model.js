// Optical instruments built from thin lenses. Lengths in cm, light travels to +x.
// Textbook sign convention: d > 0 real object, d′ > 0 real image, d′ < 0 virtual image.
// The eye sits right behind the last lens (eyepiece), Đ = 25 cm.
// Angular magnification G = α/α₀: α is the angle the final image subtends at the eye,
// α₀ the angle the object subtends seen without the instrument (at Đ, or directly for a far object).

export const DD = 25; // cm, khoảng nhìn rõ ngắn nhất
export const INSTRUMENTS = ["magnifier", "microscope", "telescope"];

export const initialState = () => ({
  instrument: 1, // 0 kính lúp, 1 kính hiển vi, 2 kính thiên văn
  magF: 5, // kính lúp: tiêu cự (cm)
  magD: 4, // kính lúp: khoảng cách vật (cm)
  micF1: 1, // kính hiển vi: tiêu cự vật kính (cm)
  micF2: 4, // tiêu cự thị kính (cm)
  micL: 16, // khoảng cách O₁O₂ (cm)
  micD1: 1.087, // khoảng cách vật đến vật kính (cm)
  telF1: 100, // kính thiên văn: tiêu cự vật kính (cm)
  telF2: 5, // tiêu cự thị kính (cm)
  telL: 104, // khoảng cách O₁O₂ (cm)
});

/** Thin lens: d′ = d·f/(d − f). Infinity in, f out; d = f gives Infinity. */
export function image(d, f) {
  if (!Number.isFinite(d)) return f;
  return Math.abs(d - f) <= 1e-9 * Math.abs(f) ? Infinity : (d * f) / (d - f); // rounding: d = f
}

/**
 * The whole chain. Returns per-lens { x (lens position), f, d, dImage } with x measured from the
 * first lens, the final image, and the magnification G (null when the eye cannot view the final image).
 */
export function solve(s) {
  const i = INSTRUMENTS[s.instrument] ?? "magnifier";
  if (i === "magnifier") {
    const f = s.magF;
    const d = s.magD;
    const di = image(d, f);
    const viewable = d <= f; // virtual image (or at infinity) on the object side
    return { kind: i, lenses: [{ x: 0, f, d, dImage: di }], final: di, virtual: di < 0 || !Number.isFinite(di), G: viewable ? DD / d : null, Ginf: DD / f };
  }
  if (i === "microscope") {
    const [f1, f2, L] = [s.micF1, s.micF2, s.micL];
    const d1 = s.micD1;
    const d1i = image(d1, f1);
    const d2 = L - d1i; // eyepiece object distance (negative: virtual object)
    const d2i = Number.isFinite(d1i) ? image(d2, f2) : f2; // parallel light from L1 focuses at F₂′
    const k1 = Number.isFinite(d1i) ? -d1i / d1 : Infinity;
    const delta = L - f1 - f2; // optical tube length F₁′F₂
    const viewable = Number.isFinite(d1i) && d2 > 0 && d2 <= f2 + 1e-12;
    return {
      kind: i,
      lenses: [{ x: 0, f: f1, d: d1, dImage: d1i }, { x: L, f: f2, d: d2, dImage: d2i }],
      final: d2i,
      virtual: viewable,
      k1,
      // α = |A₁B₁|/d₂ (eye at O₂), α₀ = AB/Đ
      G: viewable ? (Math.abs(k1) * DD) / d2 : null,
      Ginf: (delta * DD) / (f1 * f2),
      delta,
    };
  }
  const [f1, f2, L] = [s.telF1, s.telF2, s.telL];
  const d2 = L - f1; // intermediate image sits at F₁′
  const d2i = image(d2, f2);
  const viewable = d2 > 0 && d2 <= f2 + 1e-12;
  return {
    kind: "telescope",
    lenses: [{ x: 0, f: f1, d: Infinity, dImage: f1 }, { x: L, f: f2, d: d2, dImage: d2i }],
    final: d2i,
    virtual: viewable,
    // α = |A₁B₁|/d₂ = f₁·α₀/d₂
    G: viewable ? f1 / d2 : null,
    Ginf: f1 / f2,
  };
}

/** Settings for "ngắm chừng ở vô cực": the intermediate image (or the object) on the eyepiece focus. */
export function focusAtInfinity(s) {
  const i = INSTRUMENTS[s.instrument];
  if (i === "magnifier") s.magD = s.magF;
  else if (i === "microscope") {
    const d1i = s.micL - s.micF2; // A₁B₁ at F₂
    s.micD1 = d1i > s.micF1 ? (d1i * s.micF1) / (d1i - s.micF1) : s.micD1;
  } else s.telL = s.telF1 + s.telF2;
}

/**
 * Paraxial trace of a ray starting at x0 with height y0 and slope u through the lenses.
 * Returns the points where it meets each lens and the slope after the last one.
 */
export function trace(lenses, x0, y0, u) {
  const pts = [[x0, y0]];
  let [x, y] = [x0, y0];
  for (const l of lenses) {
    y += u * (l.x - x);
    x = l.x;
    pts.push([x, y]);
    u -= y / l.f;
  }
  return { pts, slope: u };
}
