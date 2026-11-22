import { test } from "node:test";
import assert from "node:assert/strict";
import { SET, RANGE, RENAL, DAY, GLYCOGEN_MAX, CONDITIONS, LIMITS, GOAL, parseEvents, formatEvents, addEvent, removeLast, insulinTarget, glucagonTarget, simulate, goalReached, mealLoad, clock, initialState, conditionOf } from "./model.js";

const { healthy, type1, type2 } = CONDITIONS;
const inBand = g => g >= RANGE[0] && g <= RANGE[1];

test("fasting: glucose is held just under the set point by glucagon, liver glycogen is used up slowly", () => {
  const d = simulate("", healthy);
  assert.equal(d.G.length, DAY + 1);
  assert.ok(d.G.every(inBand));
  assert.ok(d.G[600] > 4.5 && d.G[600] < SET);
  assert.ok(d.glucagon[600] > 0 && d.insulin[600] === 0);
  assert.ok(d.glycogen[600] < d.glycogen[0]);
  assert.equal(d.peak, SET);
  assert.equal(d.above, 0);
});

test("healthy: after a meal glucose rises, then returns to the range and settles near the set point", () => {
  const d = simulate("m,60,60", healthy);
  const top = d.G.indexOf(d.peak);
  assert.ok(top > 60 && top < 60 + 90, `peak at ${top}`);
  assert.ok(d.peak > 6.5 && d.peak <= RANGE[1], `peak ${d.peak}`);
  assert.equal(d.above, 0);
  for (let t = 60 + 180; t <= DAY; t++) assert.ok(Math.abs(d.G[t] - SET) < 0.4, `t=${t} G=${d.G[t]}`);
  // an oversized meal overshoots but still comes back within 3 hours
  const big = simulate("m,60,120", healthy);
  assert.ok(big.peak > RANGE[1]);
  assert.ok(big.G.slice(60 + 180).every(inBand));
});

test("negative feedback: insulin answers high glucose, glucagon answers low glucose", () => {
  assert.equal(insulinTarget(SET), 0);
  assert.equal(glucagonTarget(SET), 0);
  for (let g = 0; g < 20; g += 0.5) {
    assert.ok(insulinTarget(g + 0.5) >= insulinTarget(g));
    assert.ok(glucagonTarget(g + 0.5) <= glucagonTarget(g));
    assert.ok(insulinTarget(g) === 0 || glucagonTarget(g) === 0); // never both
  }
  assert.ok(insulinTarget(8) > 0 && glucagonTarget(8) === 0);
  assert.ok(glucagonTarget(4) > 0 && insulinTarget(4) === 0);
  // in the day: insulin peaks after the meal, shortly after glucose does
  const d = simulate("m,60,60", healthy);
  const gTop = d.G.indexOf(d.peak);
  const iTop = d.insulin.indexOf(Math.max(...d.insulin));
  assert.ok(d.insulin[gTop] > 1 && d.insulin[30] === 0);
  assert.ok(iTop >= gTop && iTop - gTop < 30);
  assert.ok(d.glucagon[gTop] < 0.2 * d.glucagon[59]); // glucagon is switched off while glucose is high
  // exercise while fasting pulls glucose down and glucagon up
  const x = simulate("x,300,60,3", healthy);
  assert.ok(x.G[355] < x.G[299]);
  assert.ok(x.glucagon[355] > 3 * x.glucagon[299]);
});

test("insulin stores glycogen in the liver, glucagon releases it", () => {
  const d = simulate("m,60,80", healthy);
  assert.ok(d.glycogen[240] > d.glycogen[60] + 5);
  assert.ok(d.glycogen[DAY] < d.glycogen[240]); // the night's fast uses it again
  assert.ok(d.glycogen.every(v => v >= 0 && v <= GLYCOGEN_MAX));
});

test("without insulin glucose stays elevated; type 1 is far worse than healthy", () => {
  const none = simulate("m,60,60", { secretion: 0, sensitivity: 1 });
  assert.ok(none.insulin.every(v => v === 0));
  assert.ok(none.peak > RENAL);
  assert.ok(none.G[60 + 240] > RANGE[1], `4 h after the meal: ${none.G[300]}`);
  assert.ok(none.above > 300);
  const h = simulate(initialState().events, healthy);
  const t1 = simulate(initialState().events, type1);
  assert.equal(h.above, 0);
  assert.ok(h.inRange);
  assert.ok(t1.above > 600, `${t1.above} min above range`);
  assert.ok(t1.peak > 2 * h.peak - SET);
  assert.ok(Math.max(...t1.insulin) < 0.1 * Math.max(...h.insulin));
});

test("insulin resistance (type 2): more insulin, yet a higher and longer peak", () => {
  const h = simulate("m,60,60", healthy);
  const t2 = simulate("m,60,60", type2);
  assert.ok(t2.peak > h.peak + 1.5);
  assert.ok(t2.above > 30 && h.above === 0);
  assert.ok(Math.max(...t2.insulin) > 1.5 * Math.max(...h.insulin));
  assert.ok(t2.G.slice(60 + 300).every(inBand)); // it does come back, slowly
});

test("exercise lowers glucose", () => {
  for (const p of [healthy, type1, type2]) {
    const rest = simulate("m,60,60", p);
    const walk = simulate("m,60,60;x,80,60,2", p);
    assert.ok(walk.peak < rest.peak);
    for (let t = 90; t <= 140; t += 10) assert.ok(walk.G[t] < rest.G[t]);
    assert.ok(walk.above <= rest.above);
  }
  // harder exercise lowers it more
  const at = level => simulate(`x,300,45,${level}`, healthy).G[340];
  assert.ok(at(3) < at(2) && at(2) < at(1) && at(1) < simulate("", healthy).G[340]);
});

