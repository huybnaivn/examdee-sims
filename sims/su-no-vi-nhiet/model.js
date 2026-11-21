// Thermal expansion of solids and liquids (Vật lí, chương trình 2018).
//
// Solids, with α the coefficient of linear expansion (K⁻¹), to first order in αΔt:
//   rod    Δl = α·l₀·Δt
//   plate  ΔS ≈ 2α·S₀·Δt          (exactly S₀[(1 + αΔt)² − 1])
//   block  ΔV ≈ 3α·V₀·Δt, β ≈ 3α  (exactly V₀[(1 + αΔt)³ − 1])
// Liquids: ethanol uses ΔV = β·V₀·Δt; water uses a density table, V = V₀·ρ(t₀)/ρ(t), because water
// contracts from 0 to 4 °C. The expansion of the flask itself is ignored.
//
// Units: l₀ in m (Δl reported in mm), S₀ in cm², V₀ in cm³, temperatures in °C.

export const MATERIALS = [
  { id: "steel", name: "Thép", alpha: 11e-6 },
  { id: "aluminium", name: "Nhôm", alpha: 24e-6 },
  { id: "copper", name: "Đồng", alpha: 17e-6 },
  { id: "glass", name: "Thủy tinh", alpha: 9e-6 },
  // β of water is only shown for reference (at 20 °C); the volume comes from WATER_DENSITY.
  { id: "water", name: "Nước", beta: 2.1e-4, liquid: true, tmin: 0, tmax: 100 },
  { id: "alcohol", name: "Rượu (etanol)", beta: 1.1e-3, liquid: true, tmin: 0, tmax: 78 },
];
export const SOLIDS = MATERIALS.filter(m => !m.liquid);
export const LIQUIDS = MATERIALS.filter(m => m.liquid);

export const OBJECTS = [
  { id: "rod", label: "Thanh (nở dài)" },
  { id: "plate", label: "Tấm phẳng (nở diện tích)" },
  { id: "block", label: "Khối lập phương (nở khối)" },
  { id: "liquid", label: "Chất lỏng trong bình" },
];

// Density of pure water at 1 atm, g/cm³ (t in °C). Standard reference values, 5 significant figures.
export const WATER_DENSITY = [
  [0, 0.99984], [1, 0.9999], [2, 0.99994], [3, 0.99996], [4, 0.99997], [5, 0.99996], [6, 0.99994],
  [7, 0.9999], [8, 0.99985], [9, 0.99978], [10, 0.9997], [12, 0.9995], [15, 0.9991], [20, 0.99821],
  [25, 0.99705], [30, 0.99565], [35, 0.99403], [40, 0.99222], [45, 0.99022], [50, 0.98804],
  [60, 0.9832], [70, 0.97778], [80, 0.97182], [90, 0.96535], [100, 0.9584],
];

export const RAIL = { length: 12.5, gap: 6 }; // m, mm: a steel rail laid at t₀ with a 6 mm gap
export const BIMETAL = { top: "copper", bottom: "steel", length: 0.1, thickness: 1e-3 }; // m

export const initialState = () => ({
  object: "rod",
  solid: "steel",
  liquid: "water",
  l0: 10, // m
  s0: 400, // cm²
  v0: 500, // cm³
  t0: 20, // °C
  dT: 30, // °C, t = t₀ + Δt
  panel: "rail",
});

const byId = id => MATERIALS.find(m => m.id === id);
export const material = s => (s.object === "liquid" ? byId(s.liquid) ?? LIQUIDS[0] : byId(s.solid) ?? SOLIDS[0]);
export const materialIndex = s => MATERIALS.indexOf(material(s));

/** Water density (g/cm³) by linear interpolation in the table; t is clamped to 0…100 °C. */
export function waterDensity(t) {
  const T = WATER_DENSITY;
  if (!(t > T[0][0])) return T[0][1];
  for (let i = 1; i < T.length; i++) {
    const [t1, r1] = T[i];
    if (t <= t1) {
      const [t0, r0] = T[i - 1];
      return r0 + ((r1 - r0) * (t - t0)) / (t1 - t0);
    }
  }
  return T[T.length - 1][1];
}

/** Keep a liquid inside its liquid range: moves t₀ and then Δt. Mutates and returns s. */
export function fitLiquid(s) {
  if (s.object !== "liquid") return s;
  const m = material(s);
  s.t0 = Math.min(m.tmax, Math.max(m.tmin, s.t0));
  s.dT = Math.min(m.tmax - s.t0, Math.max(m.tmin - s.t0, s.dT));
  return s;
}

/**
 * What the learner sees. `size0` and `delta` are in the display units (m and mm for a rod, cm² for a plate,
 * cm³ for a block or a liquid); `linear` is the relative change of each length of a solid (αΔt), or ΔV/V₀ for a liquid.
 */
export function expansion(s) {
  const m = material(s);
  const dT = s.dT;
  if (s.object === "liquid") {
    const V0 = s.v0;
    const dV = m.id === "water" ? V0 * (waterDensity(s.t0) / waterDensity(s.t0 + dT) - 1) : m.beta * V0 * dT;
    return { kind: "volume", size0: V0, delta: dV, size: V0 + dV, linear: dV / V0, rel: dV / V0, coef: m.beta };
  }
  const a = m.alpha;
  if (s.object === "plate") return { kind: "area", size0: s.s0, delta: 2 * a * s.s0 * dT, size: s.s0 + 2 * a * s.s0 * dT, linear: a * dT, rel: 2 * a * dT, coef: 2 * a };
  if (s.object === "block") return { kind: "volume", size0: s.v0, delta: 3 * a * s.v0 * dT, size: s.v0 + 3 * a * s.v0 * dT, linear: a * dT, rel: 3 * a * dT, coef: 3 * a };
  const dl = a * s.l0 * dT; // m
  return { kind: "length", size0: s.l0, delta: dl * 1000, size: s.l0 + dl, linear: a * dT, rel: a * dT, coef: a };
}

/** Exact change for a solid that scales every length by (1 + αΔt): (1 + αΔt)^dim − 1, relative. */
export const exactRel = (alpha, dT, dim) => (1 + alpha * dT) ** dim - 1;

/** Gap left between two steel rails laid at t₀ with RAIL.gap, at t = t₀ + Δt (mm; ≤ 0 means they press together). */
export const railGap = dT => RAIL.gap - byId("steel").alpha * RAIL.length * dT * 1000;

/**
 * Bimetal strip of two equal layers (equal stiffness), total thickness h: curvature κ = 3(α_top − α_bottom)Δt / (2h), in m⁻¹.
 * κ > 0: the top layer is longer, so the strip curls downward, toward the bottom layer.
 */
export const bimetalCurvature = (alphaTop, alphaBottom, dT, h = BIMETAL.thickness) => (1.5 * (alphaTop - alphaBottom) * dT) / h;

/** Which layer the strip bends toward: "top", "bottom" or "none". It is always the layer that expands less. */
export function bendToward(alphaTop, alphaBottom, dT) {
  const k = bimetalCurvature(alphaTop, alphaBottom, dT);
  return k > 0 ? "bottom" : k < 0 ? "top" : "none";
}

/** Tip deflection (m) of a strip of length L clamped at one end: κL²/2 for small bending. */
export const bimetalDeflection = (k, L = BIMETAL.length) => (k * L * L) / 2;

export const ALPHA = id => byId(id).alpha;
