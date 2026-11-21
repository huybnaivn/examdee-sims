import test from "node:test";
import assert from "node:assert/strict";
import { initialState, focalLength, imageDistance, magnification, imageHeight, describe, principalRays } from "./model.js";

const mirror = (mirrorType, focal, distance, height = 5) => ({ ...initialState(), mirrorType, focal, distance, height });
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const DS = [2, 7.5, 10, 24, 30, 45.5, 60];
const cases = [];
for (const type of ["plane", "concave", "convex"])
  for (const f of [5, 12, 15, 25]) for (const d of DS) if (type !== "concave" || d !== f) cases.push(mirror(type, f, d));

test("plane mirror: image the same size, the same distance behind the mirror, upright, virtual", () => {
  for (const d of DS) {
    const s = mirror("plane", 15, d, 4);
    close(imageDistance(s), -d);
    close(magnification(s), 1);
    close(imageHeight(s), 4);
    assert.deepEqual(describe(s), { atInfinity: false, real: false, upright: true, size: "equal" });
  }
});

test("mirror equation 1/f = 1/d + 1/d' (1/f = 0 for the plane mirror)", () => {
  for (const s of cases) close(1 / focalLength(s), 1 / s.distance + 1 / imageDistance(s));
  close(imageDistance(mirror("concave", 15, 40)), 24);
  close(imageDistance(mirror("convex", 15, 30)), -10);
});

test("k = -d'/d and A'B' = k·AB", () => {
  for (const s of cases) {
    close(magnification(s), -imageDistance(s) / s.distance);
    close(imageHeight(s), magnification(s) * s.height);
  }
  close(magnification(mirror("concave", 15, 40)), -0.6);
});

test("concave mirror, object inside the focus: virtual, upright, magnified", () => {
  for (const [f, d] of [[15, 5], [15, 14.5], [25, 2], [10, 9]]) {
    const s = mirror("concave", f, d);
    assert.ok(imageDistance(s) < 0);
    assert.ok(magnification(s) > 1);
    assert.deepEqual(describe(s), { atInfinity: false, real: false, upright: true, size: "larger" });
  }
});

test("concave mirror, object beyond the focus: real, inverted", () => {
  assert.deepEqual(describe(mirror("concave", 15, 25)), { atInfinity: false, real: true, upright: false, size: "larger" });
  assert.deepEqual(describe(mirror("concave", 15, 40)), { atInfinity: false, real: true, upright: false, size: "smaller" });
});

test("convex mirror: always virtual, upright, reduced, between the mirror and F", () => {
  for (const s of cases.filter(c => c.mirrorType === "convex")) {
    assert.deepEqual(describe(s), { atInfinity: false, real: false, upright: true, size: "smaller" });
    assert.ok(imageDistance(s) < 0 && imageDistance(s) > focalLength(s));
  }
});

test("object at the centre of curvature (d = 2f): image at C, same size, inverted", () => {
  for (const f of [5, 10, 15, 25]) {
    const s = mirror("concave", f, 2 * f);
    close(imageDistance(s), 2 * f);
    close(magnification(s), -1);
    assert.deepEqual(describe(s), { atInfinity: false, real: true, upright: false, size: "equal" });
  }
});

test("object on the focus of a concave mirror: image at infinity, reflected rays parallel", () => {
  const s = mirror("concave", 15, 15);
  assert.equal(imageDistance(s), Infinity);
  assert.equal(describe(s).atInfinity, true);
  const rays = principalRays(s);
  assert.equal(rays.length, 2);
  close(rays[0].slope, rays[1].slope);
});

test("every drawn ray starts where the incident ray meets the mirror and passes through the image point", () => {
  for (const s of cases) {
    const x = -imageDistance(s); // image position on the axis
    const rays = principalRays(s);
    assert.equal(rays.length, 3);
    for (const r of rays) close(r.y + r.slope * x, imageHeight(s), 1e-8);
  }
});

test("law of reflection at the mirror for the plane-mirror rays and the vertex ray", () => {
  // incident slope from the tip (-d, h) to (0, y) is (y - h)/d; reflection off a vertical mirror flips its sign
  for (const s of cases) {
    const rays = principalRays(s);
    for (const r of s.mirrorType === "plane" ? rays : [rays[1]]) close(r.slope, -(r.y - s.height) / s.distance);
  }
});
