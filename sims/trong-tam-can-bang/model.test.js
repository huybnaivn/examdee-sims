import test from "node:test";
import assert from "node:assert/strict";
import {
  SHAPES, PINS, SIZE, TOLERANCE, area, centroid, gyration2, inside, pinOf, equilibriumAngle, lean, toWorld, toPlate, isSettled,
  plumbLine, intersect, stepHang, lineCount, markError, toppleAngle, criticalAngle, footOffset, isStable, hasToppled, stepTopple,
  RIM, surfaceY, equilibriumType, stepBall, initialState, tidy, newShape,
} from "./model.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);
const DT = 1 / 120;
const make = over => ({ ...initialState(), ...over });
const settle = s => {
  for (let i = 0; i < 120 * 60; i++) if (stepHang(s, DT)) return i * DT;
  return Infinity;
};

test("shoelace area and centroid of known polygons", () => {
  near(area(SHAPES.rect.pts), 160);
  assert.deepEqual(centroid(SHAPES.rect.pts), [8, 5]);
  // triangle: one third of the way, the mean of the vertices
  near(area(SHAPES.triangle.pts), (18 * 14) / 2);
  near(centroid(SHAPES.triangle.pts)[0], (0 + 18 + 5) / 3);
  near(centroid(SHAPES.triangle.pts)[1], 14 / 3);
  // L-plate = 16×7 rectangle + 7×9 rectangle: the weighted mean of the two centres
  near(area(SHAPES.L.pts), 16 * 7 + 7 * 9);
  near(centroid(SHAPES.L.pts)[0], (112 * 8 + 63 * 3.5) / 175);
  near(centroid(SHAPES.L.pts)[1], (112 * 3.5 + 63 * 11.5) / 175);
  // irregular pentagon: split into triangles from its first vertex
  const p = SHAPES.polygon.pts;
  let A = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 1; i < p.length - 1; i++) {
    const a = ((p[i][0] - p[0][0]) * (p[i + 1][1] - p[0][1]) - (p[i][1] - p[0][1]) * (p[i + 1][0] - p[0][0])) / 2;
    A += a;
    cx += (a * (p[0][0] + p[i][0] + p[i + 1][0])) / 3;
    cy += (a * (p[0][1] + p[i][1] + p[i + 1][1])) / 3;
  }
  near(area(p), A);
  near(centroid(p)[0], cx / A);
  near(centroid(p)[1], cy / A);
  // the centroid does not depend on where the outline starts, and moves with the plate
  const turned = [...p.slice(2), ...p.slice(0, 2)].map(([x, y]) => [x + 3, y - 2]);
  near(centroid(turned)[0], cx / A + 3);
  near(centroid(turned)[1], cy / A - 2);
});

test("radius of gyration of a rectangle is (w² + h²)/12", () => {
  near(gyration2(SHAPES.rect.pts), (16 * 16 + 10 * 10) / 12);
  near(gyration2(SHAPES.rect.pts.map(([x, y]) => [x + 40, y + 7])), (16 * 16 + 10 * 10) / 12, 1e-9); // about the centroid, wherever the plate is
});

test("every plate fits the square, is counter-clockwise, and has five distinct holes inside it, off the centroid", () => {
  for (const [name, { pts, pins }] of Object.entries(SHAPES)) {
    assert.ok(area(pts) > 0, name);
    assert.equal(pins.length, PINS);
    for (const [x, y] of pts) assert.ok(x >= 0 && x <= SIZE && y >= 0 && y <= SIZE);
    assert.ok(inside(pts, centroid(pts)), `${name}: centroid inside the plate, so it can be marked`);
    const [cx, cy] = centroid(pts);
    for (const pin of pins) {
      assert.ok(inside(pts, pin), `${name}: hole ${pin} inside`);
      for (const d of [[0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]]) assert.ok(inside(pts, [pin[0] + d[0], pin[1] + d[1]]), `${name}: hole ${pin} clear of the edge`);
      assert.ok(Math.hypot(pin[0] - cx, pin[1] - cy) > 2);
    }
  }
});

test("hanging at rest puts the centre of gravity directly below the pin", () => {
  for (const shape of Object.keys(SHAPES)) {
    for (let pin = 1; pin <= PINS; pin++) {
      const s = make({ shape, pin, angle: equilibriumAngle(shape, pin) });
      const [x, y] = toWorld(s, centroid(SHAPES[shape].pts));
      near(x, 0);
      assert.ok(y < 0);
      near(lean(s), 0);
      assert.equal(isSettled(s), true);
      // and the pin itself is the fixed point
      near(Math.hypot(...toWorld(s, pinOf(s))), 0);
    }
  }
});

