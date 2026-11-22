// Bar magnets and the Earth's field, in the two-pole (point "magnetic charge") model:
// each bar magnet is a pair of poles, +1 at its N end and −1 at its S end, and a pole q at P
// gives a field q·r/|r|³ at a distance r from P (like Coulomb's law). Fields add (superposition).
// Lengths are in arbitrary units (u); field strength is relative (pole strength 1).
// Angles are in degrees, counter-clockwise from +x, and give the direction S → N of a magnet.

export const BOX = { w: 12, h: 7.2 }; // visible sheet, centred on the origin
export const MAG = { len: 2.4, wid: 0.6, pole: 0.95 }; // poles sit 0.95 u from the centre
export const EARTH = { r: 1.5, tilt: 11, pole: 0.3 }; // magnetic axis tilted 11° from the spin axis
const SOFT = 0.12; // softening length (u) so the field stays finite right at a pole
const RAD = Math.PI / 180;

export const initialState = () => ({
  scene: "magnets", // "magnets" | "earth"
  count: 2,
  x1: -2.4, y1: 0, a1: 0, // magnet 1: N on the right
  x2: 2.4, y2: 0, a2: 180, // magnet 2: N on the left, so two N poles face each other
  px: 0, py: 1.8, // compass probe
  found: false, // the learner has put the probe on the neutral point
  showFilings: true,
  showLines: true,
  showCompass: false,
});

const clampN = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : 0));

/** Magnets on the sheet, positions clamped so a forged state cannot throw them off the sheet. */
export function magnets(s) {
  if (s.scene === "earth") return [];
  const one = (x, y, a) => ({ x: clampN(x, -BOX.w / 2, BOX.w / 2), y: clampN(y, -BOX.h / 2, BOX.h / 2), a: clampN(a, -3600, 3600) });
  const list = [one(s.x1, s.y1, s.a1)];
  if (s.count >= 2) list.push(one(s.x2, s.y2, s.a2));
  return list;
}

/** Poles {x, y, q} of one magnet (q = +1 for N, −1 for S). */
export function polesOf(m, d = MAG.pole) {
  const c = Math.cos(m.a * RAD);
  const sn = Math.sin(m.a * RAD);
  // out: direction (degrees) pointing out of the magnet through that end
  return [
    { x: m.x + d * c, y: m.y + d * sn, q: 1, out: m.a },
    { x: m.x - d * c, y: m.y - d * sn, q: -1, out: m.a + 180 },
  ];
}

/** The Earth as a short magnet inside it whose N end points towards the geographic south. */
export const earthMagnet = () => ({ x: 0, y: 0, a: 270 + EARTH.tilt });

export function poles(s) {
  if (s.scene === "earth") return polesOf(earthMagnet(), EARTH.pole);
  return magnets(s).flatMap(m => polesOf(m));
}

/** Field of a list of poles at (x, y): the sum of q·r/|r|³. */
export function fieldOf(list, x, y) {
  let bx = 0;
  let by = 0;
  for (const p of list) {
    const dx = x - p.x;
    const dy = y - p.y;
    const r2 = dx * dx + dy * dy + SOFT * SOFT;
    const k = p.q / (r2 * Math.sqrt(r2));
    bx += k * dx;
    by += k * dy;
  }
  return { x: bx, y: by };
}

export const fieldAt = (s, x, y) => fieldOf(poles(s), x, y);

/** Direction (degrees) the N end of a compass needle points at (x, y): along B. */
export function compassAngle(s, x, y) {
  const b = fieldAt(s, x, y);
  return Math.atan2(b.y, b.x) / RAD;
}

/** Net force on magnet `j` from the other magnet: each of its poles feels q·B_other. */
export function forceOn(s, j) {
  const ms = magnets(s);
  if (ms.length < 2) return { x: 0, y: 0 };
  const others = polesOf(ms[1 - j]);
  let fx = 0;
  let fy = 0;
  for (const p of polesOf(ms[j])) {
    const b = fieldOf(others, p.x, p.y);
    fx += p.q * b.x;
    fy += p.q * b.y;
  }
  return { x: fx, y: fy };
}

/** "repel" if the force on magnet 2 points away from magnet 1, else "attract". */
export function interaction(s) {
  const ms = magnets(s);
  if (ms.length < 2) return null;
  const f = forceOn(s, 1);
  return f.x * (ms[1].x - ms[0].x) + f.y * (ms[1].y - ms[0].y) > 0 ? "repel" : "attract";
}

