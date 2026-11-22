// Three ways heat travels: conduction, convection, radiation. SI units, temperatures in °C.
//
// CONDUCTION. Four long rods, one end held at T_HOT from time 0, the rest starting at T_ROOM,
// no heat lost through the sides (one-dimensional, semi-infinite rod):
//     T(x, t) = T_ROOM + (T_HOT − T_ROOM) · erfc( x / (2·√(α·t)) ),   α = k / (ρ·c)
// so the time for the point x to reach a temperature T is  t = x² / (4·α·z²)  with erfc(z) = (T − T_ROOM)/(T_HOT − T_ROOM).
// Typical handbook values (k in W/(m·K), ρ in kg/m³, c in J/(kg·K)). For these four materials the
// order by diffusivity α is the same as the order by conductivity k.
export const MATERIALS = [
  { id: "copper", name: "Đồng", k: 400, rho: 8960, c: 380 },
  { id: "aluminium", name: "Nhôm", k: 237, rho: 2700, c: 880 },
  { id: "iron", name: "Sắt", k: 80, rho: 7870, c: 460 },
  { id: "glass", name: "Thủy tinh", k: 1, rho: 2500, c: 840 },
];
export const T_ROOM = 25; // °C
export const T_HOT = 400; // °C, the heated end
export const T_MELT = 60; // °C, the wax lets go

// CONVECTION. Water in a beaker, depth DEPTH. A parcel ΔT warmer than its surroundings is lighter by
// ρ·β·ΔT and gets an upward acceleration a = g·β·ΔT. Speed of the circulation: the buoyancy scale
// v = √(g·β·ΔT·h). Flow pattern: a prescribed incompressible cell (or two) that rises over the heater.
// Heating at the top gives no flow: the warm water is already on top.
export const G = 9.81; // m/s²
export const BETA = 2.1e-4; // 1/K, thermal expansion of water near 20 °C
export const DEPTH = 0.1; // m

// RADIATION. Two equal thin plates, one black and one white, lit by a lamp with irradiance E (W/m²):
//     C · dT/dt = a·E·A − h·A_loss·(T − T_ROOM)
// a = fraction of the light absorbed (the rest is reflected); loss to the room taken as proportional
// to the temperature difference.
export const ABSORB = { black: 0.95, white: 0.25 };
export const PLATE = { area: 0.01, lossArea: 0.02, h: 10, heatCapacity: 50 }; // m², m², W/(m²·K), J/K
export const REPORT_TIME = 300; // s of lighting after which the radiation result is recorded
export const STILL_TIME = 15; // s after which "no convection" is recorded when heating from the top

export const initialState = () => ({
  mode: "conduction", // "conduction" | "convection" | "radiation"
  speed: 1, // playback speed for conduction and radiation
  time: 0, // s since the heat source was switched on
  reported: false, // the result of this run has been sent
  distance: 6, // cm from the hot end to the wax
  prediction: "", // material indices in the predicted order of falling, e.g. "0123"
  heater: "left", // "left" | "center" | "top"
  deltaT: 10, // K, how much warmer the heated water is
  mx: 0.25, // tracer grain, fractions of the beaker (x to the right, y up)
  my: 0.25,
  loopAngle: 0, // rad the tracer has turned around the centre of its cell
  loopTime: 0, // s for its first full loop, 0 until then
  irradiance: 800, // W/m²
  tBlack: T_ROOM, // °C
  tWhite: T_ROOM,
});

// ---------- conduction ----------
export const diffusivity = m => m.k / (m.rho * m.c);

/** Complementary error function, Abramowitz & Stegun 7.1.26 (absolute error < 1.5e-7), x ≥ 0. */
export function erfc(x) {
  const t = 1 / (1 + 0.3275911 * x);
  return t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-x * x);
}

const inverseErfc = r => {
  let lo = 0;
  let hi = 6;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (erfc(mid) > r) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};

const Z_MELT = inverseErfc((T_MELT - T_ROOM) / (T_HOT - T_ROOM)); // step() asks for this 120 times a second

/** Temperature (°C) of the rod at x metres from the hot end, t seconds after heating starts. */
export function rodTemperature(m, x, t) {
  if (!(t > 0)) return x <= 0 ? T_HOT : T_ROOM;
  return T_ROOM + (T_HOT - T_ROOM) * erfc(Math.max(0, x) / (2 * Math.sqrt(diffusivity(m) * t)));
}

/** Seconds until the point x metres from the hot end reaches `temperature`. */
export function timeToReach(m, x, temperature = T_MELT) {
  const z = temperature === T_MELT ? Z_MELT : inverseErfc((temperature - T_ROOM) / (T_HOT - T_ROOM));
  return (x * x) / (4 * diffusivity(m) * z * z);
}