test("type 2 can be kept in range with smaller meals and exercise after eating, not without", () => {
  const meals = [0, 1, 2, 3].map(i => `m,${60 + i * 240},40`).join(";");
  const moves = [0, 1, 2, 3].map(i => `x,${70 + i * 240},60,2`).join(";");
  assert.ok(!goalReached(simulate(meals, type2)));
  const day = simulate(parseEvents(`${meals};${moves}`), type2);
  assert.ok(day.inRange && goalReached(day), `peak ${day.peak}`);
  assert.equal(day.meals, 4);
  assert.equal(day.carbs, 160);
  assert.equal(day.exercises, 4);
});

test("goal needs real meals in the day", () => {
  assert.ok(simulate("", healthy).inRange);
  assert.ok(!goalReached(simulate("", healthy)));
  assert.ok(!goalReached(simulate("m,60,60;m,400,60", healthy)));
  assert.ok(goalReached(simulate("m,60,50;m,400,50;m,780,50", healthy)));
  assert.ok(GOAL.meals === 3 && GOAL.carbs === 150);
  assert.ok(goalReached(simulate(initialState().events, healthy)));
  assert.ok(!goalReached(simulate(initialState().events, type2)));
});

test("summary agrees with the curve", () => {
  const d = simulate("m,60,120;m,300,120;x,700,60,3", type2);
  assert.equal(d.peak, Math.max(...d.G));
  assert.equal(d.low, Math.min(...d.G));
  assert.equal(d.above, d.G.filter(g => g > RANGE[1]).length);
  assert.equal(d.below, d.G.filter(g => g < RANGE[0]).length);
  assert.equal(d.inRange, d.above === 0 && d.below === 0);
});

test("values stay non-negative, finite and bounded for any schedule and any condition", () => {
  const schedules = [
    "",
    Array.from({ length: 8 }, (_, i) => `m,${i * 20},120`).join(";"),
    Array.from({ length: 8 }, (_, i) => `x,${i * 90},90,3`).join(";"),
    "m,0,120;x,0,90,3;m,1439,120;x,1439,90,3",
  ];
  for (const p of [healthy, type1, type2, { secretion: 0, sensitivity: 0 }, { secretion: 99, sensitivity: 99 }, {}]) {
    for (const text of schedules) {
      const d = simulate(text, p);
      for (const key of ["G", "insulin", "glucagon", "glycogen"]) {
        assert.equal(d[key].length, DAY + 1);
        assert.ok(d[key].every(v => Number.isFinite(v) && v >= 0), key);
      }
      // glucose can never exceed what the meals brought in (mass balance), whatever the hormones do
      assert.ok(d.peak <= SET + parseEvents(text).reduce((sum, e) => sum + (e.kind === "m" ? mealLoad(e.carbs) : 0), 0), `peak ${d.peak}`);
      assert.ok(Math.max(...d.insulin) <= 2 * d.peak && Math.max(...d.glucagon) <= SET);
      assert.ok(Math.max(...d.glycogen) <= GLYCOGEN_MAX);
    }
  }
});

test("schedule string: parse, clamp, limit, add, remove", () => {
  assert.deepEqual(parseEvents("m,60,60;x,660,30,2"), [{ kind: "m", t: 60, carbs: 60 }, { kind: "x", t: 660, minutes: 30, level: 2 }]);
  assert.deepEqual(parseEvents("x,660,30,2;m,60,60").map(e => e.t), [60, 660]); // sorted by time
  assert.deepEqual(parseEvents("m,-5,9999;x,99999,1,7"), [{ kind: "m", t: 0, carbs: 120 }, { kind: "x", t: 1439, minutes: 10, level: 3 }]);
  for (const bad of [null, undefined, 42, "", ";;;", "m", "m,1", "q,1,2", "m,a,b", "m,NaN,3", "x,1,Infinity,2", "<script>"]) assert.deepEqual(parseEvents(bad), [], String(bad));
  assert.equal(parseEvents(Array(50).fill("m,10,10").join(";")).length, LIMITS.events);
  assert.equal(formatEvents(parseEvents("m,60,60;x,660,30,2")), "m,60,60;x,660,30,2");
  assert.equal(addEvent("m,60,60", { kind: "x", t: 30, minutes: 20, level: 1 }), "x,30,20,1;m,60,60");
  const full = Array.from({ length: 8 }, (_, i) => `m,${i * 10},10`).join(";");
  assert.equal(parseEvents(addEvent(full, { kind: "m", t: 500, carbs: 50 })).length, 8);
  assert.equal(removeLast("m,60,60;x,660,30,2"), "m,60,60");
  assert.equal(removeLast(""), "");
});

test("helpers", () => {
  assert.equal(clock(0), "06:00");
  assert.equal(clock(405), "12:45");
  assert.equal(clock(1080), "00:00");
  assert.equal(clock(1440), "06:00");
  assert.ok(Math.abs(mealLoad(54) - 20) < 1e-9); // 54 g = 0.3 mol in 15 L
  assert.equal(conditionOf({ condition: "nope" }), healthy);
  assert.equal(conditionOf({ condition: "type2" }), type2);
});
