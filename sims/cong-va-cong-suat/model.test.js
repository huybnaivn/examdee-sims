import test from "node:test";
import assert from "node:assert/strict";
import { initialState, work, forces, task, duration, machinePower, step, powerUnits, progress, G, HP } from "./model.js";

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);

test("A = F·s·cosα: positive, zero at 90°, negative past 90°", () => {
  near(work(100, 5, 0), 500);
  near(work(100, 5, 60), 250);
  near(work(100, 5, 90), 0);
  near(work(100, 5, 180), -500);
  assert.ok(work(100, 5, 120) < 0);
});

test("lifting: A = m·g·h by the pull, −m·g·h by gravity", () => {
  const s = { ...initialState(), mass: 50, distance: 6 };
  const [F, P] = forces(s);
  near(F.force, 50 * G);
  near(F.work, 50 * G * 6);
  near(P.work, -50 * G * 6);
  near(task(s).useful, 2943);
});

test("pushing at constant speed: gravity and N do no work, friction does negative work", () => {
  for (const angle of [0, 20, 45, 60]) {
    const s = { ...initialState(), task: "push", mass: 40, distance: 10, mu: 0.3, angle };
    const [F, P, N, Fms] = forces(s);
    near(F.force * Math.cos((angle * Math.PI) / 180), Fms.force); // balanced horizontally
    near(N.force + F.force * Math.sin((angle * Math.PI) / 180), 40 * G); // balanced vertically
    near(P.work, 0);
    near(N.work, 0);
    near(Fms.work, -Fms.force * 10);
    near(F.work + Fms.work, 0); // constant speed: the works cancel
  }
  const flat = forces({ ...initialState(), task: "push", mass: 40, mu: 0.3, angle: 0, distance: 10 });
  near(flat[0].work, 0.3 * 40 * G * 10);
});

test("P = A/t; the same work done faster needs more power", () => {
  const s = initialState();
  for (const k of [1, 2]) near(task(s).total / duration(s, k), machinePower(s, k));
  near(machinePower(s, 1), 75);
  near(machinePower(s, 2), HP);
  assert.ok(duration(s, 2) < duration(s, 1));
  near(duration(s, 1) / duration(s, 2), HP / 75);
  near(machinePower({ ...s, machine1: "motor", power1: 3.5 }, 1), 3500);
});

test("efficiency: A_ci = H·A_tp", () => {
  const s = { ...initialState(), efficiency: 80 };
  near(task(s).useful, 0.8 * task(s).total);
  const full = { ...s, efficiency: 100 };
  near(task(full).total, task(full).useful);
  assert.ok(duration(s, 1) > duration(full, 1));
});

test("units: 1 kW = 1000 W, 1 mã lực ≈ 746 W", () => {
  const u = powerUnits(1492);
  near(u.kW, 1.492);
  near(u.HP, 2);
});

test("step reports each machine once, when it finishes", () => {
  const s = initialState();
  const done = [];
  const t2 = duration(s, 2);
  const t1 = duration(s, 1);
  while (s.time < t1) done.push(...step(s, 0.05).map(k => [k, s.time]));
  assert.deepEqual(done.map(d => d[0]), [2, 1]);
  near(done[0][1], Math.ceil(t2 / 0.05) * 0.05, 1e-6);
  near(s.time, t1);
  assert.equal(progress(s, 1), 1);
  step(s, 0.05); // a finished race restarts
  assert.ok(s.time <= 0.05 + 1e-12);
});
