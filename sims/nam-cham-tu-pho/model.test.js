import test from "node:test";
import assert from "node:assert/strict";
import { initialState, fieldAt, fieldOf, polesOf, magnets, compassAngle, forceOn, interaction, neutralPoint, onNeutral, fieldLines, MAG } from "./model.js";

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);
const one = (extra = {}) => ({ ...initialState(), count: 1, x1: 0, y1: 0, a1: 0, ...extra });

test("the field of two magnets is the sum of their fields (superposition)", () => {
  const s = { ...initialState(), a2: 90, y2: 1 };
  const [m1, m2] = magnets(s);
  for (const [x, y] of [[0, 0], [1.3, -2], [-4, 2.5]]) {
    const b = fieldAt(s, x, y);
    const b1 = fieldOf(polesOf(m1), x, y);
    const b2 = fieldOf(polesOf(m2), x, y);
    close(b.x, b1.x + b2.x);
    close(b.y, b1.y + b2.y);
  }
});

test("one pole gives q/r² pointing away from N", () => {
  const b = fieldOf([{ x: 0, y: 0, q: 1 }], 3, 0);
  assert.ok(Math.abs(b.x - 1 / 9) / (1 / 9) < 0.01 && b.y === 0);
});

test("a compass needle points along B", () => {
  const s = one();
  for (const [x, y] of [[0, 1.5], [3, 0], [-2, -2]]) {
    const b = fieldAt(s, x, y);
    close(compassAngle(s, x, y), (Math.atan2(b.y, b.x) * 180) / Math.PI);
  }
  // beside a magnet pointing right, B runs from N back to S: the needle points left
  close(Math.abs(compassAngle(s, 0, 1.5)), 180, 1e-6);
  // on the axis beyond N the needle points away from the magnet
  close(compassAngle(s, 3, 0), 0, 1e-6);
});

test("like poles repel, unlike poles attract", () => {
  const nn = initialState(); // N faces N
  assert.equal(interaction(nn), "repel");
  assert.ok(forceOn(nn, 1).x > 0 && forceOn(nn, 0).x < 0);
  const ns = { ...nn, a2: 0 }; // N of magnet 1 faces S of magnet 2
  assert.equal(interaction(ns), "attract");
  assert.ok(forceOn(ns, 1).x < 0);
  // Newton's third law
  close(forceOn(ns, 0).x, -forceOn(ns, 1).x, 1e-12);
});

test("field lines leave N and end on S", () => {
  const s = one();
  const [n, sp] = polesOf(magnets(s)[0]);
  const lines = fieldLines(s);
  assert.ok(lines.length > 0);
  const far = ([x, y]) => Math.abs(x) > 6 || Math.abs(y) > 3.6;
  for (const line of lines) {
    const [x0, y0] = line[0];
    const [x1, y1] = line.at(-1);
    // every line runs out of N, or comes in from beyond the sheet and ends on S
    assert.ok(Math.hypot(x0 - n.x, y0 - n.y) < 0.4 || (far(line[0]) && Math.hypot(x1 - sp.x, y1 - sp.y) < 0.4));
  }
  // with a lone magnet, lines that stay on the sheet close on the S pole
  const closed = lines.filter(l => Math.hypot(l.at(-1)[0] - sp.x, l.at(-1)[1] - sp.y) < 1e-9);
  assert.ok(closed.length >= 6);
  // B points out of N and into S
  const out = fieldAt(s, n.x + 0.3, n.y);
  const into = fieldAt(s, sp.x - 0.3, sp.y);
  assert.ok(out.x > 0 && into.x > 0);
});

test("flipping a magnet reverses its field", () => {
  const s = one({ a1: 30 });
  const f = one({ a1: 210 });
  for (const [x, y] of [[0, 2], [2.5, -1], [-3, 0.5]]) {
    close(fieldAt(f, x, y).x, -fieldAt(s, x, y).x, 1e-12);
    close(fieldAt(f, x, y).y, -fieldAt(s, x, y).y, 1e-12);
  }
});

test("neutral point between two like poles, none between unlike poles", () => {
  const s = initialState();
  const n = neutralPoint(s);
  close(n.x, 0, 1e-6);
  close(n.y, 0, 1e-6);
  assert.ok(!onNeutral(s));
  assert.ok(onNeutral({ ...s, px: 0.1, py: -0.1 }));
  assert.equal(neutralPoint({ ...s, a2: 0 }), null);
  // offset like poles: the point is still found and B vanishes there
  const t = { ...s, x2: 3, y2: 0.6, a2: 200 };
  const m = neutralPoint(t);
  const b = fieldAt(t, m.x, m.y);
  assert.ok(Math.hypot(b.x, b.y) < 1e-6);
});

test("Earth: field enters near the geographic north, compasses point north at the equator", () => {
  const s = { ...initialState(), scene: "earth" };
  assert.ok(fieldAt(s, 0, 2.2).y < 0);
  assert.ok(fieldAt(s, 2.2, 0).y > 0);
  const a = compassAngle(s, 2.5, 0);
  assert.ok(a > 60 && a < 120);
});

test("forged positions are clamped onto the sheet", () => {
  const [m] = magnets({ ...initialState(), x1: 1e9, y1: -1e9 });
  assert.ok(Math.abs(m.x) <= 6 && Math.abs(m.y) <= 3.6);
  assert.ok(MAG.pole < MAG.len / 2);
});
