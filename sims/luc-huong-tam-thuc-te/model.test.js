import test from "node:test";
import assert from "node:assert/strict";
import { initialState, analyse, centripetalAccel, maxFlatSpeed, idealBankSpeed, bankForces, bankLimits, minTopSpeed, bucketSpeed, bucketNormal, atMaxSafeSpeed, pathRadius, carPosition, lapLength, step, G, CAR_MASS } from "./model.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);
const st = over => ({ ...initialState(), ...over });

test("centripetal acceleration a = v²/R", () => {
  near(centripetalAccel(10, 50), 2);
  near(centripetalAccel(20, 50), 8); // doubling v quadruples a
  near(analyse(st({ speed: 12, radius: 50 })).accel, 2.88);
  near(analyse(st({ speed: 12, radius: 50 })).needed, CAR_MASS * 2.88);
  near(analyse(st({ scene: "bucket", vTop: 4, rope: 2 })).accel, 8);
});

test("flat curve: v_max = √(μ·g·R)", () => {
  near(maxFlatSpeed(0.6, 50), Math.sqrt(0.6 * 9.8 * 50));
  near(maxFlatSpeed(0.5, 80) ** 2, 0.5 * G * 80);
  // at v_max the needed centripetal force equals the largest static friction
  const s = st({ mu: 0.6, radius: 50 });
  const a = analyse({ ...s, speed: maxFlatSpeed(0.6, 50) });
  near(a.needed, a.available, 1e-6);
  near(a.available, 0.6 * CAR_MASS * G);
});

test("flat curve: holds up to v_max, skids above it", () => {
  const limit = maxFlatSpeed(0.6, 50); // ≈ 17.15
  assert.ok(analyse(st({ speed: limit - 0.1 })).holds);
  assert.ok(!analyse(st({ speed: limit + 0.1 })).holds);
  assert.equal(analyse(st({ speed: limit + 0.1 })).slip, 1);
  // wet road, same speed: skids
  assert.ok(analyse(st({ speed: 12, mu: 0.6 })).holds);
  assert.ok(!analyse(st({ speed: 12, mu: 0.2 })).holds);
  // no friction at all: any speed skids
  assert.ok(!analyse(st({ speed: 5, mu: 0 })).holds);
});

test("a skidding car follows a wider curve and leaves the road", () => {
  const s = st({ speed: 22, mu: 0.6, radius: 50, dist: 0 });
  near(pathRadius(s), (22 * 22) / (0.6 * G));
  assert.ok(pathRadius(s) > s.radius);
  let prev = carPosition(s).r;
  near(prev, 50);
  for (let d = 5; d < lapLength(s); d += 5) {
    const r = carPosition({ ...s, dist: d }).r;
    assert.ok(r > prev);
    prev = r;
  }
  // a gripping car stays exactly on the road, whatever the distance
  for (const dist of [0, 10, 100, 300]) near(carPosition(st({ dist })).r, 50);
  near(pathRadius(st({})), 50);
});

test("banked curve: ideal speed v0 = √(g·R·tanα) needs no friction", () => {
  for (const [R, bank] of [[50, 20], [100, 10], [30, 35]]) {
    const v0 = idealBankSpeed(R, bank);
    near(v0 * v0, G * R * Math.tan((bank * Math.PI) / 180), 1e-9);
    const f = bankForces(v0, R, bank);
    near(f.friction, 0, 1e-6);
    // N's horizontal component is the whole centripetal force, its vertical component balances the weight
    const a = (bank * Math.PI) / 180;
    near(f.normal * Math.sin(a), (CAR_MASS * v0 * v0) / R, 1e-6);
    near(f.normal * Math.cos(a), CAR_MASS * G, 1e-6);
    // so it holds even on ice
    assert.ok(analyse(st({ scene: "banked", radius: R, bank, mu: 0, speed: v0 })).holds);
  }
});