test("a plate let go anywhere swings and comes to rest with the centroid below the pin", () => {
  for (const shape of Object.keys(SHAPES)) {
    for (const [pin, angle] of [[1, 0], [2, 2.5], [5, -1.2]]) {
      const s = make({ shape, pin, angle, omega: 0, traced: 0 });
      assert.equal(isSettled(s), false);
      const first = lean(s);
      for (let i = 0; i < 6; i++) stepHang(s, DT);
      assert.ok(Math.abs(lean(s)) < Math.abs(first), "gravity turns it towards equilibrium");
      const t = settle(s);
      assert.ok(t > 0.3 && t < 15, `${shape} pin ${pin} settles in ${t} s`);
      const [x, y] = toWorld(s, centroid(SHAPES[shape].pts));
      near(x, 0);
      assert.ok(y < 0);
      assert.equal(s.traced, 1 << (pin - 1));
      assert.equal(stepHang(s, DT), false); // reported once
    }
  }
});

test("small swings have the physical-pendulum period 2π√((k² + d²)/(g·d))", () => {
  // rectangle hung from the middle of its top edge region: d = 4 cm, k² = (16² + 10²)/12 cm²
  const s = make({ shape: "rect", pin: 3, omega: 0 });
  s.angle = equilibriumAngle("rect", 3) + 0.05;
  const d = 0.04;
  const k2 = (0.16 ** 2 + 0.1 ** 2) / 12;
  const period = 2 * Math.PI * Math.sqrt((k2 + d * d) / (9.8 * d));
  let crossings = [];
  let prev = lean(s);
  for (let i = 1; i < 120 * 4 && crossings.length < 3; i++) {
    stepHang(s, DT);
    if (prev > 0 !== lean(s) > 0) crossings.push(i * DT);
    prev = lean(s);
  }
  // light damping stretches the period only slightly
  assert.ok(Math.abs(crossings[2] - crossings[0] - period) / period < 0.05, `${crossings[2] - crossings[0]} vs ${period}`);
});

test("two plumb lines intersect at the centre of gravity", () => {
  for (const shape of Object.keys(SHAPES)) {
    const c = centroid(SHAPES[shape].pts);
    for (const [a, b] of [[1, 2], [2, 3], [1, 5], [4, 5]]) {
      // lines as the simulation leaves them: the plate is let go, settles, and the vertical is drawn on it
      const lines = [a, b].map(pin => {
        const s = make({ shape, pin, angle: 0.7, omega: 0 });
        settle(s);
        return plumbLine(shape, pin, s.angle);
      });
      const [x, y] = intersect(...lines);
      near(x, c[0], 1e-6);
      near(y, c[1], 1e-6);
    }
    // each plumb line runs from its hole straight through the centroid
    for (let pin = 1; pin <= PINS; pin++) {
      const l = plumbLine(shape, pin);
      near((c[0] - l.x) * l.dy - (c[1] - l.y) * l.dx, 0);
      assert.ok((c[0] - l.x) * l.dx + (c[1] - l.y) * l.dy > 0);
    }
  }
});

test("plate ↔ world coordinates are inverse; mark error and line count", () => {
  const s = make({ shape: "polygon", pin: 4, angle: 1.1 });
  const [x, y] = toPlate(s, toWorld(s, [3.2, 7.9]));
  near(x, 3.2);
  near(y, 7.9);
  const [cx, cy] = centroid(SHAPES.polygon.pts);
  near(markError({ ...s, guessX: cx + 0.3, guessY: cy - 0.4 }), 0.5);
  assert.ok(TOLERANCE >= 0.15, "reachable with the 0.2 cm slider step");
  assert.equal(lineCount({ traced: 0b10101 }), 3);
  assert.equal(lineCount(initialState()), 1);
});

test("toppling angle: tan θ₀ = (b/2)/h with h the height of the centre of gravity", () => {
  near(Math.tan(toppleAngle(3, 9)), 3 / 9);
  // uniform block: centre at half its height, so tan θ₀ = b/H
  for (const [b, H] of [[6, 18], [10, 10], [2, 30]]) {
    near(Math.tan(criticalAngle(b, H)), b / 2 / (H / 2));
    near(Math.tan(criticalAngle(b, H)), b / H);
    const crit = criticalAngle(b, H);
    near(footOffset(H, crit), b / 2); // exactly at the edge of the base
    assert.equal(isStable(b, H, crit - 0.01), true);
    assert.equal(isStable(b, H, crit + 0.01), false);
  }
  near((criticalAngle(10, 10) * 180) / Math.PI, 45);
  assert.equal(isStable(6, 18, 0), true);
});

