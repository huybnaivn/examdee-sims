// Density D = m/V. Masses in g, volumes in cm³ (1 mL = 1 cm³), D in g/cm³; 1 g/cm³ = 1000 kg/m³.

// Approximate values from the KHTN density table (kg/m³). Plastic varies; 1200 is a hard plastic.
export const MATERIALS = {
  sat: { label: "Sắt", density: 7800 },
  nhom: { label: "Nhôm", density: 2700 },
  da: { label: "Đá", density: 2600 },
  nhua: { label: "Nhựa", density: 1200 },
  go: { label: "Gỗ", density: 800 },
};

// Mystery objects, all painted the same colour. Volumes give whole-gram masses.
export const OBJECTS = {
  A: { material: "sat", volume: 10 },
  B: { material: "sat", volume: 25 },
  C: { material: "nhom", volume: 20 },
  D: { material: "nhom", volume: 40 },
  E: { material: "da", volume: 15 },
  F: { material: "da", volume: 30 },
  G: { material: "nhua", volume: 30 },
  H: { material: "go", volume: 25 },
  I: { material: "go", volume: 50 },
};
export const IDS = Object.keys(OBJECTS);

export const CYLINDER = { capacity: 100, division: 1, start: 50 }; // mL: GHĐ, ĐCNN, water before (method "cylinder")

export const initialState = () => ({
  object: "C",
  method: "cylinder", // "cylinder": V = V₂ − V₁; "overflow": V = water that spilled into the cylinder
  stage: 0, // 0 nothing measured, 1 weighed, 2 volume measured too
  measured: 0, // bit i set: object IDS[i] has been fully measured
  guess: "nhom",
  checked: false, // the guess has been checked against the object
});

export const kgPerM3 = gPerCm3 => gPerCm3 * 1000;
export const gPerCm3 = kgM3 => kgM3 / 1000;
export const density = (mass, volume) => mass / volume; // g/cm³

/** Mass the scale shows (g, resolution 1 g). */
export const massOf = id => Math.round(gPerCm3(MATERIALS[OBJECTS[id].material].density) * OBJECTS[id].volume);

/** Cylinder readings for an object: before and after (mL) and the volume they give (cm³). */
export function readings(id, method) {
  const v = OBJECTS[id].volume;
  // Readings are taken to the smallest division of the cylinder.
  const snap = x => Math.round(x / CYLINDER.division) * CYLINDER.division;
  if (method === "overflow") return { before: 0, after: snap(v), volume: snap(v) };
  const before = CYLINDER.start;
  const after = snap(before + v);
  return { before, after, volume: after - before };
}

/** Full measurement of one object: mass (g), volume (cm³), D (g/cm³ and kg/m³). */
export function measure(id, method) {
  const m = massOf(id);
  const r = readings(id, method);
  const d = density(m, r.volume);
  return { mass: m, ...r, density: d, densityKg: kgPerM3(d) };
}

/** Material whose table value is nearest to D (kg/m³), or null when none is within tol. */
export function identify(densityKg, tol = 0.02) {
  let best = null;
  for (const [key, m] of Object.entries(MATERIALS)) {
    const err = Math.abs(densityKg - m.density) / m.density;
    if (err <= tol && (!best || err < best.err)) best = { key, err };
  }
  return best?.key ?? null;
}

export const stageOf = s => (Number.isInteger(s.stage) ? Math.min(2, Math.max(0, s.stage)) : 0);
export const measuredIds = s => IDS.filter((_, i) => ((Number.isInteger(s.measured) ? s.measured : 0) >> i) & 1);
export const bitOf = id => 1 << IDS.indexOf(id);
export const isCorrect = s => s.guess === OBJECTS[s.object]?.material;
