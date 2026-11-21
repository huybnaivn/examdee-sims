// Photoelectric effect in a vacuum photocell: light on a metal cathode K, collecting anode A.
// Energies in eV, wavelengths in nm, voltages in V, light power in mW, currents in µA.
//
// Idealisations (stated on screen):
//  - every photon has energy hf; an electron leaves only if hf > A (Einstein's equation hf = A + W_đmax);
//  - a fixed fraction EFFICIENCY of the photons releases an electron, so I_bh = H·e·(P / hf);
//  - electrons leave square to the cathode with kinetic energies spread evenly from 0 to W_đmax,
//    so a retarding voltage −U_h < U_AK < 0 lets the fraction 1 + U_AK/U_h through, and any
//    U_AK ≥ 0 collects them all (saturation).

export const HC = 1239.842; // h·c in eV·nm
export const EFFICIENCY = 0.01; // electrons per photon (quantum efficiency H)
export const TOLERANCE = 5; // nm: how close to λ0 counts as "found the threshold"

// Work functions chosen to match the threshold wavelengths in the grade-12 textbook table
// (Na 0,50 µm; K 0,55 µm; Cs 0,66 µm; Zn 0,35 µm; Cu 0,30 µm).
export const METALS = {
  Na: { label: "Sodium (Na)", A: 2.48 },
  K: { label: "Potassium (K)", A: 2.26 },
  Cs: { label: "Caesium (Cs)", A: 1.88 },
  Zn: { label: "Kẽm (Zn)", A: 3.55 },
  Cu: { label: "Đồng (Cu)", A: 4.14 },
};

export const initialState = () => ({
  metal: "Na",
  wavelength: 400, // nm
  power: 3, // mW of light reaching the cathode
  voltage: 1, // U_AK, V
  showThreshold: false,
  found: "", // metals whose threshold the learner has found, e.g. "Na,Cs"
});

/** Photon energy ε = hf = hc/λ (eV). */
export const photonEnergy = wavelength => HC / wavelength;
/** Work function A (eV). */
export const workFunction = s => (METALS[s.metal] ?? METALS.Na).A;
/** Threshold wavelength λ0 = hc/A (nm). */
export const threshold = s => HC / workFunction(s);
/** The photoelectric effect can happen: hf > A, i.e. λ < λ0. Does not depend on the intensity. */
export const canEmit = s => photonEnergy(s.wavelength) > workFunction(s);
/** Electrons are actually leaving the cathode (the light must also be on). */
export const emitted = s => canEmit(s) && s.power > 0;
/** Einstein: W_đmax = hf − A (eV); 0 when there is no emission. */
export const kineticMax = s => (canEmit(s) ? photonEnergy(s.wavelength) - workFunction(s) : 0);
/** Stopping voltage: e·U_h = W_đmax, so U_h in V equals W_đmax in eV. */
export const stoppingVoltage = s => kineticMax(s);
/** Saturation current I_bh = H·e·P/(hf), in µA. */
export const saturationCurrent = s =>
  emitted(s) ? (EFFICIENCY * Math.max(0, s.power) * 1000) / photonEnergy(s.wavelength) : 0;

/** Photocurrent (µA) at anode–cathode voltage u (default: the current setting). */
export function current(s, u = s.voltage) {
  const sat = saturationCurrent(s);
  const uh = stoppingVoltage(s);
  if (sat === 0 || u <= -uh) return 0;
  return u >= 0 ? sat : sat * (1 + u / uh);
}

const foundList = s => String(s.found ?? "").split(",").filter(m => m in METALS);
export const hasFound = s => foundList(s).includes(s.metal);
export const nearThreshold = s => Math.abs(s.wavelength - threshold(s)) <= TOLERANCE;
/** Record that the threshold of the current metal was found. Returns true the first time only. */
export function markFound(s) {
  if (hasFound(s) || !(s.metal in METALS)) return false;
  s.found = [...foundList(s), s.metal].join(",");
  return true;
}

const MAX_ELECTRONS = 120;

/**
 * Display only: move the electrons between the plates (s._el, transient).
 * x runs from 0 (cathode) to 1 (anode); v is scaled so that v² is the kinetic energy in eV,
 * hence dK/dx = U_AK, exactly the work done by the field.
 */
export function step(s, dt) {
  const el = (s._el ??= []);
  const pace = 0.6; // plate gaps per second for a 1 eV electron
  for (const e of el) {
    e.v += (s.voltage / 2) * pace * dt;
    e.x += e.v * pace * dt;
    e.age += dt;
  }
  s._el = el.filter(e => e.x >= 0 && e.x <= 1 && e.age < 8);
  // ponytail: Math.random is fine here, the dots are decoration; the numbers come from current().
  s._due = (s._due ?? 0) + Math.min(30, 1.5 * saturationCurrent(s)) * dt;
  for (; s._due >= 1; s._due--) {
    if (s._el.length >= MAX_ELECTRONS) continue;
    const k = kineticMax(s) * (0.04 + 0.96 * Math.random());
    s._el.push({ x: 0, y: Math.random(), v: Math.sqrt(k), age: 0 });
  }
  return s;
}
