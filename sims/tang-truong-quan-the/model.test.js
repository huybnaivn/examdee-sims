import test from "node:test";
import assert from "node:assert/strict";
import { expN, logisticN, rate, msy, timeToHalfK, harvested, finalN, atMsy, initialState } from "./model.js";

const close = (a, b, rel = 1e-6) => assert.ok(Math.abs(a - b) <= rel * Math.max(1, Math.abs(b)), `${a} ≉ ${b}`);

test("exponential growth N(t) = N₀·e^(rt)", () => {
  close(expN(20, 0.5, 0), 20);
  close(expN(20, 0.5, 2), 20 * Math.E);
  close(expN(10, Math.log(2), 3), 80); // doubles every year
});

test("logistic solution satisfies dN/dt = rN(1 − N/K) and approaches K", () => {
  const [N0, r, K] = [20, 0.5, 1000];
  close(logisticN(N0, r, K, 0), N0);
  for (const t of [1, 5, 10]) {
    const h = 1e-4;
    const slope = (logisticN(N0, r, K, t + h) - logisticN(N0, r, K, t - h)) / (2 * h);
    close(slope, rate(logisticN(N0, r, K, t), r, K), 1e-5);
  }
  assert.ok(K - logisticN(N0, r, K, 60) < 1e-6 * K);
  close(logisticN(1500, r, K, 40), K, 1e-6); // from above K it falls back to K
  // with no harvest the numerical solution agrees with the formula
  close(harvested(N0, r, K, 0, 20).at(-1)[1], logisticN(N0, r, K, 20), 1e-6);
});

test("growth is fastest at N = K/2, with rate rK/4", () => {
  const [r, K] = [0.8, 600];
  let best = 0;
  for (let N = 0; N <= K; N++) if (rate(N, r, K) > rate(best, r, K)) best = N;
  assert.equal(best, K / 2);
  close(rate(K / 2, r, K), msy(r, K));
  close(msy(r, K), 120);
  // and the logistic curve passes K/2 at t = ln((K − N₀)/N₀)/r, its inflection point
  const t = timeToHalfK(20, r, K);
  close(logisticN(20, r, K, t), K / 2);
  assert.equal(timeToHalfK(400, r, K), 0);
});

test("harvesting above rK/4 drives the population to zero; at or below it the population persists", () => {
  const [r, K] = [0.5, 1000]; // MSY = 125
  const over = harvested(K, r, K, 130, 100);
  assert.equal(over.at(-1)[1], 0);
  assert.ok(harvested(K, r, K, 124, 100).at(-1)[1] > K / 2);
  close(harvested(K, r, K, 100, 200).at(-1)[1], (K / 2) * (1 + Math.sqrt(1 - 100 / 125)), 1e-4); // upper equilibrium
});

test("populations are never negative", () => {
  for (const [N0, H] of [[1, 500], [5, 50], [999, 1000]]) {
    for (const [, N] of harvested(N0, 1.5, 100, H, 50)) assert.ok(N >= 0);
  }
  assert.ok(logisticN(1, 1.5, 100, 30) >= 0);
  assert.equal(logisticN(0, 1, 100, 5), 0);
});

test("final N and the MSY goal", () => {
  const s = initialState();
  close(finalN(s), logisticN(20, 0.5, 1000, 30));
  assert.equal(atMsy(s), false);
  assert.equal(atMsy({ ...s, harvest: true, H: 123 }), true);
  assert.equal(atMsy({ ...s, harvest: true, H: 115 }), false);
});
