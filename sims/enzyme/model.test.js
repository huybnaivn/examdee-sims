import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState, ENZYMES, T_OPT, T_DENATURE, rate, vmax, saturation, denature, restart, step, product, trajectory, tempFactor, activeNow,
} from "./model.js";

const at = extra => ({ ...initialState(), ...extra });
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} vs ${b}`);
const argmax = (xs, f) => xs.reduce((best, x) => (f(x) > f(best) ? x : best));
const grid = (lo, hi, h) => Array.from({ length: Math.round((hi - lo) / h) + 1 }, (_, i) => +(lo + i * h).toFixed(6));

test("v = V_max·[S]/(K_m + [S])", () => {
  for (const enzyme of Object.keys(ENZYMES)) {
    for (const S of [0, 0.5, 1, 4, 10, 20]) {
      const s = at({ enzyme, substrate: S, pH: ENZYMES[enzyme].pH });
      close(rate(s), (vmax(s) * S) / (ENZYMES[enzyme].Km + S));
      close(saturation(s), rate(s) / vmax(s) || 0);
    }
  }
  // at the optimum, one unit of fresh enzyme has V_max = 1 mmol/L/phút
  close(vmax(at({ pH: ENZYMES.amylase.pH })), 1);
  assert.equal(rate(at({ substrate: 0 })), 0);
  assert.ok(rate(at({ substrate: 20 })) < vmax(at({})));
});

test("half of V_max at [S] = K_m", () => {
  for (const [enzyme, e] of Object.entries(ENZYMES)) {
    const s = at({ enzyme, substrate: e.Km, pH: e.pH });
    close(rate(s), vmax(s) / 2);
    close(saturation(s), 0.5);
  }
});

test("rate is proportional to the amount of enzyme", () => {
  const one = rate(at({ amount: 1 }));
  for (const amount of [0, 0.5, 2, 5]) close(rate(at({ amount })), amount * one);
});

test("temperature optimum at 37 °C for fresh enzyme", () => {
  const fresh = T => rate(at({ temp: T, active: 1 }));
  assert.equal(argmax(grid(0, 70, 0.5), fresh), T_OPT);
  close(tempFactor(T_OPT - 10), 0.5); // Q10 = 2 below the optimum
  assert.equal(fresh(60), 0);
});

test("denaturation above 45 °C is irreversible: cooling does not restore it", () => {
  const s = at({});
  const before = rate(s);
  s.temp = 40;
  assert.equal(denature(s), false); // below the threshold nothing is lost
  assert.equal(s.active, 1);
  s.temp = 52;
  assert.equal(denature(s), true);
  close(s.active, 1 - 7 / 15);
  s.temp = 37;
  assert.equal(denature(s), false);
  close(rate(s), before * (1 - 7 / 15)); // back at 37 °C, still only the surviving fraction works
  s.temp = 65;
  denature(s);
  s.temp = 37;
  assert.equal(rate(s), 0);
  assert.equal(activeNow(s), 0);
  // while it is hot, the rate already counts only the surviving fraction
  close(rate(at({ temp: 52 })), rate(at({ temp: 52, active: 1 - 7 / 15 })));
  assert.ok(T_DENATURE > T_OPT);
});

test("each enzyme works best at its own pH", () => {
  const ph = grid(0, 14, 0.1);
  for (const [enzyme, e] of Object.entries(ENZYMES)) {
    assert.equal(argmax(ph, pH => rate(at({ enzyme, pH }))), e.pH);
  }
  assert.equal(ENZYMES.pepsin.pH, 2);
  assert.ok(ENZYMES.trypsin.pH > 7 && ENZYMES.amylase.pH < 7);
  // pepsin in the neutral mouth or the gut does almost nothing
  assert.ok(rate(at({ enzyme: "pepsin", pH: 7 })) < 0.01 * rate(at({ enzyme: "pepsin", pH: 2 })));
});

test("product over time follows the integrated Michaelis–Menten equation", () => {
  const s = at({ substrate: 12, amount: 0.8, pH: 6.8 });
  restart(s);
  const V = vmax(s);
  const Km = ENZYMES.amylase.Km;
  for (let i = 0; i < 600; i++) step(s, 1 / 60);
  // K_m·ln([S]₀/[S]) + ([S]₀ − [S]) = V_max·t
  close(Km * Math.log(12 / s.S) + (12 - s.S), V * s.time, 1e-6);
  close(product(s) + s.S, 12);
  // initial slope of the product curve is the initial rate
  const tr = trajectory(s, 0.001);
  close(tr[1][1] / tr[1][0], rate(s), 1e-3);
  for (let i = 1; i < tr.length; i++) assert.ok(tr[i][1] >= tr[i - 1][1]);
  assert.ok(tr.at(-1)[1] <= 12);
});

test("forged values are clamped", () => {
  assert.ok(Number.isFinite(rate(at({ amount: 1e9, substrate: -3, temp: NaN }))));
  assert.equal(rate(at({ substrate: -3 })), 0);
  close(rate(at({ enzyme: "x" })), rate(at({ enzyme: "amylase" })));
  assert.ok(activeNow(at({ active: 7 })) <= 1);
});
