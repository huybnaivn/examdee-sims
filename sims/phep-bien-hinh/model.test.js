import test from "node:test";
import assert from "node:assert/strict";
import { LIMIT, PRESETS, CODES, initialState, describe, matrix, apply, then, images, classify, length, signedArea, moveVertex, usePreset, sanitize, trig } from "./model.js";

const T = over => matrix(describe({ ...initialState(), ...over }, 1));
const near = (p, q, eps = 1e-9) => assert.ok(Math.abs(p[0] - q[0]) < eps && Math.abs(p[1] - q[1]) < eps, `${p} ≠ ${q}`);
const P = [3, 1];

test("coordinates under each transformation", () => {
  assert.deepEqual(apply(T({ kind: "translate", tx: 2, ty: -5 }), P), [5, -4]);
  assert.deepEqual(apply(T({ kind: "reflect", axis: "ox" }), P), [3, -1]);
  assert.deepEqual(apply(T({ kind: "reflect", axis: "oy" }), P), [-3, 1]);
  assert.deepEqual(apply(T({ kind: "reflect", axis: "yx" }), P), [1, 3]);
  assert.deepEqual(apply(T({ kind: "reflect", axis: "vertical", m: 2 }), P), [1, 1]); // x' = 2m − x
  assert.deepEqual(apply(T({ kind: "reflect", axis: "horizontal", m: -1.5 }), P), [3, -4]); // y' = 2m − y
  // rotation about O: (x; y) → (x cos α − y sin α; x sin α + y cos α)
  assert.deepEqual(apply(T({ kind: "rotate", angle: 90 }), P), [-1, 3]);
  assert.deepEqual(apply(T({ kind: "rotate", angle: 180 }), P), [-3, -1]);
  assert.deepEqual(apply(T({ kind: "rotate", angle: 270 }), P), [1, -3]);
  near(apply(T({ kind: "rotate", angle: 0, free: 45 }), [2, 0]), [Math.SQRT2, Math.SQRT2]);
  near(apply(T({ kind: "rotate", angle: 0, free: -30 }), [0, 2]), [1, Math.sqrt(3)]);
  // rotation about I(1; −1) by 90°: I + R90·(P − I) = (1; −1) + (−2; 2)
  assert.deepEqual(apply(T({ kind: "rotate", angle: 90, center: "point", cx: 1, cy: -1 }), P), [-1, 1]);
  // central symmetry: I is the midpoint of P and P'
  assert.deepEqual(apply(T({ kind: "central" }), P), [-3, -1]);
  assert.deepEqual(apply(T({ kind: "central", center: "point", cx: 1, cy: -1 }), P), [-1, -3]);
  // the centre is ignored unless "point" is chosen
  assert.deepEqual(apply(T({ kind: "rotate", angle: 90, center: "origin", cx: 4, cy: 4 }), P), [-1, 3]);
});

test("numeric codes", () => {
  const code = over => describe({ ...initialState(), ...over }, 1).code;
  assert.equal(code({ kind: "translate" }), 1);
  assert.deepEqual(["ox", "oy", "yx", "vertical", "horizontal"].map(axis => code({ kind: "reflect", axis })), [2, 3, 4, 5, 6]);
  assert.equal(code({ kind: "rotate" }), 7);
  assert.equal(code({ kind: "central" }), 8);
  assert.equal(Object.keys(CODES).length, 8);
});

const all = [
  { kind: "translate", tx: -4, ty: 3 },
  ...["ox", "oy", "yx", "vertical", "horizontal"].map(axis => ({ kind: "reflect", axis, m: 1.5 })),
  ...[90, 180, 270].map(angle => ({ kind: "rotate", angle, center: "point", cx: 2, cy: -3 })),
  { kind: "rotate", angle: 0, free: 37 },
  { kind: "rotate", angle: 0, free: -125, center: "point", cx: -1, cy: 4 },
  { kind: "central", center: "point", cx: 3, cy: 1 },
];

test("lengths and area are preserved; reflections reverse the orientation", () => {
  for (const shape of Object.values(PRESETS)) {
    for (const over of all) {
      const M = T(over);
      const img = shape.map(p => apply(M, p));
      shape.forEach((p, i) => {
        const j = (i + 1) % shape.length;
        assert.ok(Math.abs(length(p, shape[j]) - length(img[i], img[j])) < 1e-9);
        assert.ok(Math.abs(length(p, shape[(i + 2) % shape.length]) - length(img[i], img[(i + 2) % shape.length])) < 1e-9); // diagonals too
      });
      const sign = over.kind === "reflect" ? -1 : 1;
      assert.ok(Math.abs(signedArea(img) - sign * signedArea(shape)) < 1e-7, JSON.stringify(over));
    }
  }
});

