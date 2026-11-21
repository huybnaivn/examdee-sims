// Greenhouse effect, one-layer energy-balance model. SI units, temperatures in kelvin.
//
// Sunlight (short wave) passes the atmosphere; a fraction α (albedo) is reflected.
// Absorbed sunlight per m² of the Earth's surface, averaged over the globe:  S_abs = S·(1 − α)/4.
// The ground radiates infrared σT⁴. One atmospheric layer absorbs a fraction ε of it and re-emits
// ε·σT_a⁴ both up and down. At equilibrium the layer gives σT_a⁴ = σT⁴/2, so
//   energy leaving the planet  OLR = (1 − ε)·σT⁴ + ε·σT_a⁴ = σT⁴·(1 − ε/2)
//   equilibrium                σT⁴ = S_abs / (1 − ε/2)   ⇒   T = T_e·(2/(2 − ε))^¼,  T_e = (S_abs/σ)^¼.
// Without an atmosphere (ε = 0) T = T_e, the radiative balance temperature (≈ 255 K for α = 0,3).
//
// Model choices (a teaching model, not a climate model):
//   albedo α = 0,10 + 0,30 · (cloud fraction): clouds act only by reflecting sunlight here;
//   ε = 0,7605 + 0,052 · log₂(CO₂ / 280 ppm), clamped to [0; 0,99]: water vapour and other gases are in
//   the constant; the CO₂ term is tuned so that doubling CO₂ warms the surface by about 3 °C.

export const SOLAR = 1361; // W/m², solar constant
export const SIGMA = 5.670374419e-8; // W/(m²·K⁴)
export const CO2_PRE = 280; // ppm, pre-industrial
export const CLOUD_REF = 67; // %, average cloud cover
export const EPS0 = 0.7605;
export const EPS_PER_DOUBLING = 0.052;
export const T_MIN = 150;
export const T_MAX = 400;
const HEAT_CAPACITY = 8; // J/(m²·K), artificially small so the warming takes a few seconds on screen

export const albedo = cloud => 0.1 + 0.3 * Math.min(1, Math.max(0, cloud / 100));

export const absorptivity = (co2, atmosphere = true) =>
  atmosphere ? Math.min(0.99, Math.max(0, EPS0 + EPS_PER_DOUBLING * Math.log2(Math.max(1, co2) / CO2_PRE))) : 0;

export const absorbedSolar = cloud => (SOLAR * (1 - albedo(cloud))) / 4;

/** Surface temperature with no greenhouse layer (radiative balance). */
export const bareTemperature = cloud => (absorbedSolar(cloud) / SIGMA) ** 0.25;

/** Equilibrium surface temperature for absorptivity ε. */
export const surfaceTemperature = (eps, cloud) => bareTemperature(cloud) * (2 / (2 - eps)) ** 0.25;

export const equilibrium = s => surfaceTemperature(absorptivity(s.co2, s.atmosphere), s.cloud);

/** Energy flows (W/m²) for a surface at temperature T. */
export function fluxes(T, eps, cloud) {
  const ground = SIGMA * T ** 4; // infrared from the ground
  const layer = (eps * ground) / 2; // emitted by the layer, each way
  return {
    incoming: SOLAR / 4,
    reflected: (SOLAR / 4) * albedo(cloud),
    absorbed: absorbedSolar(cloud),
    ground,
    back: layer, // back towards the ground
    outgoing: (1 - eps) * ground + layer, // leaves the planet
  };
}

/** Reference: pre-industrial CO₂ with average clouds. */
export const baseline = () => surfaceTemperature(absorptivity(CO2_PRE), CLOUD_REF);
export const rise = s => equilibrium(s) - baseline();

export const initialState = () => {
  const s = {
    co2: 420, // ppm, about today's level
    cloud: CLOUD_REF, // %
    atmosphere: true, // false: no greenhouse gases at all
    target: 1.5, // °C, allowed warming above pre-industrial
    goalMet: false, // the warming has been brought under the target (goal already reported)
    temp: 0, // K, current surface temperature
  };
  s.temp = equilibrium(s);
  return s;
};

/** Relax the surface temperature towards balance: C·dT/dt = absorbed − outgoing. */
export function step(s, dt) {
  const eps = absorptivity(s.co2, s.atmosphere);
  if (!(s.temp >= T_MIN && s.temp <= T_MAX)) s.temp = Math.min(T_MAX, Math.max(T_MIN, s.temp || equilibrium(s)));
  const f = fluxes(s.temp, eps, s.cloud);
  s.temp = Math.min(T_MAX, Math.max(T_MIN, s.temp + ((f.absorbed - f.outgoing) / HEAT_CAPACITY) * dt));
  return s;
}

export const toC = K => K - 273.15;
