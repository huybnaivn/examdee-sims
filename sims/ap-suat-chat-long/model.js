// Pressure in a liquid at rest, and communicating vessels. SI units unless noted.

export const P0 = 101325; // Pa, standard atmospheric pressure
export const TANK_DEPTH = 2; // m of liquid in the tank

export const initialState = () => ({
  mode: "tank", // "tank" | "vessels"
  density: 1000, // kg/m³
  gravity: 10, // m/s² (N/kg)
  depth: 1.2, // m, probe below the free surface
  probeX: 0.3, // 0–1, horizontal position of the probe across the tank
  atmosphere: false, // add p₀ to the reading
  volume: 16, // L of liquid in the communicating vessels
});

/** d = ρ·g, N/m³. */
export const specificWeight = s => s.density * s.gravity;
/** Pressure caused by the liquid alone, p = d·h = ρ·g·h. It does not involve probeX. */
export const gaugePressure = (s, depth = s.depth) => specificWeight(s) * depth;
/** What the probe reads: p₀ + ρ·g·h if the atmosphere is counted. */
export const pressure = (s, depth = s.depth) => (s.atmosphere ? P0 : 0) + gaugePressure(s, depth);

// Communicating vessels, lengths in dm, all 1 dm thick so areas in dm² are volumes in litres.
// Each branch has horizontal width w0 + k·y at height y above the connecting pipe; `lean` only shifts it sideways.
export const BRANCHES = [
  { x: 1.5, w0: 2, k: 0, lean: 0 }, // wide straight
  { x: 3.5, w0: 0.6, k: 0, lean: 0 }, // narrow straight
  { x: 5.6, w0: 0.6, k: 0.4, lean: 0 }, // funnel
  { x: 7.7, w0: 0.8, k: 0, lean: 0.35 }, // slanted tube
];
export const PIPE = { x0: 0.5, x1: 8.1, h: 0.5 }; // connecting pipe under the branches
export const BRANCH_H = 5; // dm
const PIPE_VOLUME = (PIPE.x1 - PIPE.x0) * PIPE.h;

export const branchVolume = (b, h) => b.w0 * h + (b.k * h * h) / 2;
/** Litres held when every branch is filled to height h (dm) above the pipe. */
export const vesselVolume = h => PIPE_VOLUME + BRANCHES.reduce((sum, b) => sum + branchVolume(b, h), 0);
export const MIN_VOLUME = Math.ceil(vesselVolume(0.2));
export const MAX_VOLUME = Math.floor(vesselVolume(BRANCH_H - 0.1));

/** The one level (dm above the pipe) shared by all branches for a given volume: bisection on a rising function. */
export function vesselLevel(volume) {
  let lo = 0;
  let hi = BRANCH_H;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (vesselVolume(mid) < volume) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Depth (m) of the point being read: the probe in the tank, the bottom of the pipe in the vessels. */
export const readingDepth = s => (s.mode === "vessels" ? (vesselLevel(s.volume) + PIPE.h) / 10 : s.depth);
