// Reduced eye: one thin lens (thể thủy tinh) 1,5 cm in front of the retina (màng lưới).
// Distances in cm, powers (độ tụ) in dioptres: D = 1/f with f in metres, so D = 100/f(cm).
// A vergence V = 1/d (dp, d in m) describes how strongly light from an object diverges.
// The eye sees sharply when the light reaching it has U′ = 1/d − D_kính between
// 1/OC_v (eye relaxed) and 1/OC_c (eye fully accommodated). The corrective lens touches the eye.

export const OV = 1.5; // cm, lens to retina
export const DD = 25; // cm, khoảng nhìn rõ ngắn nhất of a normal eye (Đ)
export const AMP = 4; // dp, accommodation amplitude assumed for the hyperopic eye
export const TOLERANCE = 0.15; // dp, a lens this close to the textbook correction counts as correct
export const EYES = ["normal", "myopia", "hyperopia"];
// object distances offered (cm); 0 stands for "at infinity"
export const DISTANCES = [0, 500, 200, 100, 50, 40, 30, 25, 20, 15, 12, 10];

export const initialState = () => ({
  eye: "myopia",
  farPoint: 50, // OC_v of the myopic eye (cm)
  nearMyopia: 12, // OC_c of the myopic eye (cm)
  nearHyper: 50, // OC_c of the hyperopic eye (cm)
  distance: 0, // object distance d (cm), 0 = vô cực
  lens: 0, // corrective lens power D_kính (dp), 0 = không đeo kính
});

/** Far and near limits as vergences (dp): 1/OC_v and 1/OC_c. 1/OC_v < 0 means a virtual far point. */
export function limits(s) {
  if (s.eye === "myopia") return { far: 100 / s.farPoint, near: 100 / s.nearMyopia };
  if (s.eye === "hyperopia") return { far: 100 / s.nearHyper - AMP, near: 100 / s.nearHyper };
  return { far: 0, near: 100 / DD };
}

/** Vergence of the object, 1/d (dp). */
export const objectVergence = s => (s.distance > 0 ? 100 / s.distance : 0);
/** U′ = 1/d − D_kính: what the eye has to focus after the corrective lens. */
export const effectiveVergence = s => objectVergence(s) - s.lens;

export function isSharp(s) {
  const { far, near } = limits(s);
  const u = effectiveVergence(s);
  return u >= far - 1e-9 && u <= near + 1e-9;
}

/** Eye power P (dp): accommodates as far as it can towards 1/f = 1/d′ + 1/OV, never beyond its range. */
export function eyePower(s) {
  const { far, near } = limits(s);
  return 100 / OV + Math.min(near, Math.max(far, effectiveVergence(s)));
}

/** Eye focal length (cm). */
export const eyeFocal = s => 100 / eyePower(s);

/** Where the eye lens forms the image, measured from the lens (cm). OV when sharp. */
export const imageDistance = s => 100 / (eyePower(s) - effectiveVergence(s));

/** Image position relative to the retina (cm): < 0 in front of it, > 0 behind it. */
export const retinaOffset = s => imageDistance(s) - OV;

/** Textbook correction: myopia D = −1/OC_v; hyperopia D = 1/Đ − 1/OC_c; normal eye none. */
export function correctLens(s) {
  if (s.eye === "myopia") return -100 / s.farPoint;
  if (s.eye === "hyperopia") return 100 / DD - 100 / s.nearHyper;
  return 0;
}

export const isCorrect = s => Math.abs(s.lens - correctLens(s)) <= TOLERANCE + 1e-9;

/** Range of object distances seen sharply with the lens on (cm). far = Infinity when it reaches infinity; null when nothing real is sharp. */
export function seenRange(s) {
  const { far, near } = limits(s);
  const vNear = near + s.lens;
  const vFar = far + s.lens;
  if (vNear <= 0) return null;
  return { near: 100 / vNear, far: vFar <= 0 ? Infinity : 100 / vFar };
}
