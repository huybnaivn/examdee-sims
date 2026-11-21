import test from "node:test";
import assert from "node:assert/strict";
import { PERIOD, PHASES, angleOf, dayOf, litFraction, phaseIndex, litSide, lunarDate, lunarLabel, wrapDay, step, newQuestion, initialState, targetOf, matches } from "./model.js";

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test("day to angle: θ = 360°·day / 29,5", () => {
  close(angleOf(0), 0);
  close(angleOf(PERIOD / 4), 90);
  close(angleOf(PERIOD / 2), 180);
  close(angleOf(7.375), 90);
  close(angleOf(PERIOD), 0); // one month later: new moon again
  close(angleOf(-PERIOD / 4), 270);
  close(dayOf(180), 14.75);
  close(dayOf(angleOf(20.3)), 20.3);
  assert.equal(wrapDay(NaN), 0);
});

test("lit fraction (1 − cos θ) / 2", () => {
  close(litFraction(0), 0);
  close(litFraction(90), 0.5);
  close(litFraction(180), 1);
  close(litFraction(270), 0.5);
  close(litFraction(60), 0.25);
  close(litFraction(120), 0.75);
  close(litFraction(300), 0.25);
});

test("new moon at 0°, full moon at 180°", () => {
  assert.equal(PHASES[phaseIndex(0)], "Không trăng (trăng mới)");
  assert.equal(PHASES[phaseIndex(180)], "Trăng tròn");
  assert.equal(phaseIndex(angleOf(0)), 0);
  assert.equal(phaseIndex(angleOf(14.75)), 4);
});

test("eight names, 45° each, centred on multiples of 45°", () => {
  const expected = [0, 1, 2, 3, 4, 5, 6, 7];
  expected.forEach(i => {
    assert.equal(phaseIndex(45 * i), i);
    assert.equal(phaseIndex(45 * i - 22.4), i);
    assert.equal(phaseIndex(45 * i + 22.4), i);
  });
  assert.equal(phaseIndex(22.5), 1);
  assert.equal(phaseIndex(22.49), 0);
  assert.equal(phaseIndex(350), 0);
  assert.equal(phaseIndex(337.5), 0);
  assert.equal(phaseIndex(337.4), 7);
  assert.equal(PHASES[phaseIndex(90)], "Trăng bán nguyệt đầu tháng");
  assert.equal(PHASES[phaseIndex(270)], "Trăng bán nguyệt cuối tháng");
  assert.equal(PHASES[phaseIndex(30)], "Trăng lưỡi liềm đầu tháng");
  assert.equal(PHASES[phaseIndex(320)], "Trăng lưỡi liềm cuối tháng");
  assert.equal(PHASES[phaseIndex(140)], "Trăng khuyết đầu tháng");
  assert.equal(PHASES[phaseIndex(220)], "Trăng khuyết cuối tháng");
});

test("waxing Moon lit on its right, waning on its left (northern hemisphere)", () => {
  assert.equal(litSide(0), "none");
  assert.equal(litSide(180), "all");
  for (const a of [10, 45, 90, 135, 179]) assert.equal(litSide(a), "right");
  for (const a of [181, 225, 270, 315, 359]) assert.equal(litSide(a), "left");
  assert.equal(litSide(360), "none");
});

test("lunar date: mùng 1 at new moon, full moon on ngày 15", () => {
  assert.equal(lunarDate(0), 1);
  assert.equal(lunarDate(0.99), 1);
  assert.equal(lunarDate(14.75), 15);
  assert.equal(lunarDate(29.4), 30);
  assert.equal(lunarLabel(0), "mùng 1");
  assert.equal(lunarLabel(9.5), "mùng 10");
  assert.equal(lunarLabel(14.75), "ngày 15");
});

test("playing advances the day and wraps after one month", () => {
  const s = { ...initialState(), day: 29, speed: 2 };
  step(s, 0.5);
  close(s.day, 0.5);
});

test("quiz: new question differs from the old one, forged target is clamped", () => {
  const s = initialState();
  for (const r of [0, 0.5, 0.99]) {
    const before = s.target;
    newQuestion(s, () => r);
    assert.notEqual(s.target, before);
    assert.ok(s.target >= 0 && s.target <= 7);
    assert.equal(s.solved, false);
  }
  assert.equal(targetOf({ target: 99 }), 7);
  assert.equal(targetOf({ target: -3 }), 0);
  assert.ok(matches({ day: 22.125, target: 6 }));
  assert.ok(!matches({ day: 0, target: 6 }));
});
