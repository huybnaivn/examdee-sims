// Pressure on a surface: p = F / S. KHTN 8 takes the weight as P = 10·m, so g = 10 N/kg here.
// The learner drops things on soft ground, left and right, and compares how deep they sink.

export const G = 10; // N/kg

// A brick of 20 cm × 10 cm × 5 cm. w = width seen from the front, d = depth, h = height (cm).
export const BRICK_FACES = {
  large: { label: "Nằm (mặt 20 × 10 cm)", w: 20, d: 10, h: 5 },
  medium: { label: "Nghiêng (mặt 20 × 5 cm)", w: 20, d: 5, h: 10 },
  small: { label: "Dựng đứng (mặt 10 × 5 cm)", w: 10, d: 5, h: 20 },
};
export const FACE_ORDER = ["large", "medium", "small"];

// Total area the child presses on the ground, cm².
export const SHOES = {
  feet: { label: "Giày thể thao", area: 300 }, // about 150 cm² per shoe
  heels: { label: "Kiễng trên gót giày nhọn", area: 2 }, // two heel tips of 1 cm²
  stilts: { label: "Đi cà kheo", area: 20 }, // two tips of 10 cm²
  skis: { label: "Ván trượt tuyết", area: 2560 }, // two skis of 160 cm × 8 cm
};
export const SHOE_ORDER = ["feet", "heels", "stilts", "skis"];

export const ELEPHANT_FOOT = 1000; // cm² per foot, four feet on the ground
export const TANK = { mass: 40000, area: 40000 }; // 40 t on two tracks of 4 m × 0,5 m

export const OBJECTS = { brick: "Viên gạch", kid: "Bạn nhỏ", elephant: "Chú voi", tank: "Xe tăng" };
export const OBJECT_ORDER = ["brick", "kid", "elephant", "tank"];

// soft: how easily the ground gives way (0 = it does not dent at all).
export const GROUNDS = {
  sand: { label: "Cát", soft: 1 },
  snow: { label: "Tuyết", soft: 1.25 },
  mud: { label: "Bùn", soft: 1.1 },
  concrete: { label: "Bê tông", soft: 0 },
};

export const RANGE = { brickMass: [1, 5], brickCount: [1, 3], kidMass: [20, 90], elephantMass: [3000, 6000] };

export const initialState = () => ({
  ground: "sand",
  slotA: "kid", // what stands on the left: an OBJECTS key or "none"
  slotB: "elephant", // what stands on the right
  brickFace: "large",
  brickCount: 1, // bricks stacked on top of each other
  brickMass: 2, // kg, one brick
  kidMass: 50, // kg
  kidShoes: "heels",
  elephantMass: 4000, // kg
  guess: "none", // the learner's prediction: "A", "B", "equal" or "none"
  challenge: "none",
});

const bounded = (v, [lo, hi]) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo);

export const weight = m => G * m; // N
export const cm2ToM2 = s => s / 1e4; // 1 m² = 10 000 cm²
export const pressure = (force, areaM2) => force / areaM2; // N/m² = Pa

/** Mass (kg) and contact area (cm²) of one kind of object with the current settings. */
export function contact(s, object) {
  if (object === "brick") {
    const face = BRICK_FACES[s.brickFace] ?? BRICK_FACES.large;
    const count = Math.round(bounded(s.brickCount, RANGE.brickCount));
    return { mass: bounded(s.brickMass, RANGE.brickMass) * count, areaCm2: face.w * face.d };
  }
  if (object === "kid") {
    return { mass: bounded(s.kidMass, RANGE.kidMass), areaCm2: (SHOES[s.kidShoes] ?? SHOES.feet).area };
  }
  if (object === "elephant") {
    return { mass: bounded(s.elephantMass, RANGE.elephantMass), areaCm2: 4 * ELEPHANT_FOOT };
  }
  if (object === "tank") return { mass: TANK.mass, areaCm2: TANK.area };
  return null;
}

// How deep it sinks, as a fraction 0…1 of the deepest dent the picture can show. Pressures here
// run from 1 kPa (a flat brick) to 4,5 MPa (a heel tip), so the scale is logarithmic: an
// illustration of "more pressure, deeper dent", not a law of physics.
export const P_LOW = 10 ** 2.5; // Pa, no visible dent below this
export const P_HIGH = 10 ** 7; // Pa, the deepest dent drawn
export function depthIndex(p, ground = "sand") {
  const soft = (GROUNDS[ground] ?? GROUNDS.sand).soft;
  if (!(p > 0) || soft === 0) return 0;
  const t = (Math.log10(p) - Math.log10(P_LOW)) / (Math.log10(P_HIGH) - Math.log10(P_LOW));
  return Math.min(1, Math.max(0, t * soft));
}

/** Everything about one side ("A" left, "B" right), or null when nothing stands there. */
export function solve(s, slot) {
  const object = slot === "A" ? s.slotA : s.slotB;
  const c = contact(s, object);
  if (!c) return null;
  const force = weight(c.mass);
  const area = cm2ToM2(c.areaCm2);
  const p = pressure(force, area);
  return { object, mass: c.mass, force, areaCm2: c.areaCm2, area, pressure: p, depth: depthIndex(p, s.ground) };
}

/** Which side presses harder. "equal" when the two pressures are within 5 %. */
export function compare(s) {
  const a = solve(s, "A");
  const b = solve(s, "B");
  if (!a || !b) return null;
  const ratio = Math.max(a.pressure, b.pressure) / Math.min(a.pressure, b.pressure);
  const deeper = ratio < 1.05 ? "equal" : a.pressure > b.pressure ? "A" : "B";
  return { a, b, ratio, deeper };
}

/** Largest pressure a stack of bricks can reach: 3 of the heaviest, standing on the small face. */
export const maxBrickPressure = () =>
  pressure(weight(RANGE.brickMass[1] * RANGE.brickCount[1]), cm2ToM2(BRICK_FACES.small.w * BRICK_FACES.small.d));

export const CHALLENGES = {
  none: "Tự do khám phá",
  "kid-beats-elephant": "Làm cho bạn nhỏ lún sâu hơn chú voi",
  "equal-different": "Hai bên nặng khác nhau mà lún bằng nhau",
  "brick-max": "Làm chồng gạch lún sâu nhất có thể",
};

export function challengeMet(s, id) {
  const c = compare(s);
  if (id === "kid-beats-elephant") {
    if (!c) return false;
    const kid = c.a.object === "kid" ? c.a : c.b.object === "kid" ? c.b : null;
    const elephant = c.a.object === "elephant" ? c.a : c.b.object === "elephant" ? c.b : null;
    return !!kid && !!elephant && kid.pressure > elephant.pressure * 1.05;
  }
  if (id === "equal-different") {
    if (!c || c.deeper !== "equal" || c.a.object === c.b.object) return false;
    return Math.max(c.a.force, c.b.force) / Math.min(c.a.force, c.b.force) >= 2;
  }
  if (id === "brick-max") {
    return ["A", "B"].some(slot => {
      const r = solve(s, slot);
      return r?.object === "brick" && r.pressure >= maxBrickPressure() * 0.99;
    });
  }
  return false;
}

/** Put an object on one side. The same object cannot stand on both sides at once. */
export function place(s, slot, object) {
  const key = slot === "A" ? "slotA" : "slotB";
  const other = slot === "A" ? "slotB" : "slotA";
  if (object !== "none" && s[other] === object) s[other] = "none";
  s[key] = object in OBJECTS ? object : "none";
  return s;
}

export const nextOf = (order, key) => order[(order.indexOf(key) + 1) % order.length];
