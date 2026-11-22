import test from "node:test";
import assert from "node:assert/strict";
import { initialState, heart, phaseAt, valves, step, tap, traced, PHASES, STATIONS } from "./model.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

test("cardiac output = heart rate × stroke volume", () => {
  for (const [restRate, restSV, exercise] of [[75, 70, 0], [60, 90, 0], [80, 55, 50], [50, 100, 100]]) {
    const h = heart({ ...initialState(), restRate, restSV, exercise });
    near(h.output, (h.rate * h.sv) / 1000);
  }
  near(heart(initialState()).output, 5.25); // 75 nhịp/phút × 70 mL
});

test("cycle duration = 60 / rate, 0,8 s at 75 nhịp/phút, phases 0,1 + 0,3 + 0,4 s", () => {
  const h = heart(initialState());
  near(h.period, 0.8);
  near(heart({ ...initialState(), restRate: 60 }).period, 1);
  const seconds = PHASES.map(p => p.share * h.period);
  seconds.forEach((v, i) => near(v, [0.1, 0.3, 0.4][i]));
});

test("valve states per phase: atrial systole → ventricular systole → common diastole", () => {
  assert.equal(phaseAt(0.05).index, 0);
  assert.equal(phaseAt(0.3).index, 1);
  assert.equal(phaseAt(0.9).index, 2);
  assert.deepEqual(valves(0), { tricuspid: true, mitral: true, pulmonary: false, aortic: false });
  assert.deepEqual(valves(1), { tricuspid: false, mitral: false, pulmonary: true, aortic: true });
  assert.deepEqual(valves(2), { tricuspid: true, mitral: true, pulmonary: false, aortic: false });
  // the two sets of valves are never open together, so blood never flows backwards through the heart
  for (let i = 0; i < 3; i++) assert.notEqual(valves(i).tricuspid, valves(i).pulmonary);
});

test("step keeps t inside one cycle", () => {
  const s = initialState();
  for (let i = 0; i < 1000; i++) step(s, 1 / 120);
  assert.ok(s.t >= 0 && s.t < heart(s).period);
  near(s.t, (1000 / 120) % 0.8, 1e-6);
});

test("blood path order: pulmonary circuit then systemic circuit", () => {
  assert.deepEqual(
    STATIONS.map(x => x.name),
    ["Tâm nhĩ phải", "Tâm thất phải", "Động mạch phổi", "Mao mạch phổi", "Tĩnh mạch phổi",
     "Tâm nhĩ trái", "Tâm thất trái", "Động mạch chủ", "Mao mạch các cơ quan", "Tĩnh mạch chủ"],
  );
  // trace from the left ventricle all the way round, with one wrong tap on the way
  const s = initialState();
  const results = [];
  for (let k = 0; k < 10; k++) {
    if (k === 3) assert.equal(tap(s, 0).correct, false); // right atrium is not next after the body
    results.push(tap(s, (6 + k) % 10));
  }
  assert.ok(results.every(r => r.correct));
  assert.equal(results.at(-1).done, true);
  assert.equal(results.filter(r => r.done).length, 1);
  assert.equal(s.traceMistakes, 1);
  assert.deepEqual(traced(s), [6, 7, 8, 9, 0, 1, 2, 3, 4, 5]);
  // a tap after the goal starts a new trace
  assert.deepEqual(tap(s, 2), { correct: true, done: false });
  assert.equal(s.traceLen, 1);
});

test("exercise raises rate, stroke volume and output; rest pressure ≈ 120/80", () => {
  const rest = heart(initialState());
  near(rest.systolic, 120, 0.5);
  near(rest.diastolic, 80, 0.5);
  near(rest.mean, rest.diastolic + rest.pulse / 3);
  let prev = rest;
  for (const exercise of [25, 50, 75, 100]) {
    const h = heart({ ...initialState(), exercise });
    assert.ok(h.rate > prev.rate && h.sv > prev.sv && h.output > prev.output);
    prev = h;
  }
  near(prev.rate, 190);
  near(prev.sv, 98);
  assert.ok(prev.output > 3 * rest.output);
  assert.ok(prev.systolic > rest.systolic);
});

test("forged trace keys are harmless", () => {
  const s = { ...initialState(), traceStart: 99, traceLen: -5 };
  assert.deepEqual(traced(s), []);
  assert.deepEqual(tap(s, 4), { correct: true, done: false });
  assert.equal(tap(s, 42).correct, false);
});
