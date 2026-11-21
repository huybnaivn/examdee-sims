// Atmospheric pressure: Torricelli's tube, pressure against altitude, two classic demonstrations.
// SI units: Pa, m, kg/m³.

export const P0 = 101325; // Pa, standard sea-level pressure = 1 atm = 760 mmHg
export const G = 9.80665; // m/s², standard gravity
export const RHO_HG = 13595.1; // kg/m³, mercury at 0 °C (with G, 760 mmHg is exactly 1 atm)
export const RHO_WATER = 1000; // kg/m³
export const MMHG = (RHO_HG * G) / 1000; // Pa per mmHg ≈ 133,32
export const TUBE = 1; // m, length of the Torricelli tube
export const CUP = 0.1; // m, height of the water in the upturned cup
export const CARTON_FACE = 0.06 * 0.12; // m², one large face of the milk carton

export const initialState = () => ({
  demo: "torricelli", // "torricelli" | "cup" | "carton"
  altitude: 0, // m above sea level
  tilt: 0, // °, tube tilt from the vertical
  area: 1, // cm², inner cross-section of the tube
  answer: "none", // quiz on the upturned cup: "none" | "a" | "b" | "c" | "d"
  suction: 0, // %, share of the air sucked out of the carton
});

/**
 * Pressure at an altitude, International Standard Atmosphere troposphere (0–11 km):
 * p = p₀·(1 − 2,25577·10⁻⁵·h)^5,25588. Near the ground this is about 1 mmHg less per 11 m climbed.
 */
export const pressureAt = h => P0 * (1 - 2.25577e-5 * Math.min(11000, Math.max(0, h))) ** 5.25588;

/** Vertical height of a mercury column balancing pressure p: h = p / (ρ·g). In m. */
export const columnHeight = p => p / (RHO_HG * G);

/** Pressure under a column of liquid of height h: p = ρ·g·h. */
export const liquidPressure = (rho, h) => rho * G * h;

/**
 * The column in a tube of length TUBE tilted by `tiltDeg` from the vertical.
 * The vertical height is fixed by the pressure; the length along the tube is h / cosθ.
 * If that is longer than the tube, the tube is full and there is no vacuum at the top.
 */
export function tube(p, tiltDeg) {
  const c = Math.cos((tiltDeg * Math.PI) / 180);
  const h = columnHeight(p);
  const along = Math.min(TUBE, h / c);
  return { vertical: along * c, along, full: h / c >= TUBE };
}

/** Mass of mercury in the column (kg): depends on the cross-section, the height does not. */
export const columnMass = (p, tiltDeg, areaCm2) => RHO_HG * tube(p, tiltDeg).along * areaCm2 * 1e-4;

export const toMmHg = p => p / MMHG;
export const toAtm = p => p / P0;
export const toHPa = p => p / 100;

/** Upturned cup: the air pushes the paper up with p₀, the water pushes it down with ρ·g·h. */
export const cup = p => ({ up: p, down: liquidPressure(RHO_WATER, CUP), maxWater: p / (RHO_WATER * G) });

/** Milk carton: inside pressure after sucking out a share of the air, net force on one face. */
export function carton(p, suctionPct) {
  const inside = p * (1 - Math.min(95, Math.max(0, suctionPct)) / 100);
  return { inside, difference: p - inside, force: (p - inside) * CARTON_FACE };
}

export const CORRECT = "b";
