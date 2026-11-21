// Electric field and potential of up to three point charges in vacuum (air), on a plane.
// Charges in nC, positions in cm (x to the right, y up), field in V/m, potential in V.

export const K = 9e9; // N·m²/C²
export const XMAX = 8; // cm, positions are kept inside ±XMAX, ±YMAX
export const YMAX = 6;
export const QMAX = 5; // nC

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Make charge `i` the one the sliders edit (selQ, selX, selY mirror it). */
export function pick(s, i) {
  const c = s.charges[i];
  s.selected = i;
  s.selQ = c.q;
  s.selX = c.x;
  s.selY = c.y;
  return s;
}

/** Write the slider values back into the selected charge. */
export function applySelected(s) {
  Object.assign(s.charges[s.selected], { q: s.selQ, x: s.selX, y: s.selY });
  return s;
}

export const initialState = () =>
  pick(
    {
      // Always three slots; q = 0 means "no charge here".
      charges: [
        { q: 2, x: -4, y: 0 },
        { q: -2, x: 4, y: 0 },
        { q: 0, x: 0, y: -3 },
      ],
      selected: 0,
      selQ: 0,
      selX: 0,
      selY: 0,
      px: 0, // test point M, cm
      py: 3,
      showGrid: true,
      showParts: true,
    },
    0
  );

/** Field of one charge at (x, y): E = k·q/r² along the line from the charge, V = k·q/r. */
export function fieldOf(c, x, y) {
  const dx = (x - c.x) / 100;
  const dy = (y - c.y) / 100;
  const r = Math.hypot(dx, dy);
  const q = c.q * 1e-9;
  if (q === 0) return { ex: 0, ey: 0, v: 0 };
  return { ex: (K * q * dx) / r ** 3, ey: (K * q * dy) / r ** 3, v: (K * q) / r };
}

/** Superposition: vector sum of the fields, scalar sum of the potentials. */
export function field(charges, x, y) {
  let ex = 0;
  let ey = 0;
  let v = 0;
  for (const c of charges) {
    const f = fieldOf(c, x, y);
    ex += f.ex;
    ey += f.ey;
    v += f.v;
  }
  return { ex, ey, e: Math.hypot(ex, ey), v };
}

/** State from the host is untrusted: rebuild it key by key. */
export function sanitize(incoming, base) {
  const num = (v, lo, hi, d) => (Number.isFinite(v) ? clamp(v, lo, hi) : d);
  const s = { ...base };
  if (Array.isArray(incoming.charges)) {
    s.charges = base.charges.map((b, i) => {
      const c = Object(incoming.charges[i]);
      return { q: num(c.q, -QMAX, QMAX, b.q), x: num(c.x, -XMAX, XMAX, b.x), y: num(c.y, -YMAX, YMAX, b.y) };
    });
  }
  s.px = num(incoming.px, -XMAX, XMAX, base.px);
  s.py = num(incoming.py, -YMAX, YMAX, base.py);
  for (const key of ["showGrid", "showParts"]) if (typeof incoming[key] === "boolean") s[key] = incoming[key];
  return pick(s, [0, 1, 2].includes(incoming.selected) ? incoming.selected : 0);
}
