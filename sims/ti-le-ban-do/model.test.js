import test from "node:test";
import assert from "node:assert/strict";
import * as m from "./model.js";

test("real = map × denominator, with centimetres turned into metres", () => {
  assert.equal(m.realDistance(5, 10000), 500); // 5 × 10 000 = 50 000 cm = 500 m
  assert.equal(m.realDistance(1, 5000), 50);
  assert.equal(m.realDistance(2.5, 20000), 500);
  assert.equal(m.realDistance(3, 25000), 750);
  assert.equal(m.realDistance(0, 25000), 0);
});

test("map = real / denominator", () => {
  assert.equal(m.mapLength(500, 10000), 5); // 500 m = 50 000 cm; 50 000 : 10 000 = 5 cm
  assert.equal(m.mapLength(400, 5000), 8);
  assert.equal(m.mapLength(500, 20000), 2.5);
  assert.equal(m.mapLength(1000, 25000), 4);
  for (const denom of m.SCALES) for (const real of [0, 50, 125, 400, 1000]) assert.ok(Math.abs(m.realDistance(m.mapLength(real, denom), denom) - real) < 1e-9);
});

test("scale bar agrees with the scale", () => {
  assert.deepEqual(m.scaleBar(10000), { cm: 2, metres: 200, half: 100 });
  assert.deepEqual(m.scaleBar(25000), { cm: 2, metres: 500, half: 250 });
  for (const denom of m.SCALES) {
    const bar = m.scaleBar(denom);
    assert.equal(m.realDistance(bar.cm, denom), bar.metres);
    assert.equal(m.mapLength(bar.metres, denom), bar.cm);
    assert.equal(bar.half * 2, bar.metres);
    assert.ok(Number.isInteger(bar.metres) && Number.isInteger(bar.half));
  }
});

test("changing the scale changes the map length, not the real distance", () => {
  const base = m.initialState(); // school → park: 400 m east, 300 m south
  const lengths = m.SCALES.map(scale => m.measure({ ...base, scale }));
  for (const r of lengths) {
    assert.equal(r.real, 500);
    assert.equal(r.exact, true);
    assert.equal(r.realFromReading, 500);
    assert.equal(r.mapRead * r.denom, 500 * 100);
  }
  assert.deepEqual(lengths.map(r => r.mapRead), [10, 5, 2.5, 2]);
  // a smaller scale (bigger denominator) gives a shorter length on the map
  for (let i = 1; i < lengths.length; i++) assert.ok(lengths[i].mapExact < lengths[i - 1].mapExact);
});

test("the ruler is read to the millimetre and the calculation uses the reading", () => {
  const r = m.measure({ ...m.initialState(), scale: 25000, ax: 100, ay: 100, bx: 900, by: 400 }); // 854,4 m
  assert.ok(Math.abs(r.real - Math.hypot(800, 300)) < 1e-9);
  assert.equal(r.mapRead, 3.4);
  assert.equal(r.exact, false);
  assert.equal(r.realCm, 85000); // 3,4 × 25 000
  assert.equal(r.realFromReading, 850);
  assert.ok(Math.abs(r.realFromReading - r.real) <= m.realDistance(0.05, 25000) + 1e-9); // within half a millimetre on the map
  for (const scale of m.SCALES) {
    const q = m.measure({ ...m.initialState(), scale, ax: 37, ay: 211, bx: 640, by: 95 });
    assert.equal(q.realFromReading, m.realDistance(q.mapRead, scale));
    assert.equal(q.realCm, q.realFromReading * 100);
    assert.ok(Math.abs(q.mapRead - q.mapExact) <= 0.05 + 1e-9);
  }
});

test("landmarks: on the 100 m grid, inside the town, snap", () => {
  for (const p of m.PLACES) {
    assert.ok(p.x % 100 === 0 && p.y % 100 === 0);
    assert.ok(p.x > 0 && p.x < m.TOWN.w && p.y > 0 && p.y < m.TOWN.h);
    assert.equal(m.snapPlace(p.x + 20, p.y - 20, 30), p);
  }
  assert.equal(m.snapPlace(300, 250, 30), null);
  assert.equal(m.snapPlace(260, 100, 1000).id, "school"); // the nearest one, however generous the tolerance
  assert.equal(m.snapPlace(340, 100, 1000).id, "post");
  assert.equal(m.realBetween(m.place("school"), m.place("park")), 500);
  assert.deepEqual(m.ends({ ax: -50, ay: 9999, bx: NaN, by: 250 }), { a: { x: 0, y: 500 }, b: { x: 0, y: 250 } });
  assert.equal(m.denominator({ scale: 12345 }), 10000);
  const s = m.putOn(m.initialState(), "b", "market");
  assert.deepEqual([s.bx, s.by], [900, 100]);
  assert.deepEqual(m.putOn(m.initialState(), "b", "nowhere"), m.initialState());
});

test("word problems both ways", () => {
  const types = new Set();
  for (let i = 0; i < m.QUESTION_COUNT; i++) {
    const q = m.question(i);
    types.add(q.type);
    assert.ok(m.SCALES.includes(q.denom));
    assert.equal(m.realDistance(q.map, q.denom), q.real);
    assert.equal(m.mapLength(q.real, q.denom), q.map);
    // the answer can be set with the sliders: 50 m steps up to 1000 m, 0,5 cm steps up to 10 cm
    if (q.type === "real") assert.ok(q.answer === q.real && q.real % 50 === 0 && q.real > 0 && q.real <= 1000);
    else assert.ok(q.answer === q.map && (q.map * 2) % 1 === 0 && q.map > 0 && q.map <= 10);
    const s = m.startQuestion({ ...m.initialState(), mode: "practice", qIndex: i });
    assert.equal(s.scale, q.denom);
    const r = m.measure(s);
    assert.ok(r.exact && r.mapRead === q.map && r.realFromReading === q.real, "the ruler confirms the answer");
    assert.equal(m.isCorrect(s), false);
    assert.equal(m.isCorrect({ ...s, answerM: q.real, answerCm: q.map }), true);
    assert.equal(m.isCorrect({ ...s, answerM: q.real + 50, answerCm: q.map + 0.5 }), false);
    // forgetting to change the unit is wrong
    if (q.type === "real") assert.equal(m.isCorrect({ ...s, answerM: Math.min(1000, q.map * q.denom) }), false);
  }
  assert.deepEqual([...types].sort(), ["map", "real"]);
  assert.deepEqual(m.question(0), { type: "real", denom: 10000, from: "school", to: "post", real: 400, map: 4, answer: 400 });
  assert.equal(m.question(1).answer, 2.5);
  assert.deepEqual(m.question(-1), m.question(m.QUESTION_COUNT - 1));
  assert.deepEqual(m.question(NaN), m.question(0));
  const s = m.nextQuestion({ ...m.initialState(), qIndex: m.QUESTION_COUNT - 1, status: "right", answerM: 300 });
  assert.deepEqual([s.qIndex, s.status, s.answerM, s.scale], [0, "", 0, 10000]);
});
