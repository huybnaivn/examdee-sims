import test from "node:test";
import assert from "node:assert/strict";
import { initialState, transformer, transmission, LINE_POWER } from "./model.js";

const near = (a, b, rel = 1e-12) => assert.ok(Math.abs(a - b) <= rel * Math.max(1, Math.abs(b)), `${a} ≉ ${b}`);
const at = over => ({ ...initialState(), ...over });

test("U₁/U₂ = N₁/N₂", () => {
  for (const [u1, n1, n2] of [[220, 1000, 500], [220, 200, 2000], [110, 750, 750], [400, 1500, 50]]) {
    const t = transformer(at({ u1, n1, n2 }));
    near(u1 / t.u2, n1 / n2);
    near(t.ratio, n1 / n2);
  }
  near(transformer(initialState()).u2, 110);
});

test("ideal transformer: U₁I₁ = U₂I₂ and I₁/I₂ = N₂/N₁", () => {
  for (const load of [10, 55, 470]) {
    const s = at({ n2: 3000, load });
    const t = transformer(s);
    near(s.u1 * t.i1, t.u2 * t.i2);
    near(t.p1, t.p2);
    near(t.i1 / t.i2, s.n2 / s.n1);
    near(t.i2, t.u2 / load);
  }
});

test("step-up when N₂ > N₁, step-down when N₂ < N₁", () => {
  assert.equal(transformer(at({ n1: 500, n2: 2000 })).kind, "step-up");
  assert.ok(transformer(at({ n1: 500, n2: 2000 })).u2 > 220);
  assert.equal(transformer(at({ n1: 2000, n2: 500 })).kind, "step-down");
  assert.ok(transformer(at({ n1: 2000, n2: 500 })).u2 < 220);
  assert.equal(transformer(at({ n1: 800, n2: 800 })).kind, "none");
});

test("P_hp = R·P²/U² and H = (P − P_hp)/P", () => {
  const t = transmission(initialState()); // 500 kW, 10 Ω, 10 kV
  near(t.loss, (10 * LINE_POWER ** 2) / 10e3 ** 2);
  near(t.loss, 25e3);
  near(t.efficiency, 0.95);
  for (const [lineR, lineU] of [[2, 35], [20, 5], [7, 110]]) {
    const r = transmission(at({ lineR, lineU }));
    near(r.loss, (lineR * LINE_POWER ** 2) / (lineU * 1e3) ** 2);
    near(r.efficiency, (LINE_POWER - r.loss) / LINE_POWER);
    near(r.current, LINE_POWER / (lineU * 1e3));
  }
});

test("raising U tenfold cuts the loss a hundredfold; loss ∝ R", () => {
  const low = transmission(at({ lineU: 10 }));
  const high = transmission(at({ lineU: 100 }));
  near(low.loss / high.loss, 100, 1e-12);
  near(transmission(at({ lineR: 20 })).loss / low.loss, 2);
  // over the whole control range the loss never exceeds the power sent
  assert.ok(transmission(at({ lineR: 20, lineU: 5 })).efficiency > 0);
});
