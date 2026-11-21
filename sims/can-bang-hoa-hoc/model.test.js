import test from "node:test";
import assert from "node:assert/strict";
import {
  REACTIONS, KEYS, MAX_ADD, initialState, selectReaction, restart, disturb, addAmount, step, equilibrium, quotient, kC,
  equilibriumConstant, temperature, amounts, concentrations, elementTotals, deltaGasMoles,
} from "./model.js";

const DT = 1 / 120;
const make = (reaction, patch = {}) => restart(Object.assign(selectReaction({ ...initialState(), reaction }), patch));
const run = (s, seconds) => {
  for (let i = 0; i < Math.round(seconds / DT); i++) step(s, DT);
  return s;
};
/** Run until the model reports equilibrium, then return the state. */
const settle = s => {
  for (let i = 0; i < 200 / DT && !s.atEq; i++) step(s, DT);
  assert.ok(s.atEq, "did not reach equilibrium");
  return s;
};
const close = (a, b, rel = 1e-6) => assert.ok(Math.abs(a - b) <= rel * Math.max(Math.abs(a), Math.abs(b), 1e-12), `${a} vs ${b}`);
const ids = Object.keys(REACTIONS);

test("at equilibrium Q = K_C, and the kinetics end where Q = K_C is solved directly", () => {
  for (const id of ids) {
    const s = make(id);
    const target = equilibrium(s);
    settle(s);
    close(quotient(s), kC(s), 2e-3); // the moment equilibrium is reported
    assert.equal(s.shift, 1); // started from reactants only
    run(s, 60);
    close(quotient(s), kC(s), 1e-9);
    amounts(s).forEach((n, i) => close(n, target[i], 1e-8));
  }
});

test("known equilibrium compositions", () => {
  // H₂ + I₂ ⇌ 2HI from 1 mol each in 1 L: 2x/(1 − x) = √K
  const hi = run(make("hi"), 80);
  const x = Math.sqrt(54.3) / (2 + Math.sqrt(54.3));
  close(amounts(hi)[2], 2 * x, 1e-8);
  close(amounts(hi)[0], 1 - x, 1e-8);
  // N₂O₄ ⇌ 2NO₂ from 1 mol in 1 L at 298 K: 4x²/(1 − x) = K
  const n = run(make("n2o4", { dT: -50 }), 80);
  const K = 4.6e-3;
  const y = (-K + Math.sqrt(K * K + 16 * K)) / 8;
  close(amounts(n)[1], 2 * y, 1e-8);
  // K_C is built from the concentrations with the stoichiometric powers
  const a = run(make("nh3", { volume: 2 }), 80);
  const [n2, h2, nh3] = concentrations(a);
  close(nh3 ** 2 / (n2 * h2 ** 3), kC(a), 1e-8);
});

test("starting from products only, the reaction runs in reverse", () => {
  const s = settle(make("nh3", { init1: 0, init2: 0, init3: 2 }));
  assert.equal(s.shift, -1);
  assert.ok(amounts(s)[0] > 0 && amounts(s)[2] < 2);
});

test("adding a reactant shifts forward; adding a product shifts back; removing a product shifts forward", () => {
  for (const id of ids) {
    const s = settle(make(id));
    const last = amounts(s).length - 1;
    assert.equal(addAmount(s, 0, 0.5), 0.5);
    assert.equal(s.atEq, false);
    assert.ok(quotient(s) < kC(s));
    assert.equal(settle(s).shift, 1);

    addAmount(s, last, 0.5);
    assert.ok(quotient(s) > kC(s));
    assert.equal(settle(s).shift, -1);

    addAmount(s, last, -0.5);
    assert.ok(quotient(s) < kC(s));
    assert.equal(settle(s).shift, 1);
  }
});

test("compression shifts toward fewer gas moles, expansion the other way, nothing when moles are equal", () => {
  assert.equal(deltaGasMoles(REACTIONS.nh3), -2);
  assert.equal(deltaGasMoles(REACTIONS.n2o4), 1);
  assert.equal(deltaGasMoles(REACTIONS.hi), 0);
  for (const id of ids) {
    const dn = deltaGasMoles(REACTIONS[id]);
    for (const [V, squeeze] of [[0.5, 1], [2, -1]]) {
      const s = settle(make(id));
      const before = amounts(s);
      s.volume = V;
      disturb(s);
      settle(s);
      // fewer gas moles lie on the product side when dn < 0
      assert.equal(s.shift, dn === 0 ? 0 : squeeze * (dn < 0 ? 1 : -1), `${id} V=${V}`);
      if (dn === 0) amounts(run(s, 10)).forEach((n, i) => close(n, before[i], 2e-3));
      close(quotient(run(s, 60)), kC(s), 1e-9);
    }
  }
});