test("the block stands below the critical slope and falls over above it", () => {
  const crit = (criticalAngle(6, 18) * 180) / Math.PI; // 18.43°
  const stand = make({ slope: crit - 0.5 });
  for (let i = 0; i < 120 * 5; i++) assert.equal(stepTopple(stand, DT), false);
  assert.equal(stand.tilt, 0);
  const fall = make({ slope: crit + 0.5 });
  let landed = 0;
  let t = 0;
  for (let i = 0; i < 120 * 10; i++) {
    if (stepTopple(fall, DT)) {
      landed++;
      t = i * DT;
    }
  }
  assert.equal(landed, 1);
  assert.ok(t > 0.2 && t < 5, `falls in ${t} s`);
  assert.equal(hasToppled(fall), true);
  near(fall.tilt, Math.PI / 2);
  // a block caught half-way goes back onto its base if the ramp is lowered enough
  const back = make({ slope: 0, tilt: 0.1, tiltSpeed: 0 });
  for (let i = 0; i < 120 * 5; i++) stepTopple(back, DT);
  assert.equal(back.tilt, 0);
  assert.equal(back.tiltSpeed, 0);
  // lying on its side (new base H ≥ b, slope ≤ 45°) the block is stable in the range of the controls
  assert.equal(isStable(30, 2, Math.PI / 4), true);
  assert.equal(isStable(10, 10, Math.PI / 4 - 1e-6), true);
});

test("kind of equilibrium follows the sign of the curvature", () => {
  assert.equal(equilibriumType(1.5), "stable");
  assert.equal(equilibriumType(-0.25), "unstable");
  assert.equal(equilibriumType(0), "neutral");
  // moving away from x = 0 raises the ball on a hollow, lowers it on a hump, and does neither on the flat
  assert.ok(surfaceY(1, 0.3) > surfaceY(1, 0));
  assert.ok(surfaceY(-1, 0.3) < surfaceY(-1, 0));
  assert.equal(surfaceY(0, 0.3), 0);
  const run = (curvature, ballX) => {
    const s = make({ curvature, ballX, ballV: 0 });
    for (let i = 0; i < 120 * 40; i++) stepBall(s, DT);
    return s;
  };
  for (const x of [0.1, -0.6]) {
    const stable = run(1, x);
    assert.ok(Math.abs(stable.ballX) < 0.01, "comes back");
    assert.equal(stable.ballV, 0);
    assert.equal(run(-1, x).ballX, Math.sign(x) * RIM, "rolls away to the rim");
    assert.equal(run(0, x).ballX, x, "stays where it is put");
  }
  // exactly on top of the hump it is in equilibrium, however unstable
  assert.equal(run(-1, 0).ballX, 0);
});

test("without resistance the ball's energy ½v²(1 + y′²) + g·y would be conserved: check the equation of motion", () => {
  // undo the damping term and compare the acceleration with the frictionless constraint formula
  const s = make({ curvature: 1.2, ballX: 0.5, ballV: 0.8 });
  const before = { ...s };
  stepBall(s, 1e-6);
  const a = (s.ballV - before.ballV) / 1e-6 + 1 * before.ballV;
  const slope = 1.2 * 0.5;
  near(a, -(slope * (9.8 + 1.2 * 0.8 * 0.8)) / (1 + slope * slope), 1e-6);
});

test("initial state is at rest in every part; forged values are tidied; newShape starts afresh", () => {
  const s = initialState();
  assert.equal(isSettled(s), true);
  assert.equal(stepHang(s, DT), false);
  assert.equal(stepTopple(s, DT), false);
  assert.equal(isStable(s.base, s.height, (s.slope * Math.PI) / 180), true);
  const bad = tidy(make({ angle: 100, omega: 1e9, traced: 1e6, tilt: -4, tiltSpeed: -1e9, ballV: 1e9, shape: "nope", pin: 99 }));
  assert.ok(Math.abs(bad.angle) <= Math.PI && bad.omega === 60 && bad.traced === 31 && bad.tilt === 0 && bad.tiltSpeed === -60 && bad.ballV === 30);
  for (let i = 0; i < 600; i++) stepHang(bad, DT); // unknown shape or pin must not throw
  assert.ok(Number.isFinite(bad.angle));
  const fresh = newShape(make({ shape: "triangle", pin: 4, traced: 7, guessed: true, found: true }));
  assert.deepEqual([fresh.pin, fresh.angle, fresh.traced, fresh.guessed, fresh.found], [1, 0, 0, false, false]);
  assert.equal(isSettled(fresh), false);
});
