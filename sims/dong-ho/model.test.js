import test from "node:test";
import assert from "node:assert/strict";
import { minuteAngle, hourAngle, words, to12, to24, elapsed, duration, matches, dragMinute, dragHour, total, split, newTarget } from "./model.js";

test("hand angles: 3:00, 6:00, 9:30, 12:00", () => {
  assert.equal(hourAngle(3, 0), 90);
  assert.equal(minuteAngle(0), 0);
  assert.equal(hourAngle(6, 0), 180);
  assert.equal(minuteAngle(30), 180);
  assert.equal(hourAngle(21, 30), 285); // 9:30 pm, same face as 9:30 am
  assert.equal(hourAngle(0, 0), 0);
  assert.equal(hourAngle(12, 0), 0);
  assert.equal(minuteAngle(15), 90);
});

test("the hour hand sits between hours: half way at the half hour, a quarter past at :15", () => {
  assert.equal(hourAngle(7, 30), (7 * 30 + 8 * 30) / 2);
  assert.equal(hourAngle(7, 15), 7 * 30 + 30 / 4);
  for (let m = 0; m < 60; m++) {
    assert.ok(hourAngle(4, m) >= 120 && hourAngle(4, m) < 150);
  }
});

test("reading in words, with giờ kém past the half hour", () => {
  assert.deepEqual(words(7, 15), { main: "7 giờ 15 phút", alt: null });
  assert.deepEqual(words(7, 0), { main: "7 giờ", alt: null });
  assert.deepEqual(words(7, 30), { main: "7 giờ 30 phút", alt: "7 giờ rưỡi" });
  assert.deepEqual(words(6, 45), { main: "6 giờ 45 phút", alt: "7 giờ kém 15 phút" });
  assert.deepEqual(words(19, 50), { main: "7 giờ 50 phút", alt: "8 giờ kém 10 phút" });
  assert.equal(words(12, 55).alt, "1 giờ kém 5 phút");
  assert.equal(words(11, 40).alt, "12 giờ kém 20 phút");
  assert.equal(words(0, 5).main, "12 giờ 5 phút");
});

test("12/24-hour conversion round-trips every hour", () => {
  assert.deepEqual(to12(19), { hour: 7, period: "tối" });
  assert.deepEqual(to12(13), { hour: 1, period: "chiều" });
  assert.deepEqual(to12(0), { hour: 12, period: "đêm" });
  assert.deepEqual(to12(12), { hour: 12, period: "trưa" });
  assert.deepEqual(to12(8), { hour: 8, period: "sáng" });
  assert.equal(to24(7, "tối"), 19);
  assert.equal(to24(3, "chiều"), 15);
  assert.equal(to24(10, "đêm"), 22);
  for (let h = 0; h < 24; h++) {
    const { hour, period } = to12(h);
    assert.equal(to24(hour, period), h);
  }
});

test("elapsed time, also across noon and midnight", () => {
  assert.equal(elapsed(7, 30, 9, 15), 105);
  assert.equal(duration(105), "1 giờ 45 phút");
  assert.equal(elapsed(11, 0, 14, 30), 210); // across noon
  assert.equal(elapsed(22, 15, 1, 0), 165); // across midnight
  assert.equal(duration(165), "2 giờ 45 phút");
  assert.equal(elapsed(8, 0, 8, 0), 0);
  assert.equal(duration(40), "40 phút");
  assert.equal(duration(120), "2 giờ");
});

test("target checking compares on the 12-hour face, minute exact", () => {
  assert.ok(matches(8, 45, 8, 45));
  assert.ok(matches(20, 45, 8, 45));
  assert.ok(matches(0, 0, 12, 0));
  assert.ok(!matches(8, 44, 8, 45));
  assert.ok(!matches(9, 45, 8, 45));
  const seq = [0.5, 0.5, 0.1, 0.2];
  const t = newTarget(() => seq.shift(), { hour: 7, minute: 30 });
  assert.deepEqual(t, { hour: 2, minute: 10 }); // the first draw (7:30) is skipped
});

test("moving the minute hand past 12 carries the hour; the hour hand carries the minutes", () => {
  assert.deepEqual(split(dragMinute(total(7, 55), 6 * 5)), { hour: 8, minute: 5 });
  assert.deepEqual(split(dragMinute(total(8, 5), 6 * 50)), { hour: 7, minute: 50 });
  assert.deepEqual(split(dragMinute(total(23, 58), 0)), { hour: 0, minute: 0 }); // midnight
  assert.deepEqual(split(dragHour(total(7, 0), 7.5 * 30)), { hour: 7, minute: 30 });
  assert.deepEqual(split(dragHour(total(11, 50), 15)), { hour: 12, minute: 30 }); // across noon
  assert.deepEqual(split(dragHour(total(0, 10), 355)), { hour: 23, minute: 50 }); // back across midnight
  // after any drag the hands agree with each other
  for (const deg of [0, 47, 133, 359]) {
    const { hour, minute } = split(dragHour(total(5, 0), deg));
    assert.ok(Math.abs(hourAngle(hour, minute) - deg) <= 0.25);
  }
});
