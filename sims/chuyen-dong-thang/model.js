// Uniformly accelerated straight-line motion of one or two carts on the Ox axis.
// x = x₀ + v₀t + ½at², v = v₀ + at. With "brake" on, a cart that slows to v = 0 stays at rest
// (a braking car); otherwise it turns back, because the acceleration keeps its direction.

export const T_MAX = 20; // s, length of one run

export const initialState = () => ({
  x0: 0, // m
  v0: 10, // m/s
  a: -1, // m/s²
  twoCarts: false,
  x0B: 50,
  v0B: -4,
  aB: 0,
  brake: false,
  time: 0, // s
});

const num = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : 0));

/** Cart 1 (A) or 2 (B) as { x0, v0, a }. */
export const cart = (s, which = 1) =>
  which === 1 ? { x0: s.x0, v0: s.v0, a: s.a, brake: s.brake } : { x0: s.x0B, v0: s.v0B, a: s.aB, brake: s.brake };

/** Time at which v = 0 with the speed changing sign, or Infinity. */
export function turnTime(c) {
  if (!c.a || !c.v0 || Math.sign(c.a) === Math.sign(c.v0)) return Infinity;
  return -c.v0 / c.a;
}

/**
 * Motion as pieces { from, to, p, q, r }: x(t) = p + q·t + r·t² for from ≤ t ≤ to (absolute t).
 * One piece, or two when a braking cart comes to rest.
 */
export function pieces(c) {
  const tt = turnTime(c);
  if (!c.brake || tt === Infinity) return [{ from: 0, to: Infinity, p: c.x0, q: c.v0, r: c.a / 2 }];
  const xs = c.x0 + c.v0 * tt + (c.a * tt * tt) / 2;
  return [
    { from: 0, to: tt, p: c.x0, q: c.v0, r: c.a / 2 },
    { from: tt, to: Infinity, p: xs, q: 0, r: 0 },
  ];
}

const pieceAt = (c, t) => pieces(c).find(k => t <= k.to);

/** Position, velocity and acceleration at time t ≥ 0. */
export function at(c, t) {
  const k = pieceAt(c, t);
  return { x: k.p + k.q * t + k.r * t * t, v: k.q + 2 * k.r * t, a: 2 * k.r };
}

/** Smallest root of r·t² + q·t + p = 0 in [lo, hi], or null. */
function firstRoot(p, q, r, lo, hi) {
  const eps = 1e-9;
  let roots;
  if (Math.abs(r) < 1e-12) roots = Math.abs(q) < 1e-12 ? [] : [-p / q];
  else {
    const d = q * q - 4 * r * p;
    if (d < 0) return null;
    const sq = Math.sqrt(d);
    roots = [(-q - sq) / (2 * r), (-q + sq) / (2 * r)];
  }
  return roots.filter(t => t >= lo - eps && t <= hi + eps).sort((x, y) => x - y)[0] ?? null;
}

/**
 * First meeting of the two carts after t = 0: { time, x }, { always: true } if they move together,
 * or null if they never meet. Solves the quadratic x_A(t) = x_B(t) on each piece.
 */
export function meeting(s) {
  const A = cart(s, 1);
  const B = cart(s, 2);
  const cuts = [0, ...pieces(A).map(k => k.to), ...pieces(B).map(k => k.to)].filter(Number.isFinite).sort((x, y) => x - y);
  cuts.push(Infinity);
  for (let i = 0; i < cuts.length - 1; i++) {
    const lo = cuts[i];
    const hi = cuts[i + 1];
    if (hi <= lo) continue;
    const mid = Number.isFinite(hi) ? (lo + hi) / 2 : lo + 1;
    const a = pieceAt(A, mid);
    const b = pieceAt(B, mid);
    const [p, q, r] = [a.p - b.p, a.q - b.q, a.r - b.r];
    if (Math.abs(p) < 1e-12 && Math.abs(q) < 1e-12 && Math.abs(r) < 1e-12) return { always: true };
    const t = firstRoot(p, q, r, Math.max(lo, 1e-6), hi); // t = 0 is the start, not a meeting
    if (t !== null) return { time: t, x: at(A, t).x };
  }
  return null;
}

/** Advance the clock; the motion itself is analytic, so it is exact. */
export function step(s, dt) {
  s.time = num(s.time + dt, 0, T_MAX);
  return s;
}

/** Position range covered by every cart in [0, T_MAX], for the track scale. */
export function extent(s) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const c of s.twoCarts ? [cart(s, 1), cart(s, 2)] : [cart(s, 1)]) {
    for (let i = 0; i <= 200; i++) {
      const x = at(c, (T_MAX * i) / 200).x;
      lo = Math.min(lo, x);
      hi = Math.max(hi, x);
    }
  }
  return { lo, hi };
}
