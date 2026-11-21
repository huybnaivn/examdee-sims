import test from "node:test";
import assert from "node:assert/strict";
import {
  OV, DD, DISTANCES, initialState, limits, eyePower, eyeFocal, imageDistance, retinaOffset,
  isSharp, correctLens, isCorrect, seenRange, effectiveVergence,
} from "./model.js";

const eye = (o = {}) => ({ ...initialState(), ...o });
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test("lens formula of the eye: 1/f = 1/d + 1/OV when the image is sharp", () => {
  for (const distance of [25, 30, 50, 100, 500]) {
    const s = eye({ eye: "normal", distance });
    assert.ok(isSharp(s));
    close(imageDistance(s), OV);
    close(100 / eyeFocal(s), 100 / distance + 100 / OV); // cm → m on both sides
  }
  // relaxed normal eye looking at infinity: f = OV
  close(eyeFocal(eye({ eye: "normal", distance: 0 })), OV);
});

test("dioptres are 1/f with f in metres", () => {
  const s = eye({ eye: "normal", distance: 25 });
  close(eyePower(s) * (eyeFocal(s) / 100), 1);
  close(eyePower(eye({ eye: "normal", distance: 0 })), 100 / 1.5); // 66,7 dp
});

test("normal eye sees sharply from 25 cm to infinity, not closer", () => {
  for (const distance of DISTANCES) {
    const s = eye({ eye: "normal", distance });
    assert.equal(isSharp(s), distance === 0 || distance >= DD, `d = ${distance}`);
  }
  assert.ok(retinaOffset(eye({ eye: "normal", distance: 20 })) > 0); // behind the retina
});

test("myopic eye: far object focused in front of the retina; D = −1/OC_v fixes it", () => {
  for (const farPoint of [25, 40, 50, 100, 200]) {
    const s = eye({ eye: "myopia", farPoint, distance: 0, lens: 0 });
    assert.ok(!isSharp(s));
    assert.ok(retinaOffset(s) < 0);
    close(correctLens(s), -100 / farPoint);
    s.lens = correctLens(s);
    assert.ok(isSharp(s));
    close(retinaOffset(s), 0);
    close(limits(s).far, effectiveVergence(s)); // relaxed: the virtual image sits at OC_v
    assert.equal(seenRange(s).far, Infinity);
  }
  close(correctLens(eye({ eye: "myopia", farPoint: 50 })), -2);
});

test("hyperopic eye: near object focused behind the retina; D = 1/Đ − 1/OC_c brings the near point to 25 cm", () => {
  for (const nearHyper of [30, 50, 100, 150]) {
    const s = eye({ eye: "hyperopia", nearHyper, distance: 25, lens: 0 });
    assert.ok(!isSharp(s));
    assert.ok(retinaOffset(s) > 0);
    close(correctLens(s), 100 / 25 - 100 / nearHyper);
    s.lens = correctLens(s);
    assert.ok(isSharp(s));
    close(seenRange(s).near, 25);
  }
  close(correctLens(eye({ eye: "hyperopia", nearHyper: 50 })), 2);
  // its far point is virtual, so it must accommodate even for infinity
  assert.ok(limits(eye({ eye: "hyperopia" })).far < 0);
});

test("sharp iff 1/OC_v ≤ U′ ≤ 1/OC_c, and the image is then on the retina", () => {
  for (const e of ["normal", "myopia", "hyperopia"])
    for (const distance of DISTANCES)
      for (let lens = -6; lens <= 6; lens += 0.25) {
        const s = eye({ eye: e, distance, lens });
        const { far, near } = limits(s);
        const u = effectiveVergence(s);
        assert.equal(isSharp(s), u >= far - 1e-9 && u <= near + 1e-9);
        if (isSharp(s)) close(retinaOffset(s), 0, 1e-9);
        else assert.ok(Math.abs(retinaOffset(s)) > 1e-6);
        assert.ok(Number.isFinite(imageDistance(s)) && imageDistance(s) > 0);
      }
});

test("±0,15 dp counts as the correct lens", () => {
  const s = eye({ eye: "myopia", farPoint: 50 });
  for (const [lens, ok] of [[-2, true], [-2.15, true], [-1.85, true], [-2.2, false], [-1.8, false], [0, false]])
    assert.equal(isCorrect({ ...s, lens }), ok, `lens ${lens}`);
  assert.ok(isCorrect(eye({ eye: "normal", lens: 0.1 })));
});
