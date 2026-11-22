import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState, METERS, DIVISIONS, HALF_SPAN, R_SHORT, rangeOf, smallestDivision, current, meterValue, bulbCurrent,
  overloaded, needleFraction, needleAngle, snapReading, bestRange, toMilli, fromMilli, measure, checkAnswer, newTask,
} from "./model.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);

test("needle angle is linear in value / range", () => {
  near(needleAngle(0, 3), -HALF_SPAN);
  near(needleAngle(3, 3), HALF_SPAN);
  near(needleAngle(1.5, 3), 0);
  near(needleAngle(0.15, 0.6), -HALF_SPAN / 2);
  // the same current deflects five times as far on the 0,6 A range as on the 3 A range
  near(needleFraction(0.3, 0.6), 5 * needleFraction(0.3, 3));
});

test("needle rests on its stops when overloaded or reversed", () => {
  assert.ok(needleAngle(100, 3) > HALF_SPAN && needleAngle(100, 3) < HALF_SPAN + 8);
  assert.equal(needleAngle(100, 3), needleAngle(5, 3));
  assert.ok(needleAngle(-2, 3) < -HALF_SPAN && needleAngle(-2, 3) > -HALF_SPAN - 8);
});

test("smallest division: 30 divisions per range", () => {
  assert.equal(DIVISIONS, 30);
  near(smallestDivision(0.6), 0.02);
  near(smallestDivision(3), 0.1);
  near(smallestDivision(15), 0.5);
});

test("reading snaps to the smallest division", () => {
  assert.equal(snapReading(0.247, 0.6), 0.24);
  assert.equal(snapReading(0.251, 0.6), 0.26);
  assert.equal(snapReading(0.247, 3), 0.2);
  assert.equal(snapReading(7.3, 15), 7.5);
  assert.equal(snapReading(2.44, 3), 2.4);
  for (const range of [0.6, 3, 15]) {
    for (let k = 0; k <= DIVISIONS; k++) near(snapReading(k * smallestDivision(range), range), k * smallestDivision(range), 1e-6);
  }
});

test("best range is the smallest one that still contains the value", () => {
  assert.equal(bestRange(0.24, [0.6, 3]), 0.6);
  assert.equal(bestRange(0.6, [0.6, 3]), 0.6);
  assert.equal(bestRange(0.61, [0.6, 3]), 3);
  assert.equal(bestRange(3, [3, 15]), 3);
  assert.equal(bestRange(12, [15, 3]), 15);
  assert.equal(bestRange(20, [3, 15]), null);
});

test("overload when the value exceeds the range", () => {
  assert.equal(overloaded(0.7, 0.6), true);
  assert.equal(overloaded(0.6, 0.6), false);
  assert.equal(overloaded(12 / 4, 3), false);
  const s = { ...initialState(), voltage: 12, resistance: 10, ampRange: 0.6 };
  assert.equal(measure(s).overload, true);
  assert.equal(measure(s).reading, null);
  assert.equal(measure({ ...s, ampRange: 3 }).reading, 1.2);
});

test("mA ↔ A and mV ↔ V", () => {
  near(toMilli(0.24), 240);
  near(fromMilli(350), 0.35);
  near(toMilli(1.5), 1500);
  near(fromMilli(toMilli(2.75)), 2.75);
});

test("circuit: ammeter reads I = U / R, voltmeter reads U", () => {
  const s = initialState();
  near(current(s), 6 / 25);
  near(meterValue(s), 0.24);
  near(meterValue({ ...s, meter: "voltmeter" }), 6);
  assert.equal(measure(s).reading, 0.2); // 0,24 A on the 3 A range (ĐCNN 0,1 A)
  assert.equal(measure({ ...s, ampRange: 0.6 }).reading, 0.24);
  assert.equal(measure(s).best, 0.6);
});

test("connection rules: reversed poles and wrong placement", () => {
  const s = initialState();
  near(meterValue({ ...s, wiring: "reversed" }), -0.24);
  assert.equal(measure({ ...s, wiring: "reversed" }).reversed, true);
  assert.equal(measure({ ...s, wiring: "reversed" }).reading, null);
  // ammeter across the bulb: short circuit, overloads every range, bulb is bypassed
  const short = { ...s, wiring: "wrong" };
  near(meterValue(short), 6 / R_SHORT);
  assert.equal(bestRange(meterValue({ ...short, voltage: 1 }), METERS.ammeter.ranges), null);
  assert.equal(bulbCurrent(short), 0);
  // voltmeter in series: no current, reads the source voltage
  const series = { ...s, meter: "voltmeter", wiring: "wrong" };
  near(meterValue(series), 6);
  assert.equal(bulbCurrent(series), 0);
  near(bulbCurrent(s), 0.24);
});

test("forged range or meter falls back safely", () => {
  assert.equal(rangeOf({ ...initialState(), ampRange: -5 }), 3);
  assert.equal(rangeOf({ ...initialState(), meter: "voltmeter", voltRange: 1e9 }), 15);
  assert.equal(rangeOf({ ...initialState(), meter: "x", ampRange: 0.6 }), 0.6);
});

test("checking a practice answer", () => {
  const s = { ...initialState(), mode: "practice", ampRange: 0.6, answer: 12 }; // 0,24 A = 12 divisions of 0,02 A
  assert.equal(checkAnswer(s), "correct");
  assert.equal(checkAnswer({ ...s, answer: 13 }), "wrong");
  assert.equal(checkAnswer({ ...s, ampRange: 3, answer: 2 }), "range"); // right reading, coarser range than needed
  assert.equal(checkAnswer({ ...s, voltage: 12, resistance: 10 }), "overload");
  assert.equal(checkAnswer({ ...s, wiring: "reversed" }), "wiring");
  // needle exactly between two divisions: either neighbour is accepted
  const half = { ...s, voltage: 5, resistance: 20 }; // 0,25 A = 12,5 divisions
  assert.equal(checkAnswer({ ...half, answer: 12 }), "correct");
  assert.equal(checkAnswer({ ...half, answer: 13 }), "correct");
  assert.equal(checkAnswer({ ...half, answer: 14 }), "wrong");
});

test("practice tasks stay inside the control ranges and on some range", () => {
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  let small = 0;
  for (const meter of ["ammeter", "voltmeter"]) {
    for (let i = 0; i < 300; i++) {
      const s = newTask({ ...initialState(), meter, answer: 7, feedback: "wrong" }, rand);
      assert.ok(s.voltage >= 1 && s.voltage <= 12 && s.resistance >= 4 && s.resistance <= 50);
      assert.equal(s.answer, 0);
      assert.equal(s.feedback, "");
      const best = measure(s).best;
      assert.notEqual(best, null);
      if (best === METERS[meter].ranges[0]) small++;
    }
  }
  assert.ok(small > 150 && small < 520); // both ranges come up
});
