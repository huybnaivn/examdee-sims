// Magnetic field of a current, drawn in a plane: x to the right, y up, z out of the screen.
// Straight wire: along z through the origin. Circular loop: in the y–z plane, centre at the origin,
// axis along x. Solenoid: N turns of radius SOL_RADIUS spread over a length l along the x axis.
// SI units: A, m, T. "reversed = false" means: wire current out of the screen (⊙); loop and solenoid
// current out of the screen at the top (⊙) and into it at the bottom (⊗), so B points along +x inside.

export const MU0 = 4 * Math.PI * 1e-7; // T·m/A
export const SOL_RADIUS = 0.03; // m, radius of the solenoid turns
export const WIRE_R = 0.002; // m, radius of the conductor (field inside it falls to 0 at the axis)
export const VIEW = { wire: 0.1, loop: 0.15, solenoid: 0.32 }; // m, half-width of the region shown
export const ASPECT = 0.62; // half-height of the region shown, as a fraction of the half-width
const SOL_LOOPS = 60; // the solenoid is computed as this many equally spaced loops
// Probe position as a fraction of the half-width (u) and half-height (v) of the region shown.
export const PROBE_HOME = { wire: [0.3, 0], loop: [0, 0], solenoid: [0, 0] };

export const initialState = () => ({
  source: "wire", // "wire" | "loop" | "solenoid"
  current: 5, // A
  reversed: false,
  radius: 0.05, // m, radius R of the loop
  turns: 200, // N, solenoid
  length: 0.3, // m, l, solenoid
  probeU: 0.3, // probe x as a fraction of the half-width shown (−1..1); 0,3 · 10 cm = 3 cm
  probeV: 0, // probe y as a fraction of the half-height shown (−1..1)
  showLines: true,
  showCompass: true,
});

const sourceOf = s => (s.source in VIEW ? s.source : "wire");
const sign = s => (s.reversed ? -1 : 1);

/** Complete elliptic integrals K(m) and E(m), parameter m = k², by the arithmetic–geometric mean. */
export function ellipKE(m) {
  let a = 1;
  let b = Math.sqrt(1 - m);
  let sum = m / 2;
  let w = 0.5;
  for (let i = 0; i < 40 && Math.abs(a - b) > 1e-15 * a; i++) {
    const c = (a - b) / 2;
    const an = (a + b) / 2;
    b = Math.sqrt(a * b);
    a = an;
    w *= 2;
    sum += w * c * c;
  }
  const K = Math.PI / (2 * a);
  return { K, E: K * (1 - sum) };
}

/**
 * Exact field of one circular loop (radius a, current I, centre at x = x0 on the x axis,
 * counter-clockwise seen from +x) at the point (x, y) of the screen plane. Returns [Bx, By] in T.
 */
export function loopField(a, I, x0, x, y) {
  const z = x - x0;
  const rho = Math.abs(y);
  const r2 = a * a + rho * rho + z * z;
  const alpha2 = Math.max(r2 - 2 * a * rho, WIRE_R * WIRE_R); // keeps the field finite at the conductor
  const beta2 = r2 + 2 * a * rho;
  const beta = Math.sqrt(beta2);
  const { K, E } = ellipKE(Math.max(0, 1 - alpha2 / beta2));
  const C = (MU0 * I) / Math.PI;
  const bx = (C / (2 * alpha2 * beta)) * ((a * a - rho * rho - z * z) * E + alpha2 * K);
  const brho = rho < 1e-12 ? 0 : ((C * z) / (2 * alpha2 * beta * rho)) * (r2 * E - alpha2 * K);
  return [bx, y < 0 ? -brho : brho];
}

/** Magnetic field [Bx, By] in T at (x, y), in metres. */
export function fieldAt(s, x, y) {
  const I = s.current * sign(s);
  const src = sourceOf(s);
  if (src === "wire") {
    const r2 = x * x + y * y;
    // B = 2·10⁻⁷·I/r outside the wire, circling it counter-clockwise when the current comes out of the screen
    const k = r2 >= WIRE_R * WIRE_R ? (2e-7 * I) / r2 : (2e-7 * I) / (WIRE_R * WIRE_R);
    return [-k * y, k * x];
  }
  if (src === "loop") return loopField(s.radius, I, 0, x, y);
  let bx = 0;
  let by = 0;
  const per = (I * s.turns) / SOL_LOOPS;
  for (let k = 0; k < SOL_LOOPS; k++) {
    const x0 = -s.length / 2 + (s.length * (k + 0.5)) / SOL_LOOPS;
    const [a, b] = loopField(SOL_RADIUS, per, x0, x, y);
    bx += a;
    by += b;
  }
  return [bx, by];
}

const unit = v => (Number.isFinite(v) ? Math.min(1, Math.max(-1, v)) : 0);

/** Probe position [x, y] in metres, always inside the region shown. */
export function probePos(s) {
  const W = VIEW[sourceOf(s)];
  return [unit(s.probeU) * W, unit(s.probeV) * W * ASPECT];
}

/** Put the probe at (x, y) metres, clamped to the region shown. */
export function moveProbe(s, x, y) {
  const W = VIEW[sourceOf(s)];
  s.probeU = unit(x / W);
  s.probeV = unit(y / (W * ASPECT));
  return s;
}

/** What the probe reads: magnitude B (T) and direction (degrees from +x, counter-clockwise, −180..180). */
export function probe(s) {
  const [x, y] = probePos(s);
  const [bx, by] = fieldAt(s, x, y);
  return { b: Math.hypot(bx, by), angle: (Math.atan2(by, bx) * 180) / Math.PI, bx, by, x, y };
}

/** The textbook formula for the selected conductor (wire: at the probe distance). */
export function theory(s) {
  const src = sourceOf(s);
  if (src === "wire") return (2e-7 * s.current) / Math.max(Math.hypot(...probePos(s)), WIRE_R);
  if (src === "loop") return (2 * Math.PI * 1e-7 * s.current) / s.radius;
  return (4 * Math.PI * 1e-7 * s.turns * s.current) / s.length;
}

/**
 * Field lines through seed points, traced both ways with a midpoint (RK2) step along the unit field.
 * Returns arrays of [x, y] points (metres). Shape depends only on the geometry, not on I or its sign.
 */
export function fieldLines(s, seeds, h, maxSteps = 900) {
  const W = VIEW[sourceOf(s)];
  const dir = (x, y) => {
    const [bx, by] = fieldAt({ ...s, current: 1, reversed: false }, x, y);
    const b = Math.hypot(bx, by) || 1;
    return [bx / b, by / b];
  };
  const out = [];
  for (const [sx, sy] of seeds) {
    const halves = [];
    let closed = false;
    for (const way of [1, -1]) {
      if (closed) break;
      const pts = [[sx, sy]];
      let [x, y] = [sx, sy];
      for (let i = 0; i < maxSteps; i++) {
        const [ax, ay] = dir(x, y);
        const [mx, my] = dir(x + (way * h * ax) / 2, y + (way * h * ay) / 2);
        x += way * h * mx;
        y += way * h * my;
        pts.push([x, y]);
        if (Math.abs(x) > W * 1.15 || Math.abs(y) > W * ASPECT * 1.3) break;
        if (i > 8 && Math.hypot(x - sx, y - sy) < h * 0.9) {
          pts.push([sx, sy]);
          closed = true;
          break;
        }
      }
      halves.push(pts);
    }
    out.push(closed ? halves[0] : [...halves[1].slice(1).reverse(), ...halves[0]]);
  }
  return out;
}