test("two reflections in parallel lines make a translation by twice the gap", () => {
  for (const [m1, m2] of [[1, 4], [2, -1.5], [0, 0], [-3, 2.5]]) {
    const s = { ...initialState(), kind: "reflect", axis: "vertical", m: m1, compose: true, kind2: "reflect", axis2: "vertical", m2 };
    const { first, second, M } = images(s);
    s.points.forEach((p, i) => near(second[i], [p[0] + 2 * (m2 - m1), p[1]]));
    assert.deepEqual(classify(M), m1 === m2 ? { type: "identity" } : { type: "translate", tx: 2 * (m2 - m1), ty: 0 });
    assert.ok(first.every((p, i) => p[1] === s.points[i][1]));
    const h = images({ ...s, axis: "horizontal", axis2: "horizontal" });
    s.points.forEach((p, i) => near(h.second[i], [p[0], p[1] + 2 * (m2 - m1)]));
  }
  // Ox then Oy (perpendicular) is the symmetry about O
  assert.deepEqual(classify(then(T({ kind: "reflect", axis: "ox" }), T({ kind: "reflect", axis: "oy" }))), { type: "central", angle: 180, cx: 0, cy: 0 });
});

test("rotating 180° is the central symmetry about the same centre", () => {
  for (const [cx, cy] of [[0, 0], [2, -3], [-4, 1]]) {
    const center = cx || cy ? "point" : "origin";
    const R = T({ kind: "rotate", angle: 180, center, cx, cy });
    assert.deepEqual(R, T({ kind: "central", center, cx, cy }));
    assert.deepEqual(R, T({ kind: "rotate", angle: 0, free: 180, center, cx, cy }).map(v => Math.round(v * 1e9) / 1e9 || 0));
    assert.deepEqual(classify(R), { type: "central", angle: 180, cx, cy });
  }
});

test("four quarter turns bring the shape back", () => {
  for (const over of [{}, { center: "point", cx: 3, cy: -2 }]) {
    for (const angle of [90, 270]) {
      const R = T({ kind: "rotate", angle, ...over });
      for (const shape of Object.values(PRESETS)) {
        let img = shape;
        for (let i = 0; i < 4; i++) {
          img = img.map(p => apply(R, p));
          if (i < 3) assert.notDeepEqual(img, shape);
        }
        assert.deepEqual(img, shape);
      }
    }
  }
  // and composing two rotations about the same centre adds the angles
  const c = classify(then(T({ kind: "rotate", angle: 90, center: "point", cx: 1, cy: 2 }), T({ kind: "rotate", angle: 0, free: 30, center: "point", cx: 1, cy: 2 })));
  assert.deepEqual(c, { type: "rotate", angle: 120, cx: 1, cy: 2 });
});

test("a reflection followed by a translation along its axis is a glide, not a reflection", () => {
  const M = then(T({ kind: "reflect", axis: "ox" }), T({ kind: "translate", tx: 4, ty: 0 }));
  assert.deepEqual(classify(M), { type: "glide", shift: [4, 0] });
  // across the axis it is still a reflection (in y = 1,5)
  assert.equal(classify(then(T({ kind: "reflect", axis: "ox" }), T({ kind: "translate", tx: 0, ty: 3 }))).type, "reflect");
  assert.equal(classify(T({ kind: "reflect", axis: "yx" })).type, "reflect");
});

test("exact quarter-turn trigonometry", () => {
  assert.deepEqual(trig(90), [0, 1]);
  assert.deepEqual(trig(-90), [0, -1]);
  assert.deepEqual(trig(450), [0, 1]);
  assert.deepEqual(trig(-180), [-1, 0]);
});

test("vertices snap to the grid; forged state is cleaned", () => {
  const s = initialState();
  moveVertex(s, 2, 2.6, -99);
  assert.deepEqual(s.points[2], [3, -LIMIT]);
  assert.deepEqual([s.sel, s.vx, s.vy], [2, 3, -LIMIT]);
  usePreset(s, "pentagon");
  assert.equal(s.points.length, 5);
  assert.deepEqual(s.points, PRESETS.pentagon);
  assert.notEqual(s.points[0], PRESETS.pentagon[0]); // a copy, the preset stays untouched

  const base = initialState();
  const bad = sanitize({ points: [[1, 2], [3, "x"], [0, 0]], sel: 9, kind: 5, tx: Infinity, compose: true }, base);
  assert.deepEqual(bad.points, PRESETS.triangle);
  assert.equal(bad.sel, 2);
  assert.equal(bad.kind, undefined);
  assert.equal(bad.tx, undefined);
  assert.equal(bad.compose, true);
  const ok = sanitize({ points: [[1.4, 2], [300, -300], [0, 0], [1, 1]], sel: 1, preset: "quad" }, base);
  assert.deepEqual(ok.points, [[1, 2], [LIMIT, -LIMIT], [0, 0], [1, 1]]);
  assert.deepEqual([ok.vx, ok.vy], [LIMIT, -LIMIT]);
  assert.deepEqual(sanitize({ points: new Array(9).fill([1, 1]) }, base).points, PRESETS.triangle);
  assert.deepEqual(sanitize({ points: "nope", preset: "quad" }, base).points, PRESETS.quad);
  // unknown kinds fall back to a valid transformation
  assert.equal(describe({ ...initialState(), kind: "zoom" }).kind, "translate");
});
