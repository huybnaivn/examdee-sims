// Archimedes' force on a block in a tank of liquid. SI units in the model.
// The tank and the block are prisms of the same thickness (DEPTH), so the 2D picture is to scale
// and the level rise seen on screen is exactly the displaced volume.

export const G = 10; // N/kg, the textbook rounding (d = 10·D)
export const DEPTH = 0.1; // m, thickness of tank and block
export const TANK_W = 0.4; // m
export const TANK_AREA = TANK_W * DEPTH; // m², horizontal cross-section
export const LIQUID_V = 0.012; // m³ of liquid in the tank
export const LEVEL0 = LIQUID_V / TANK_AREA; // m, level with the block out of the liquid
export const Z_MAX = 0.42; // m, highest position of the block's bottom face
export const LIQUIDS = { water: 1000, oil: 800, brine: 1200, mercury: 13600 }; // kg/m³

export const liquidDensity = s => LIQUIDS[s.liquid] ?? s.customDensity;
export const blockVolume = s => s.volume * 1e-3; // m³ (state keeps dm³)
export const blockDensity = s => s.mass / blockVolume(s);
export const blockSide = s => Math.sqrt(blockVolume(s) / DEPTH); // square face, m
const blockArea = s => blockSide(s) * DEPTH;

/** Liquid level (m above the tank floor) with the block's bottom face at height z. */
export function level(s, z = s.z) {
  if (z >= LEVEL0) return LEVEL0;
  const a = blockArea(s);
  const side = blockSide(s);
  const partly = (LIQUID_V - a * z) / (TANK_AREA - a);
  return partly <= z + side ? partly : (LIQUID_V + a * side) / TANK_AREA;
}

export const submergedVolume = (s, z = s.z) =>
  blockArea(s) * Math.min(blockSide(s), Math.max(0, level(s, z) - z));
export const submergedFraction = (s, z = s.z) => submergedVolume(s, z) / blockVolume(s);
export const weight = s => s.mass * G;
/** F_A = d·V_chìm, with d = D·g. */
export const buoyancy = (s, z = s.z) => liquidDensity(s) * G * submergedVolume(s, z);

/** "floating" | "suspended" | "sunk", decided by the densities alone. */
export function outcome(s) {
  const rel = blockDensity(s) / liquidDensity(s) - 1;
  return Math.abs(rel) < 1e-9 ? "suspended" : rel < 0 ? "floating" : "sunk";
}

/** Height of the block's bottom face when it is at rest. */
export function equilibriumZ(s) {
  const kind = outcome(s);
  if (kind === "sunk") return 0;
  if (kind === "floating") {
    const sub = s.mass / liquidDensity(s); // volume that must be under the surface
    return (LIQUID_V + sub) / TANK_AREA - sub / blockArea(s);
  }
  // suspended: at rest anywhere, as long as it is fully under the surface
  return Math.min(Math.max(s.z, 0), (LIQUID_V + blockVolume(s)) / TANK_AREA - blockSide(s));
}

export function initialState() {
  const s = {
    mass: 1.2, // kg
    volume: 2, // dm³
    liquid: "water",
    customDensity: 2000, // kg/m³, used when liquid === "custom"
    z: 0, // m, height of the block's bottom face above the tank floor
    v: 0, // m/s, positive up
    settled: true,
    quiet: 0, // s the block has been (almost) at rest
  };
  s.z = equilibriumZ(s);
  return s;
}

/** Let the block go from just above the liquid. */
export function lift(s) {
  s.z = LEVEL0 + 0.02;
  return unsettle(s);
}

export function unsettle(s) {
  s.v = 0;
  s.quiet = 0;
  s.settled = false;
  return s;
}

/** Advance by dt seconds. Does nothing once the block has settled. */
export function step(s, dt) {
  if (s.settled) return s;
  const a = blockArea(s);
  const rho = liquidDensity(s);
  // ponytail: drag is sized to damp the bobbing in about a second, it is not a real viscosity.
  const drag = 1.2 * Math.sqrt(((rho * G * a * TANK_AREA) / (TANK_AREA - a)) * s.mass);
  const n = 8; // substeps: a light block in mercury bobs too fast for one 1/120 s step
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    const c = submergedVolume(s) > 0 ? drag : 0;
    s.v = (s.v + (h * (buoyancy(s) - weight(s))) / s.mass) / (1 + (h * c) / s.mass);
    s.z += s.v * h;
    if (s.z <= 0) {
      s.z = 0;
      if (s.v < 0) s.v = 0;
    }
    if (s.z >= Z_MAX) {
      // ponytail: a cork released deep in mercury would jump out of the tank; stop it at the top.
      s.z = Z_MAX;
      s.v = 0;
    }
  }
  const net = buoyancy(s) - weight(s);
  const onFloor = s.z === 0 && net <= 0;
  s.quiet = Math.abs(s.v) < 2e-3 && Math.abs(net) < 2e-3 * weight(s) ? s.quiet + dt : 0;
  if (onFloor || s.quiet >= 0.25) {
    s.z = equilibriumZ(s);
    s.v = 0;
    s.settled = true;
  }
  return s;
}