/**
 * The neutral point (B = 0) between the two facing poles, when those poles are alike.
 * Newton's method from the midpoint of the nearest pair of poles, one from each magnet.
 * Returns null when the facing poles are unlike (they attract and leave no neutral point between them).
 */
export function neutralPoint(s) {
  const ms = magnets(s);
  if (ms.length < 2) return null;
  let best = null;
  for (const p of polesOf(ms[0])) {
    for (const q of polesOf(ms[1])) {
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      if (!best || d < best.d) best = { p, q, d };
    }
  }
  if (best.p.q !== best.q.q || best.d < 1e-6) return null;
  const mx = (best.p.x + best.q.x) / 2;
  const my = (best.p.y + best.q.y) / 2;
  let x = mx;
  let y = my;
  const h = 1e-5;
  for (let i = 0; i < 50; i++) {
    const b = fieldAt(s, x, y);
    const bx1 = fieldAt(s, x + h, y);
    const by1 = fieldAt(s, x, y + h);
    const j11 = (bx1.x - b.x) / h;
    const j12 = (by1.x - b.x) / h;
    const j21 = (bx1.y - b.y) / h;
    const j22 = (by1.y - b.y) / h;
    const det = j11 * j22 - j12 * j21;
    if (Math.abs(det) < 1e-14) break;
    x -= (j22 * b.x - j12 * b.y) / det;
    y -= (-j21 * b.x + j11 * b.y) / det;
  }
  const b = fieldAt(s, x, y);
  // Must have converged, and stayed between the two poles.
  if (Math.hypot(b.x, b.y) > 1e-6 || Math.hypot(x - mx, y - my) > 0.6 * best.d) return null;
  return { x, y };
}

export const NEUTRAL_TOL = 0.3; // u: how close the probe must be to the neutral point

/** The probe is on the neutral point. */
export function onNeutral(s) {
  const n = neutralPoint(s);
  return !!n && Math.hypot(s.px - n.x, s.py - n.y) <= NEUTRAL_TOL;
}

/**
 * Field lines as polylines [[x, y], …], each running in the direction of B.
 * Traced out of every N pole; lines that end on an S pole stop there. Lines that come in
 * from far away to an S pole are traced backwards from that pole and then reversed.
 */
export function fieldLines(s, perPole = 12, h = 0.05, maxSteps = 900) {
  const list = poles(s);
  const lim = { x: BOX.w / 2 + 1, y: BOX.h / 2 + 1 };
  const start = s.scene === "earth" ? 0.12 : 0.34; // seeds start just outside the magnet body
  const trace = (p, angle, sign) => {
    const pts = [[p.x + start * Math.cos(angle), p.y + start * Math.sin(angle)]];
    let end = null;
    for (let i = 0; i < maxSteps; i++) {
      const [x, y] = pts[pts.length - 1];
      const dir = (px, py) => {
        const b = fieldOf(list, px, py);
        const m = Math.hypot(b.x, b.y) || 1;
        return [(sign * b.x) / m, (sign * b.y) / m];
      };
      const [dx, dy] = dir(x, y);
      const [mx, my] = dir(x + (dx * h) / 2, y + (dy * h) / 2); // midpoint (RK2)
      const nx = x + mx * h;
      const ny = y + my * h;
      pts.push([nx, ny]);
      const hit = list.find(o => o.q === -sign && o !== p && Math.hypot(nx - o.x, ny - o.y) < start);
      if (hit) {
        pts.push([hit.x, hit.y]);
        end = hit;
        break;
      }
      if (Math.abs(nx) > lim.x || Math.abs(ny) > lim.y) break;
    }
    return { pts, end };
  };
  const out = [];
  for (const p of list) {
    for (let k = 0; k < perPole; k++) {
      // seeds fan out over the 300° facing away from the magnet's own body
      const angle = (p.out + (k / (perPole - 1) - 0.5) * 300) * RAD;
      if (p.q > 0) out.push(trace(p, angle, 1).pts);
      else {
        const back = trace(p, angle, -1);
        if (!back.end) out.push(back.pts.reverse()); // came from far away; lines from N poles are drawn already
      }
    }
  }
  return out;
}
