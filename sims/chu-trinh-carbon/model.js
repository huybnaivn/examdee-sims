// Carbon cycle as a six-box model. Reservoirs in GtC (gigatonnes of carbon), fluxes in GtC/year.
//
// Year 0 is a rounded pre-industrial balance (atmosphere 596,4 GtC = 280 ppm CO₂; 1 ppm = 2,13 GtC).
// Every flux is proportional to the reservoir it leaves, with the rate chosen so that the textbook
// flux is reproduced at year 0, except:
//   photosynthesis  = 120 · (1 − d) · f(A),  f(A) = A·(A₀ + K) / (A₀·(A + K)),  K = 200 GtC
//       d = share of forest cleared (deforestation); f is a saturating CO₂ fertilisation, f(A₀) = 1.
//   ocean release   = 90 + 0,27 · (O − O₀), never below 0
//       the single ocean box stands for a thin surface layer that exchanges fast and a deep ocean that
//       does not; 0,27 /year is calibrated so that roughly half of the emitted carbon stays in the air.
//   combustion      = the burning rate set by the learner, limited by what is left in the ground.
// Carbon only moves between boxes, so the total is conserved.

export const GTC_PER_PPM = 2.13;
export const YEARS = 100; // length of one run
export const TARGET_PPM = 450; // goal: atmosphere stays below this for the whole run
export const START = { atm: 596.4, plants: 550, animals: 2, soil: 1500, ocean: 38000, fossil: 4000 };
export const KEYS = Object.keys(START);
export const MAX_BURNING = 20; // GtC/year
export const MAX_DEFORESTATION = 50; // %

const K_HALF = 200; // GtC, half-saturation of CO₂ fertilisation
const OCEAN_BUFFER = 0.27; // 1/year
const SUBSTEPS = 20; // Euler steps per year; the fastest box (animals) turns over in 0,4 year

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));

export const initialState = () => ({
  burning: 10, // GtC/year
  deforestation: 10, // % of forest cleared
  year: 0, // how far the run has played, 0…YEARS
  showNames: true,
});

/** All fluxes (GtC/year, each ≥ 0) for reservoirs r and settings p = { burning, deforestation }. */
export function fluxes(r, p) {
  const cut = clamp(p.deforestation, 0, MAX_DEFORESTATION) / 100;
  const fert = (r.atm * (START.atm + K_HALF)) / (START.atm * (r.atm + K_HALF));
  return {
    photosynthesis: 120 * (1 - cut) * fert, // atm → plants
    plantRespiration: (60 / START.plants) * r.plants, // plants → atm
    eaten: (5 / START.plants) * r.plants, // plants → animals
    litter: (55 / START.plants) * r.plants, // plants → soil
    animalRespiration: (4 / START.animals) * r.animals, // animals → atm
    animalWaste: (1 / START.animals) * r.animals, // animals → soil
    decomposition: (56 / START.soil) * r.soil, // soil → atm
    oceanUptake: (90 / START.atm) * r.atm, // atm → ocean
    oceanRelease: Math.max(0, 90 + OCEAN_BUFFER * (r.ocean - START.ocean)), // ocean → atm
    combustion: Math.min(clamp(p.burning, 0, MAX_BURNING), r.fossil), // fossil → atm
  };
}

/** Net change of each reservoir, GtC/year. The six values add up to 0. */
export function netChange(r, p) {
  const f = fluxes(r, p);
  return {
    atm: f.plantRespiration + f.animalRespiration + f.decomposition + f.oceanRelease + f.combustion - f.photosynthesis - f.oceanUptake,
    plants: f.photosynthesis - f.plantRespiration - f.eaten - f.litter,
    animals: f.eaten - f.animalRespiration - f.animalWaste,
    soil: f.litter + f.animalWaste - f.decomposition,
    ocean: f.oceanUptake - f.oceanRelease,
    fossil: -f.combustion,
  };
}

/** Reservoirs after `years` more years (returns a new object). */
export function advance(r, p, years = 1) {
  const out = {};
  for (const k of KEYS) out[k] = clamp(r[k], 0, 1e6);
  const dt = 1 / SUBSTEPS;
  for (let i = 0; i < Math.round(years * SUBSTEPS); i++) {
    const d = netChange(out, p);
    for (const k of KEYS) out[k] += d[k] * dt;
  }
  return out;
}

/** One snapshot per year, from year 0 (START) to `years`, with constant settings p. */
export function simulate(p, years = YEARS) {
  const run = [{ ...START }];
  for (let y = 0; y < years; y++) run.push(advance(run[y], p, 1));
  return run;
}

export const total = r => KEYS.reduce((sum, k) => sum + r[k], 0);
export const ppm = r => r.atm / GTC_PER_PPM;
export const peakPpm = run => Math.max(...run.map(ppm));
/** The run meets the goal when the atmosphere never reaches the target. */
export const meetsTarget = run => peakPpm(run) < TARGET_PPM;
/** Whole year the run has reached; `year` has no control, so it is clamped here. */
export const yearOf = s => Math.floor(clamp(s.year, 0, YEARS));