/** When each wax drop falls (s), in the order of MATERIALS. */
export const fallTimes = s => MATERIALS.map(m => timeToReach(m, s.distance / 100));

/** Material indices in the order their wax falls. */
export const fallOrder = s => fallTimes(s).map((t, i) => [t, i]).sort((a, b) => a[0] - b[0]).map(p => p[1]);

export const fallenCount = s => fallTimes(s).filter(t => s.time >= t).length;

/** The prediction as a list of distinct material indices; anything else in the string is dropped. */
export function parsePrediction(text) {
  const out = [];
  for (const ch of String(text ?? "").slice(0, 16)) {
    const i = "0123".indexOf(ch);
    if (i >= 0 && !out.includes(i)) out.push(i);
  }
  return out;
}

/** Add material i to the prediction. Returns its position (1–4), or 0 if it cannot be added. */
export function predict(s, i) {
  const list = parsePrediction(s.prediction);
  if (s.time > 0 || !MATERIALS[i] || list.includes(i)) return 0;
  list.push(i);
  s.prediction = list.join("");
  return list.length;
}

export const predictionCorrect = s => parsePrediction(s.prediction).join("") === fallOrder(s).join("");

// ---------- convection ----------
/** Upward acceleration (m/s²) of a parcel dT kelvin warmer than the water around it; negative if colder. */
export const buoyantAcceleration = dT => G * BETA * dT;

/** Typical speed of the convection current (m/s). */
export const convectionSpeed = s => (s.heater === "top" || s.deltaT <= 0 ? 0 : Math.sqrt(buoyantAcceleration(s.deltaT) * DEPTH));

/** Velocity at (x, y) in beaker fractions per second; x to the right, y up, both 0…1. */
export function velocity(s, x, y) {
  const A = convectionSpeed(s) / DEPTH;
  const sy = Math.sin(Math.PI * y);
  const cy = Math.cos(Math.PI * y);
  if (s.heater === "center") {
    // two cells, rising in the middle
    return { vx: (A / 2) * Math.sin(2 * Math.PI * x) * cy, vy: -A * Math.cos(2 * Math.PI * x) * sy };
  }
  // one cell, rising on the heated (left) side
  return { vx: -A * Math.sin(Math.PI * x) * cy, vy: A * Math.cos(Math.PI * x) * sy };
}

/** Move a point with the flow for dt seconds (midpoint rule). */
export function advect(s, p, dt) {
  const a = velocity(s, p.x, p.y);
  const b = velocity(s, p.x + (a.vx * dt) / 2, p.y + (a.vy * dt) / 2);
  return { x: p.x + b.vx * dt, y: p.y + b.vy * dt };
}

const cellCentre = s => (s.heater === "center" ? 0.75 : 0.5);

// ---------- radiation ----------
const kind = which => (which === "white" ? "white" : "black");
export const incidentPower = s => s.irradiance * PLATE.area;
export const absorbedPower = (s, which) => ABSORB[kind(which)] * incidentPower(s);
export const reflectedPower = (s, which) => (1 - ABSORB[kind(which)]) * incidentPower(s);
export const lostPower = temperature => PLATE.h * PLATE.lossArea * (temperature - T_ROOM);
export const equilibriumTemperature = (s, which) => T_ROOM + absorbedPower(s, which) / (PLATE.h * PLATE.lossArea);
export const timeConstant = () => PLATE.heatCapacity / (PLATE.h * PLATE.lossArea); // s

// ---------- time ----------
/** Start the current experiment again; settings and the prediction stay. */
export function resetRun(s) {
  s.time = 0;
  s.reported = false;
  s.mx = s.heater === "center" ? 0.62 : 0.25;
  s.my = 0.25;
  s.loopAngle = 0;
  s.loopTime = 0;
  s.tBlack = T_ROOM;
  s.tWhite = T_ROOM;
  return s;
}

export function step(s, dt) {
  s.time = Math.max(0, s.time) + dt;
  if (s.mode === "convection") {
    const cx = cellCentre(s);
    const before = Math.atan2(s.my - 0.5, s.mx - cx);
    const p = advect(s, { x: s.mx, y: s.my }, dt);
    s.mx = Math.min(1, Math.max(0, p.x));
    s.my = Math.min(1, Math.max(0, p.y));
    let d = Math.atan2(s.my - 0.5, s.mx - cx) - before;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    s.loopAngle += d;
    if (!s.loopTime && Math.abs(s.loopAngle) >= 2 * Math.PI) s.loopTime = s.time;
  } else if (s.mode === "radiation") {
    s.tBlack += (dt * (absorbedPower(s, "black") - lostPower(s.tBlack))) / PLATE.heatCapacity;
    s.tWhite += (dt * (absorbedPower(s, "white") - lostPower(s.tWhite))) / PLATE.heatCapacity;
  }
  return s;
}
