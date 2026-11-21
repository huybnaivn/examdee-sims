import test from "node:test";
import assert from "node:assert/strict";
import {
  rate, bubbleDistance, TUBE_AREA, saturation, deficit, measureTime, quizEffects, strongest, newQuestion, initialState, RANGES,
} from "./model.js";

const base = { light: 60, temperature: 25, humidity: 60, wind: 1, cover: "none" };
const sweep = (key, values) => values.map(v => rate({ ...base, [key]: v }));
const increasing = xs => xs.every((x, i) => i === 0 || x > xs[i - 1]);

test("rate rises with light, temperature and wind, and falls with humidity", () => {
  assert.ok(increasing(sweep("light", [5, 20, 50, 80, 100])));
  assert.ok(increasing(sweep("temperature", [10, 20, 30, 40])));
  assert.ok(increasing(sweep("wind", [0, 1, 2, 5])));
  assert.ok(increasing(sweep("humidity", [100, 80, 60, 40, 20])));
  assert.equal(rate({ ...base, humidity: 100 }), 0); // saturated air: no vapour gap
});

test("Tetens saturation vapour pressure and the vapour deficit", () => {
  assert.ok(Math.abs(saturation(25) - 3.17) < 0.01);
  assert.ok(Math.abs(saturation(0) - 0.6108) < 1e-9);
  assert.ok(Math.abs(deficit(25, 60) - 0.4 * saturation(25)) < 1e-12);
});

test("vaseline on the lower surface (more stomata) cuts the rate more than on the upper; both stops it", () => {
  const none = rate(base);
  const upper = rate({ ...base, cover: "upper" });
  const lower = rate({ ...base, cover: "lower" });
  assert.ok(upper < none && lower < upper);
  assert.equal(rate({ ...base, cover: "both" }), 0);
});

test("stomata closed in the dark: no transpiration (cuticle ignored)", () => {
  assert.equal(rate({ ...base, light: 0 }), 0);
  assert.equal(rate({ ...base, light: 0, temperature: 40, humidity: 20, wind: 5 }), 0);
});

test("bubble distance = rate × time / tube cross-section", () => {
  assert.ok(Math.abs(TUBE_AREA - Math.PI * 0.25) < 1e-12);
  assert.ok(Math.abs(bubbleDistance(3.1416, 2) - (3.1416 * 2) / TUBE_AREA) < 1e-12);
  assert.ok(Math.abs(bubbleDistance(Math.PI / 4, 1) - 1) < 1e-12); // π/4 mm³ fills 1 mm of a 1 mm tube
  const s = { ...initialState(), light: 100, temperature: 40, humidity: 20, wind: 5, period: 5 };
  assert.ok(bubbleDistance(rate(s), measureTime(s)) <= 150 + 1e-9); // never runs off the scale
  assert.equal(measureTime(initialState()), 5);
});

test("quiz: the strongest factor is the change with the largest effect; new questions are clear", () => {
  const s = { ...initialState(), qLight: 10, qTemperature: 25, qHumidity: 60, qWind: 2 };
  assert.equal(strongest(s), "light"); // dim light: stomata barely open
  const dry = { ...initialState(), qLight: 80, qTemperature: 20, qHumidity: 40, qWind: 0 };
  assert.equal(strongest(dry), "wind"); // still air limits the rate
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const seen = new Set();
  for (let i = 0; i < 40; i++) {
    const q = newQuestion({ ...initialState() }, random);
    const e = Object.values(quizEffects(q)).sort((a, b) => b - a);
    assert.ok(e[0] >= 1.25 * e[1]);
    assert.equal(q.light, q.qLight);
    assert.ok(q.qLight >= RANGES.light[0] && q.qLight <= RANGES.light[1]);
    seen.add(strongest(q));
  }
  assert.equal(seen.size, 4, `answers seen: ${[...seen]}`);
});
