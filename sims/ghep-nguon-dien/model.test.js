import test from "node:test";
import assert from "node:assert/strict";
import { initialState, bank, solve, solveAt, maxPower, atMaxPower, R_STEP } from "./model.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);
const make = over => ({ ...initialState(), ...over });
const cells = [
  { emf: 1.5, r: 0.5 },
  { emf: 2, r: 0.2 },
  { emf: 9, r: 2 },
];

test("series: E_b = nE, r_b = nr (the m control is ignored)", () => {
  for (const c of cells) {
    for (let n = 1; n <= 6; n++) {
      const b = bank(make({ ...c, mode: "series", n, m: 4 }));
      near(b.emf, n * c.emf);
      near(b.r, n * c.r);
    }
  }
});

test("parallel of identical cells: E_b = E, r_b = r/m (the n control is ignored)", () => {
  for (const c of cells) {
    for (let m = 1; m <= 4; m++) {
      const b = bank(make({ ...c, mode: "parallel", n: 5, m }));
      near(b.emf, c.emf);
      near(b.r, c.r / m);
    }
  }
});

test("mixed bank of m rows of n: E_b = nE, r_b = nr/m", () => {
  for (const c of cells) {
    for (let n = 1; n <= 6; n++) {
      for (let m = 1; m <= 4; m++) {
        const b = bank(make({ ...c, mode: "mixed", n, m }));
        near(b.emf, n * c.emf);
        near(b.r, (n * c.r) / m);
      }
    }
  }
  const b = bank(initialState()); // 2 rows of 3 cells of 1,5 V; 0,5 Ω
  near(b.emf, 4.5);
  near(b.r, 0.75);
});

test("Ohm's law for the whole circuit: I = E_b/(R + r_b), U = E_b − I·r_b = I·R", () => {
  const first = solve(initialState());
  near(first.current, 1.2);
  near(first.voltage, 3.6);
  near(first.power, 4.32);
  near(first.efficiency, 0.8);
  near(first.cellCurrent, 0.6);
  for (const mode of ["series", "parallel", "mixed"]) {
    for (const R of [0.05, 1, 3, 20]) {
      const s = make({ mode, R });
      const c = solve(s);
      near(c.current, c.emfBank / (R + c.rBank));
      near(c.voltage, c.emfBank - c.current * c.rBank);
      near(c.voltage, c.current * R);
      near(c.power, c.current ** 2 * R);
      near(c.efficiency, c.voltage / c.emfBank);
      near(c.efficiency, R / (R + c.rBank));
      // energy balance: E_b·I = P + I²·r_b
      near(c.emfBank * c.current, c.power + c.current ** 2 * c.rBank);
    }
  }
});

test("short circuit: R = 0 gives I = E_b/r_b, U = 0, no useful power", () => {
  const c = solve(make({ R: 0 }));
  assert.equal(c.short, true);
  near(c.current, 4.5 / 0.75);
  assert.equal(c.voltage, 0);
  assert.equal(c.power, 0);
  assert.equal(c.efficiency, 0);
  assert.equal(solve(initialState()).short, false);
  assert.equal(solve(make({ R: -5 })).current, 6); // a forged negative R is treated as a short circuit
});

test("power is greatest when R = r_b, where P = E_b²/(4 r_b) and H = 50 %", () => {
  for (const mode of ["series", "parallel", "mixed"]) {
    for (const c of cells) {
      const s = make({ ...c, mode });
      const rb = bank(s).r;
      const top = solveAt(s, rb);
      near(top.power, maxPower(s));
      near(top.efficiency, 0.5);
      for (let R = 0; R <= 20; R += 0.05) assert.ok(solveAt(s, R).power <= maxPower(s) * (1 + 1e-12));
      assert.ok(solveAt(s, rb * 0.5).power < top.power && solveAt(s, rb * 2).power < top.power);
    }
  }
});

test("the maximum can be found with the R slider for every bank the controls allow", () => {
  for (const mode of ["series", "parallel", "mixed"]) {
    for (let n = 1; n <= 6; n++) {
      for (let m = 1; m <= 4; m++) {
        for (let r = 0.2; r < 2.05; r += 0.1) {
          const s = make({ mode, n, m, r });
          const hits = [];
          for (let k = 0; k <= 20 / R_STEP; k++) {
            s.R = k * R_STEP;
            if (atMaxPower(s)) hits.push(s.R);
          }
          const rb = bank(s).r;
          if (rb <= 20) {
            assert.ok(hits.length >= 1 && hits.length <= 2, `${mode} n=${n} m=${m} r=${r}: ${hits}`);
            for (const R of hits) assert.ok(solveAt(s, R).power >= 0.95 * maxPower(s));
          }
        }
      }
    }
  }
  assert.equal(atMaxPower(initialState()), false);
  assert.equal(atMaxPower(make({ R: 0.75 })), true);
  assert.equal(atMaxPower(make({ R: 0 })), false);
});