test("banked curve: friction direction and the range of safe speeds", () => {
  const v0 = idealBankSpeed(50, 20);
  assert.ok(bankForces(v0 + 3, 50, 20).friction > 0); // too fast: friction points down the slope
  assert.ok(bankForces(v0 - 3, 50, 20).friction < 0); // too slow: up the slope
  const { min, max } = bankLimits(0.3, 50, 20);
  assert.ok(min < v0 && v0 < max);
  // at the limits friction is exactly μ·N
  for (const [v, sign] of [[max, 1], [min, -1]]) {
    const f = bankForces(v, 50, 20);
    near(f.friction, sign * 0.3 * f.normal, 1e-6);
  }
  const s = st({ scene: "banked", mu: 0.3, radius: 50, bank: 20 });
  assert.equal(analyse({ ...s, speed: max + 0.2 }).slip, 1);
  assert.equal(analyse({ ...s, speed: min - 0.2 }).slip, -1);
  assert.equal(analyse({ ...s, speed: v0 }).slip, 0);
  // with no banking the formulas reduce to the flat road
  near(bankLimits(0.6, 50, 0).max, maxFlatSpeed(0.6, 50));
  near(bankLimits(0.6, 50, 0).min, 0);
  // ice: only the ideal speed holds
  near(bankLimits(0, 50, 20).min, v0);
  near(bankLimits(0, 50, 20).max, v0);
  // steep and grippy enough: no upper limit
  assert.equal(bankLimits(1, 50, 45).max, Infinity);
});

test("banking raises the maximum safe speed", () => {
  assert.ok(bankLimits(0.6, 50, 20).max > maxFlatSpeed(0.6, 50));
});

test("vertical circle: minimum speed at the top √(g·R)", () => {
  near(minTopSpeed(1), Math.sqrt(9.8));
  near(minTopSpeed(1.6) ** 2, G * 1.6);
  near(bucketNormal(minTopSpeed(1.2), 1.2, 0), 0, 1e-9); // weight alone is the centripetal force
  assert.ok(analyse(st({ scene: "bucket", vTop: 3.2, rope: 1 })).holds);
  assert.ok(!analyse(st({ scene: "bucket", vTop: 3.1, rope: 1 })).holds);
  assert.ok(bucketNormal(3.1, 1, 0) < 0);
  // a longer arm needs a higher speed
  assert.ok(!analyse(st({ scene: "bucket", vTop: 3.2, rope: 2 })).holds);
});

test("bucket speed follows energy conservation; the floor pushes hardest at the bottom", () => {
  const vTop = 4;
  const R = 1;
  near(bucketSpeed(vTop, R, 0), vTop);
  near(bucketSpeed(vTop, R, Math.PI) ** 2, vTop * vTop + 4 * G * R);
  near(bucketNormal(vTop, R, Math.PI) - bucketNormal(vTop, R, 0), 6 * G, 1e-9); // 6·m·g for m = 1 kg
  const s = st({ scene: "bucket", vTop, rope: R, phi: 0 });
  let turns = 0;
  for (let i = 0; i < 120 * 5; i++) {
    const before = s.phi;
    step(s, 1 / 120);
    if (s.phi < before) turns++;
    assert.ok(s.phi >= 0 && s.phi < 2 * Math.PI);
  }
  assert.ok(turns >= 3);
});

test("goal: the largest safe speed, within 3 % below the limit", () => {
  const limit = maxFlatSpeed(0.6, 50);
  assert.ok(atMaxSafeSpeed(st({ speed: 17.1 })));
  assert.ok(atMaxSafeSpeed(st({ speed: limit * 0.975 })));
  assert.ok(!atMaxSafeSpeed(st({ speed: limit * 0.96 })));
  assert.ok(!atMaxSafeSpeed(st({ speed: 17.2 }))); // already skidding
  const banked = st({ scene: "banked", mu: 0.3, radius: 50, bank: 20 });
  assert.ok(atMaxSafeSpeed({ ...banked, speed: bankLimits(0.3, 50, 20).max - 0.05 }));
  assert.ok(!atMaxSafeSpeed({ ...banked, scene: "banked", mu: 1, bank: 45, speed: 40 })); // no upper limit
  assert.ok(!atMaxSafeSpeed(st({ scene: "bucket" })));
});

test("stepping keeps the car on its lap; forged values stay finite", () => {
  const s = st({ dist: 0 });
  for (let i = 0; i < 120 * 60; i++) step(s, 1 / 120);
  assert.ok(s.dist >= 0 && s.dist < lapLength(s));
  near(carPosition(s).r, 50);
  const forged = carPosition(st({ dist: 1e12, speed: 30 }));
  assert.ok(Number.isFinite(forged.x) && Number.isFinite(forged.y));
  const ice = carPosition(st({ mu: 0, dist: 30 })); // straight on
  near(ice.y, -50);
  near(ice.x, 30);
  assert.ok(Number.isFinite(step(st({ scene: "bucket", phi: -1e9 }), 0.01).phi));
});
