import test from "node:test";
import assert from "node:assert/strict";
import { AB, AC, BC, TRI, initialState, talet, similar, measure, dist } from "./model.js";

const near = (x, y, eps = 1e-9) => assert.ok(Math.abs(x - y) < eps, `${x} ≠ ${y}`);
const st = o => ({ ...initialState(), ...o });
const other = { A: [1.2, 6.3], B: [-2, 0.5], C: [7.4, -1.1] }; // a scalene triangle in general position

test("the triangle has the stated sides 5, 7, 8 cm (angle B = 60°)", () => {
  near(dist(TRI.A, TRI.B), AB);
  near(dist(TRI.A, TRI.C), AC);
  near(dist(TRI.B, TRI.C), BC);
  near(measure([TRI.A, TRI.B, TRI.C]).angles[1], 60);
});

test("Ta-lét: MN ∥ BC gives AM/AB = AN/AC = MN/BC, and AM/MB = AN/NC", () => {
  for (const tri of [TRI, other]) {
    for (let i = 1; i < 20; i++) {
      const r = talet(st({ t: i / 20 }), tri);
      assert.ok(r.parallel, `t = ${i / 20}`);
      near(r.rAB, i / 20);
      near(r.rAC, r.rAB);
      near(r.rBC, r.rAB);
      near(r.rMB, r.rNC);
      near(r.mb / r.ab, r.nc / r.ac);
    }
  }
  const r = talet(st({ t: 0.6 }));
  near(r.am, 3);
  near(r.an, 4.2);
  near(r.mn, 4.8);
});

test("converse: equal ratios ⇔ parallel; unequal ratios are never parallel", () => {
  for (const tri of [TRI, other]) {
    for (let i = 1; i < 20; i++) {
      for (let j = 1; j < 20; j++) {
        const r = talet(st({ converse: true, t: i / 20, u: j / 20 }), tri);
        assert.equal(r.parallel, i === j, `t = ${i / 20}, u = ${j / 20}`);
      }
    }
  }
  // slider values arrive as parsed strings; equal steps must still count as equal
  assert.ok(talet(st({ converse: true, t: Number("0.35"), u: 7 / 20 })).parallel);
});

test("in the locked mode N follows M whatever u says", () => {
  const r = talet(st({ converse: false, t: 0.3, u: 0.9 }));
  near(r.u, 0.3);
  assert.ok(r.parallel);
});

test("degenerate positions: M at A or at B", () => {
  const atA = talet(st({ t: 0 }));
  assert.equal(atA.degenerate, true);
  assert.equal(atA.parallel, false);
  near(atA.mn, 0);
  near(atA.rAB, 0);
  near(atA.rBC, 0);
  near(atA.rMB, 0);
  const atB = talet(st({ t: 1 }));
  assert.equal(atB.degenerate, true);
  assert.equal(atB.parallel, false); // MN is BC itself
  near(atB.rBC, 1);
  assert.equal(atB.rMB, Infinity); // MB = 0
  for (const r of [atA, atB, talet(st({ converse: true, t: 0, u: 1 }))]) {
    for (const v of [r.rAB, r.rAC, r.rBC, r.mn]) assert.ok(!Number.isNaN(v));
  }
});

test("forged state is clamped", () => {
  const r = talet({ t: 7, u: -3, converse: true });
  assert.equal(r.t, 1);
  assert.equal(r.u, 0);
  assert.equal(talet({ t: NaN }).t, 0);
  assert.equal(similar({ k: 1e9 }).k, 2.5);
  assert.equal(similar({ k: NaN }).k, 1);
});

test("similar triangles: equal angles, sides in ratio k, perimeter ratio k, area ratio k²", () => {
  for (const tri of [TRI, other]) {
    for (let k = 0.5; k <= 2.5 + 1e-9; k += 0.1) {
      const r = similar({ k }, tri);
      r.m.angles.forEach((a, i) => near(r.m2.angles[i], a));
      r.sideRatios.forEach(v => near(v, r.k));
      near(r.perimeterRatio, r.k);
      near(r.areaRatio, r.k * r.k);
    }
  }
  const r = similar({ k: 1.5 });
  near(r.m2.sides[0], 12);
  near(r.areaRatio, 2.25);
  // the two triangles never overlap: A'B'C' starts to the right of ABC
  for (const k of [0.5, 1, 2.5]) {
    const { P, Q } = similar({ k });
    assert.ok(Math.min(...Q.map(p => p[0])) > Math.max(...P.map(p => p[0])));
  }
});
