import test from "node:test";
import assert from "node:assert/strict";
import { TILT, POLAR_CIRCLE, declination, dayLength, noonAltitude, northTowardSun, SEASONS, dateLabel, wrapDay, step, initialState } from "./model.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);
const [spring, summer, autumn, winter] = SEASONS.map(x => x.day);

test("declination follows δ = −23,44°·cos(360°(N + 10)/365)", () => {
  for (const d of [1, 50, 100, 172, 250, 300, 365]) near(declination(d), -23.44 * Math.cos((2 * Math.PI * (d + 10)) / 365));
  near(declination(summer), TILT);
  near(declination(winter), -TILT);
  near(declination(spring), 0);
  near(declination(autumn), 0);
  for (let d = 1; d <= 365; d += 0.5) assert.ok(Math.abs(declination(d)) <= TILT + 1e-12);
});

test("12 h of daylight on the equator all year, and everywhere on the equinoxes", () => {
  for (let d = 1; d <= 365; d += 7) near(dayLength(0, declination(d)), 12);
  for (const lat of [-60, -21, 10.82, 21.03, 45, 66.56, 80]) {
    near(dayLength(lat, declination(spring)), 12);
    near(dayLength(lat, declination(autumn)), 12);
  }
});

test("day length from cos H₀ = −tan φ·tan δ; summer days are longer in the north", () => {
  const hn = dayLength(21.03, TILT);
  near(hn, (2 * Math.acos(-Math.tan((21.03 * Math.PI) / 180) * Math.tan((TILT * Math.PI) / 180)) * 180) / Math.PI / 15);
  assert.ok(hn > 13.2 && hn < 13.5); // Hà Nội, Hạ chí ≈ 13,4 h
  near(dayLength(21.03, -TILT), 24 - hn); // Đông chí is the mirror image
  assert.ok(dayLength(21.03, TILT) > dayLength(10.82, TILT)); // further from the equator, longer summer day
  near(dayLength(-21.03, TILT), 24 - hn); // southern hemisphere has the opposite season
});

test("polar day and polar night beyond the polar circle", () => {
  near(dayLength(POLAR_CIRCLE, TILT), 24, 1e-6);
  near(dayLength(POLAR_CIRCLE, -TILT), 0, 1e-6);
  for (const lat of [70, 80, 90]) {
    assert.equal(dayLength(lat, declination(summer)), 24);
    assert.equal(dayLength(lat, declination(winter)), 0);
  }
  assert.ok(dayLength(60, TILT) < 24 && dayLength(60, -TILT) > 0); // inside the circle the Sun always sets and rises
  assert.equal(dayLength(90, 0), 12); // at the pole on an equinox the Sun runs along the horizon
});

test("noon altitude h = 90° − |φ − δ|", () => {
  near(noonAltitude(0, 0), 90);
  near(noonAltitude(21.03, TILT), 90 - (TILT - 21.03)); // Sun almost overhead in Hà Nội at Hạ chí
  near(noonAltitude(21.03, -TILT), 90 - 21.03 - TILT);
  near(noonAltitude(TILT, TILT), 90); // overhead on the Tropic of Cancer
  near(noonAltitude(POLAR_CIRCLE, -TILT), 0); // grazes the horizon
  assert.ok(noonAltitude(80, -TILT) < 0); // polar night: never rises
});

test("northern summer when the North Pole leans towards the Sun", () => {
  for (let d = 1; d <= 365; d += 3) {
    const toward = northTowardSun(d) > 1e-9;
    const away = northTowardSun(d) < -1e-9;
    if (toward) assert.ok(declination(d) > 0 && dayLength(21.03, declination(d)) > 12);
    if (away) assert.ok(declination(d) < 0 && dayLength(21.03, declination(d)) < 12);
  }
  assert.ok(northTowardSun(summer) > 0 && northTowardSun(winter) < 0);
});

test("dates, wrapping and playback", () => {
  assert.equal(dateLabel(1), "1/1");
  assert.equal(dateLabel(172), "21/6");
  assert.equal(dateLabel(355), "21/12");
  assert.equal(dateLabel(365.9), "31/12");
  near(wrapDay(366.5), 1.5);
  near(wrapDay(0.5), 365.5);
  assert.equal(wrapDay(NaN), 1);
  const s = initialState();
  for (let i = 0; i < 120 * 13; i++) step(s, 1 / 120); // 13 s × 30 days/s, more than a year
  assert.ok(s.day >= 1 && s.day < 366);
  near(s.day, wrapDay(172 + 390), 1e-6);
});
