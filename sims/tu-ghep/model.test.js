import test from "node:test";
import assert from "node:assert/strict";
import { initialState, solve, reached, ARRANGEMENTS, TARGETS } from "./model.js";

const near = (a, b) => assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);
const cases = [
  { voltage: 12, c1: 2, c2: 4, c3: 6 },
  { voltage: 24, c1: 1, c2: 1, c3: 12 },
  { voltage: 5, c1: 7, c2: 3, c3: 9 },
  { voltage: 0, c1: 2, c2: 3, c3: 6 },
];
const caps = (c, n) => [c.c1, c.c2, c.c3].slice(0, n);

test("parallel: C = ΣCᵢ, every capacitor has the source voltage", () => {
  for (const c of cases) {
    for (const useC3 of [false, true]) {
      const n = useC3 ? 3 : 2;
      const out = solve({ ...initialState(), ...c, useC3, arrangement: "parallel" });
      near(out.ceq, caps(c, n).reduce((a, b) => a + b, 0));
      for (const it of out.items) near(it.u, c.voltage);
      near(out.items.reduce((a, it) => a + it.q, 0), out.q);
    }
  }
});

test("series: 1/C = Σ1/Cᵢ, the same charge on each, voltages add up to U", () => {
  for (const c of cases) {
    for (const useC3 of [false, true]) {
      const n = useC3 ? 3 : 2;
      const out = solve({ ...initialState(), ...c, useC3, arrangement: "series" });
      near(1 / out.ceq, caps(c, n).reduce((a, b) => a + 1 / b, 0));
      assert.ok(out.ceq < Math.min(...caps(c, n)));
      for (const it of out.items) near(it.q, out.q);
      near(out.items.reduce((a, it) => a + it.u, 0), c.voltage);
    }
  }
  near(solve({ ...initialState(), c1: 3, c2: 6 }).ceq, 2);
});

test("series: voltages divide inversely to capacitance", () => {
  const out = solve({ ...initialState(), c1: 2, c2: 4, voltage: 12 });
  near(out.items[0].u, 8); // smaller capacitor takes the larger voltage
  near(out.items[1].u, 4);
  near(out.items[0].u / out.items[1].u, 4 / 2);
  const three = solve({ ...initialState(), useC3: true, c1: 1, c2: 2, c3: 4, voltage: 7 });
  near(three.items[0].u * 1, three.items[2].u * 4);
});

test("total energy CU²/2 equals the sum over the capacitors", () => {
  for (const arrangement of ARRANGEMENTS) {
    for (const c of cases) {
      const out = solve({ ...initialState(), ...c, useC3: true, arrangement });
      near(out.items.reduce((a, it) => a + it.w, 0), out.energy);
      for (const it of out.items) near(it.w, (it.q * it.u) / 2);
      near(out.energy, (out.ceq * c.voltage ** 2) / 2);
    }
  }
});

test("mixed arrangements reduce step by step", () => {
  // C₁ nt (C₂ // C₃): 2 µF nt (4 + 6) µF = 20/12 µF
  const a = solve({ ...initialState(), arrangement: "mixed-a", c1: 2, c2: 4, c3: 6, voltage: 12 });
  near(a.ceq, (2 * 10) / 12);
  near(a.items[0].q, a.q); // C₁ carries the whole charge
  near(a.items[1].q + a.items[2].q, a.q); // and the parallel pair shares it
  near(a.items[1].u, a.items[2].u);
  near(a.items[0].u + a.items[1].u, 12);
  // (C₁ nt C₂) // C₃: (3 nt 6) + 2 = 4 µF
  const b = solve({ ...initialState(), arrangement: "mixed-b", c1: 3, c2: 6, c3: 2, voltage: 10 });
  near(b.ceq, 4);
  near(b.items[0].q, b.items[1].q);
  near(b.items[0].u + b.items[1].u, 10);
  near(b.items[2].u, 10);
  near(b.items[0].q + b.items[2].q, b.q);
  // mixed always uses three capacitors, even if useC3 is off
  assert.equal(solve({ ...initialState(), arrangement: "mixed-a", useC3: false }).items.length, 3);
});

test("every challenge target can be built from 1–12 µF capacitors", () => {
  for (const target of TARGETS.filter(t => t > 0)) {
    let found = false;
    for (const arrangement of ARRANGEMENTS)
      for (const useC3 of [false, true])
        for (let c1 = 1; c1 <= 12 && !found; c1++)
          for (let c2 = 1; c2 <= 12 && !found; c2++)
            for (let c3 = 1; c3 <= 12 && !found; c3++)
              found = reached({ ...initialState(), arrangement, useC3, c1, c2, c3, target });
    assert.ok(found, `no way to build ${target} µF`);
  }
  assert.equal(reached(initialState()), false); // no challenge at the start
  assert.equal(reached({ ...initialState(), target: 1.2, c1: 2, c2: 3 }), true);
});
