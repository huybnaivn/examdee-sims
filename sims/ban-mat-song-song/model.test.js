import test from "node:test";
import assert from "node:assert/strict";
import { CORNERS, PRISM, PERISCOPE_H, initialState, trace, slab, prism, periscope, cell, shiftFormula, refractionAngle, criticalAngle } from "./model.js";

const RAD = Math.PI / 180;
const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);
const S = more => ({ ...initialState(), ...more });
const grid = [];
for (const angle of [0, 10, 30, 50, 70, 85]) for (const thickness of [1, 5, 10]) for (const n of [1, 1.33, 1.5, 2.5]) grid.push({ angle, thickness, n });

test("the emerging ray is parallel to the incident ray", () => {
  for (const g of grid) {
    const r = slab(S(g));
    near(r.out[0], r.dir[0]);
    near(r.out[1], r.dir[1]);
    near(r.A[0], 0); // enters the upper face at the origin
    near(r.A[1], g.thickness);
    near(r.B[1], 0); // leaves through the lower face
  }
});

test("Snell's law at both faces: sin i = n·sin r", () => {
  for (const g of grid) {
    const r = slab(S(g));
    near(Math.sin(r.i * RAD), g.n * Math.sin(r.r * RAD));
    near(r.r, refractionAngle(g.angle, g.n));
    near(r.B[0], g.thickness * Math.tan(r.r * RAD)); // the ray walks e·tan r sideways inside the slab
  }
  near(refractionAngle(50, 1.5), 30.7102, 1e-4);
});

test("lateral shift d = e·sin(i − r)/cos r", () => {
  for (const g of grid) {
    const r = slab(S(g));
    near(r.shift, shiftFormula(g.thickness, r.i, r.r)); // traced distance between the two parallel lines
  }
  near(slab(initialState()).shift, (5 * Math.sin((50 - 30.7102) * RAD)) / Math.cos(30.7102 * RAD), 1e-4);
  near(slab(initialState()).shift, 1.921, 1e-3); // cm
});

test("no shift at normal incidence, nor when the slab has the index of air", () => {
  for (const thickness of [1, 5, 10]) {
    near(slab(S({ angle: 0, thickness })).shift, 0);
    near(slab(S({ angle: 60, thickness, n: 1 })).shift, 0);
  }
});

test("the shift grows with thickness, with the angle and with the index", () => {
  near(slab(S({ thickness: 10 })).shift, 2 * slab(S({ thickness: 5 })).shift); // proportional to e
  let last = 0;
  for (let angle = 1; angle <= 85; angle++) {
    const d = slab(S({ angle })).shift;
    assert.ok(d > last, `angle ${angle}`);
    last = d;
  }
  assert.ok(last < 5); // never more than the thickness
  assert.ok(slab(S({ n: 2 })).shift > slab(S({ n: 1.5 })).shift);
});

test("forged slab values cannot break the tracer", () => {
  for (const bad of [{ angle: 500 }, { angle: -40 }, { thickness: -3 }, { n: 0 }]) {
    const r = slab(S(bad));
    assert.ok(Number.isFinite(r.shift) && Number.isFinite(r.r));
  }
});

test("total internal reflection in a 45° glass prism (n = 1,5)", () => {
  near(criticalAngle(1.5), 41.8103, 1e-4); // sin i_gh = 1/n
  assert.ok(criticalAngle(1.5) < 45);
  const p = prism(S({ turn: 90 }));
  assert.equal(p.tir, 1);
  assert.equal(p.turned, 90);
  assert.equal(p.works, true);
  const hit = p.steps.find(x => x.kind === "tir");
  near(hit.i, 45, 1e-9); // meets the hypotenuse at 45°
  near(p.steps[0].i, 0); // enters and leaves square to the legs: no bending there
  near(p.steps.at(-1).r, 0);
  const back = prism(S({ turn: 180 }));
  assert.equal(back.tir, 2); // once on each leg
  assert.equal(back.turned, 180);
  assert.equal(back.works, true);
  for (const x of back.steps.filter(x => x.kind === "tir")) near(x.i, 45, 1e-9);
  // sent back parallel to itself, displaced sideways
  const [y0, y1] = [back.points[0][1], back.points.at(-1)[1]];
  near(y1, -y0);
});

test("no total reflection when the critical angle exceeds 45° (n < √2)", () => {
  for (const turn of [90, 180]) {
    assert.equal(prism(S({ turn, prismN: 1.3 })).works, false);
    assert.equal(prism(S({ turn, prismN: 1.3 })).tir, 0);
    assert.equal(prism(S({ turn, prismN: 1.41 })).works, false);
    assert.equal(prism(S({ turn, prismN: 1.42 })).works, true);
  }
  assert.ok(criticalAngle(1.3) > 45);
  near(criticalAngle(Math.SQRT2), 45);
  // the light that is not reflected leaves by refraction, obeying Snell's law
  const out = prism(S({ prismN: 1.3 })).steps.at(-1);
  assert.equal(out.kind, "refract");
  near(1.3 * Math.sin(out.i * RAD), Math.sin(out.r * RAD));
});

test("periscope: two prisms, two total reflections, the ray goes on in its first direction", () => {
  const p = periscope(S({ top: "br", bottom: "tl" }));
  assert.equal(p.works, true);
  assert.equal(p.tir, 2);
  near(p.points.at(-1)[1], 0); // comes out at the height of the lower prism,
  near(p.points[0][1], PERISCOPE_H); // having entered at the height of the upper one
  // only that arrangement of the 16 works, and not with too small an index
  const good = [];
  for (const top of CORNERS) for (const bottom of CORNERS) if (periscope(S({ top, bottom })).works) good.push(top + bottom);
  assert.deepEqual(good, ["brtl"]);
  assert.equal(periscope(initialState()).works, false); // the learner has to set it up
  assert.equal(periscope(S({ top: "br", bottom: "tl", prismN: 1.3 })).works, false);
});

test("prism cells are right-angled isosceles triangles", () => {
  for (const corner of CORNERS) {
    const [a, b, c] = cell(0, 0, corner);
    const u = [a[0] - b[0], a[1] - b[1]];
    const v = [c[0] - b[0], c[1] - b[1]];
    near(u[0] * v[0] + u[1] * v[1], 0); // right angle at the named corner
    assert.equal(Math.hypot(...u), PRISM);
    assert.equal(Math.hypot(...v), PRISM);
  }
});

test("tracer: a ray that meets nothing goes straight", () => {
  const t = trace([0, 0], [1, 0], [{ pts: [[5, 5], [6, 5], [6, 6]], n: 1.5 }], 10);
  assert.deepEqual(t.points, [[0, 0], [10, 0]]);
  assert.equal(t.steps.length, 0);
});
