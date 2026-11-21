import test from "node:test";
import assert from "node:assert/strict";
import { K, initialState, field, fieldOf, sanitize, pick, applySelected } from "./model.js";

const near = (a, b, rel = 1e-9) => assert.ok(Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b)), `${a} ≠ ${b}`);

test("one charge: E = k·|q|/r² and V = k·q/r", () => {
  for (const [q, r] of [[2, 4], [-3, 5], [5, 10]]) {
    const f = field([{ q, x: 1, y: -2 }], 1 + r * 0.6, -2 + r * 0.8); // 3-4-5 direction
    near(f.e, (K * Math.abs(q) * 1e-9) / (r / 100) ** 2);
    near(f.v, (K * q * 1e-9) / (r / 100));
  }
  // textbook number: 2 nC at 3 cm gives 20 000 V/m and 600 V
  const f = field([{ q: 2, x: 0, y: 0 }], 3, 0);
  near(f.e, 20000);
  near(f.v, 600);
});

test("doubling the distance divides E by 4 and V by 2", () => {
  const c = [{ q: 4, x: 0, y: 0 }];
  near(field(c, 2, 0).e / field(c, 4, 0).e, 4);
  near(field(c, 2, 0).v / field(c, 4, 0).v, 2);
});

test("field points away from a positive charge and toward a negative one", () => {
  const plus = field([{ q: 3, x: 0, y: 0 }], 2, 1);
  assert.ok(plus.ex > 0 && plus.ey > 0);
  near(plus.ey / plus.ex, 0.5); // along the line from the charge
  const minus = field([{ q: -3, x: 0, y: 0 }], 2, 1);
  assert.ok(minus.ex < 0 && minus.ey < 0);
  near(minus.ex, -plus.ex);
  near(minus.ey, -plus.ey);
});

test("superposition: E is the vector sum, V the scalar sum", () => {
  const charges = [
    { q: 2, x: -4, y: 0 },
    { q: -3, x: 4, y: 1 },
    { q: 5, x: 0, y: -3 },
  ];
  const total = field(charges, 1.5, 2.5);
  const parts = charges.map(c => fieldOf(c, 1.5, 2.5));
  near(total.ex, parts.reduce((a, p) => a + p.ex, 0));
  near(total.ey, parts.reduce((a, p) => a + p.ey, 0));
  near(total.v, parts.reduce((a, p) => a + p.v, 0));
  near(total.e, Math.hypot(total.ex, total.ey));
  assert.ok(total.e < parts.reduce((a, p) => a + Math.hypot(p.ex, p.ey), 0)); // not the sum of magnitudes
});

test("field is zero midway between two equal like charges, potential is not", () => {
  const f = field([{ q: 3, x: -4, y: 1 }, { q: 3, x: 4, y: 1 }], 0, 1);
  assert.ok(f.e < 1e-9);
  near(f.v, (2 * K * 3e-9) / 0.04);
});

test("dipole bisector: potential is zero, field points from + to −", () => {
  const s = initialState(); // +2 nC at (−4, 0), −2 nC at (4, 0), M at (0, 3)
  const f = field(s.charges, s.px, s.py);
  assert.ok(Math.abs(f.v) < 1e-9);
  assert.ok(Math.abs(f.ey) < 1e-9);
  near(f.ex, 2 * ((K * 2e-9) / 0.05 ** 2) * (4 / 5));
});

test("a zero charge contributes nothing, even at its own position", () => {
  const f = field([{ q: 0, x: 1, y: 1 }, { q: 1, x: 0, y: 0 }], 1, 1);
  near(f.e, (K * 1e-9) / 2e-4);
});

test("selection mirrors the chosen charge and writes back", () => {
  const s = pick(initialState(), 1);
  assert.deepEqual([s.selQ, s.selX, s.selY], [-2, 4, 0]);
  s.selQ = 5;
  applySelected(s);
  assert.equal(s.charges[1].q, 5);
});

test("sanitize keeps valid values, clamps and drops junk", () => {
  const base = initialState();
  const s = sanitize(
    { charges: [{ q: 99, x: 1, y: "a" }, null, { q: -1, x: -100, y: 2 }, { q: 1 }], selected: 2, px: NaN, py: 5, showGrid: "yes", evil: 1 },
    base
  );
  assert.deepEqual(s.charges, [{ q: 5, x: 1, y: 0 }, { q: -2, x: 4, y: 0 }, { q: -1, x: -8, y: 2 }]);
  assert.equal(s.selected, 2);
  assert.deepEqual([s.selQ, s.selX, s.selY], [-1, -8, 2]);
  assert.deepEqual([s.px, s.py, s.showGrid], [0, 5, true]);
  assert.ok(!("evil" in s));
  assert.deepEqual(sanitize({ charges: "x", selected: 7 }, initialState()), initialState());
});
