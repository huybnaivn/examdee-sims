import test from "node:test";
import assert from "node:assert/strict";
import { initialState, focalLength, imageDistance, magnification, imageHeight, describe, principalRays } from "./model.js";

const lens = (lensType, focal, distance, height = 5) => ({ ...initialState(), lensType, focal, distance, height });
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const cases = [];
for (const type of ["converging", "diverging"])
  for (const f of [5, 12, 15, 25]) for (const d of [2, 7.5, 10, 24, 30, 45.5, 60]) if (type === "diverging" || d !== f) cases.push(lens(type, f, d));

test("1/f = 1/d + 1/d'", () => {
  for (const s of cases) close(1 / focalLength(s), 1 / s.distance + 1 / imageDistance(s));
  close(imageDistance(lens("converging", 15, 25)), 37.5);
  close(imageDistance(lens("diverging", 15, 30)), -10);
});

test("k = -d'/d and A'B' = k·AB", () => {
  for (const s of cases) {
    close(magnification(s), -imageDistance(s) / s.distance);
    close(imageHeight(s), magnification(s) * s.height);
  }
});

test("converging lens, object inside the focal length: virtual, upright, magnified", () => {
  for (const [f, d] of [[15, 5], [15, 14.5], [25, 2], [10, 9]]) {
    const s = lens("converging", f, d);
    assert.ok(imageDistance(s) < 0);
    assert.ok(magnification(s) > 1);
    assert.deepEqual(describe(s), { atInfinity: false, real: false, upright: true, size: "larger" });
  }
});

test("converging lens, object beyond the focal length: real, inverted", () => {
  assert.deepEqual(describe(lens("converging", 15, 25)), { atInfinity: false, real: true, upright: false, size: "larger" });
  assert.deepEqual(describe(lens("converging", 15, 40)), { atInfinity: false, real: true, upright: false, size: "smaller" });
});

test("diverging lens: always virtual, upright, reduced, between F' and the lens", () => {
  for (const s of cases.filter(c => c.lensType === "diverging")) {
    assert.deepEqual(describe(s), { atInfinity: false, real: false, upright: true, size: "smaller" });
    assert.ok(imageDistance(s) < 0 && imageDistance(s) > focalLength(s));
  }
});

test("object at 2f: image at 2f, same size, inverted", () => {
  for (const f of [5, 10, 15, 25]) {
    const s = lens("converging", f, 2 * f);
    close(imageDistance(s), 2 * f);
    close(magnification(s), -1);
    assert.equal(describe(s).size, "equal");
  }
});

test("object on the focal point: image at infinity", () => {
  const s = lens("converging", 15, 15);
  assert.equal(imageDistance(s), Infinity);
  assert.equal(describe(s).atInfinity, true);
  assert.equal(principalRays(s).length, 2);
  close(principalRays(s)[0].slope, principalRays(s)[1].slope); // emerging rays are parallel
});

test("the three principal rays all pass through the image point", () => {
  for (const s of cases) {
    const x = imageDistance(s);
    const rays = principalRays(s);
    assert.equal(rays.length, 3);
    for (const r of rays) close(r.y + r.slope * x, imageHeight(s), 1e-8);
  }
});
