import test from "node:test";
import assert from "node:assert/strict";
import { initialState, diameter, circumference, ratio, area, schoolCircumference, schoolArea, clampSectors, rearranged, step, ROLL_TIME } from "./model.js";

const near = (a, b, tol = 1e-12) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);

test("C = 2πr = πd, and the textbook C = d × 3,14", () => {
  near(circumference(1), 2 * Math.PI);
  near(circumference(2.5), Math.PI * diameter(2.5));
  near(schoolCircumference(5), 31.4);
  near(schoolCircumference(0.5), 3.14);
});

test("C : d is π for every radius", () => {
  for (let r = 0.5; r <= 5; r += 0.5) near(ratio(r), Math.PI);
});

test("S = πr², and the textbook S = r × r × 3,14", () => {
  near(area(3), 9 * Math.PI);
  near(schoolArea(5), 78.5);
  near(schoolArea(2), 12.56);
});

test("sector count is an even number from 4 to 64", () => {
  assert.equal(clampSectors(16), 16);
  assert.equal(clampSectors(2), 4);
  assert.equal(clampSectors(-10), 4);
  assert.equal(clampSectors(100), 64);
  assert.equal(clampSectors(7), 8);
  assert.equal(clampSectors(NaN), 4);
  assert.equal(rearranged(1, 1000).pieces.length, 64);
});

test("rearranged sectors: width → πr, height → r, area → πr²", () => {
  const r = 3;
  let prev = 0;
  for (const n of [4, 8, 16, 32, 64]) {
    const p = rearranged(r, n);
    near(p.width, n * r * Math.sin(Math.PI / n));
    near(p.approxArea, (n / 2) * r * r * Math.sin((2 * Math.PI) / n)); // the inscribed n-gon
    assert.ok(p.approxArea > prev && p.approxArea < area(r));
    prev = p.approxArea;
  }
  const fine = rearranged(r, 64);
  assert.ok(Math.abs(fine.width - Math.PI * r) / (Math.PI * r) < 0.0005);
  assert.ok(Math.abs(fine.height - r) / r < 0.0013);
  assert.ok(Math.abs(fine.approxArea - area(r)) / area(r) < 0.002);
  near(fine.width, circumference(r) / 2, 0.0005); // half the circumference on top, half below
});

test("neighbouring pieces share a side: the shape has no gaps", () => {
  const p = rearranged(2, 12);
  for (let k = 0; k + 1 < p.pieces.length; k++) {
    const a = p.pieces[k];
    const b = p.pieces[k + 1];
    near(Math.abs(b.x - a.x), p.chord / 2);
    near(Math.hypot(b.x - a.x, b.y - a.y), 2); // the shared side is a radius
  }
});

test("rolling takes one turn and reports the end once", () => {
  const s = { ...initialState(), roll: 0 };
  let ends = 0;
  for (let i = 0; i < ROLL_TIME * 120 + 50; i++) if (step(s, 1 / 120)) ends++;
  assert.equal(s.roll, 1);
  assert.equal(ends, 1);
});