test("K_C follows the van 't Hoff equation: it falls with T when exothermic, rises when endothermic", () => {
  for (const id of ids) {
    const rx = REACTIONS[id];
    close(equilibriumConstant(rx, rx.tRef), rx.kRef, 1e-12);
    const cold = equilibriumConstant(rx, rx.tMid - 50);
    const hot = equilibriumConstant(rx, rx.tMid + 50);
    assert.equal(hot < cold, rx.dH < 0, id);
    // ln(K2/K1) = −ΔH/R · (1/T2 − 1/T1)
    close(Math.log(hot / cold), ((-rx.dH * 1000) / 8.314) * (1 / (rx.tMid + 50) - 1 / (rx.tMid - 50)), 1e-9);
  }
  assert.equal(temperature(make("n2o4", { dT: -50 })), 298);
  close(kC(make("n2o4", { dT: -50 })), 4.6e-3, 1e-12);
  close(kC(make("nh3")), 0.06, 1e-12);
  close(kC(make("hi")), 54.3, 1e-12);
});

test("heating shifts an exothermic reaction backward and an endothermic one forward; cooling does the opposite", () => {
  for (const id of ids) {
    const exo = REACTIONS[id].dH < 0;
    for (const dT of [50, -50]) {
      const s = settle(make(id));
      s.dT = dT;
      disturb(s);
      assert.equal(settle(s).shift, (dT > 0 ? 1 : -1) * (exo ? -1 : 1), `${id} dT=${dT}`);
    }
  }
});

test("the amount of every element is conserved, also through stiff mixtures", () => {
  const cases = [
    ...ids.map(id => make(id)),
    make("nh3", { init1: 6, init2: 6, init3: 6, volume: 0.5 }),
    make("n2o4", { init1: 6, init2: 6, volume: 0.5, dT: 50 }),
    make("hi", { init1: 0.1, init2: 6, init3: 0, volume: 0.5 }),
  ];
  for (const s of cases) {
    const before = elementTotals(s);
    for (let i = 0; i < 20 / DT; i++) {
      step(s, DT);
      if (i % 97 === 0 || i < 20) {
        for (const [el, total] of Object.entries(elementTotals(s))) close(total, before[el], 1e-9);
        for (const n of amounts(s)) assert.ok(n >= 0 && Number.isFinite(n));
      }
    }
    close(quotient(s), kC(s), 1e-6);
    // a disturbance changes the totals by exactly what was added
    addAmount(s, 0, -0.5);
    const mid = elementTotals(s);
    run(s, 5);
    for (const [el, total] of Object.entries(elementTotals(s))) close(total, mid[el], 1e-9);
  }
});

test("amounts stay within bounds and odd states do not break the model", () => {
  const s = make("nh3");
  s.n1 = MAX_ADD;
  assert.equal(addAmount(s, 0, 0.5), 0); // full
  s.n3 = 0.2;
  assert.ok(Math.abs(addAmount(s, 2, -0.5) + 0.2) < 1e-12); // cannot remove more than there is
  assert.equal(s.n3, 0);
  assert.equal(addAmount(s, 7, 0.5), 0);

  // nothing that can react: reported as settled with no shift, no NaN
  const dead = make("nh3", { init1: 0, init2: 2, init3: 0 });
  run(dead, 1);
  assert.deepEqual(amounts(dead), [0, 2, 0]);
  assert.equal(dead.atEq, true);
  assert.equal(dead.shift, 0);
  assert.ok(Number.isNaN(quotient(dead)));

  // forged state
  const forged = { ...initialState(), reaction: "nope", n1: -5, n2: 1e9, n3: 3, volume: -1, dT: 1e6 };
  run(forged, 2);
  for (const k of KEYS) assert.ok(forged[k] >= 0 && forged[k] <= 20 && Number.isFinite(forged[k]));
  assert.equal(temperature(forged), 823);
});

test("restart returns to the chosen initial amounts", () => {
  const s = run(make("hi"), 3);
  s.init1 = 2;
  restart(s);
  assert.deepEqual([s.n1, s.n2, s.n3, s.time, s.xi, s.atEq, s.shift], [2, 1, 0, 0, 0, false, 0]);
  assert.deepEqual(amounts(make("n2o4")), [1, 0]);
});
