import test from "node:test";
import assert from "node:assert/strict";
import {
  SOLUTIONS, REAGENTS, TABLE, LOOKS, PRESETS, initialState, tubes, addReagent, additions,
  allLabelled, correctCount, determined, consistent, fewestAdditions, clearRound,
} from "./model.js";

test("every reagent × solution gives the textbook observation", () => {
  // rows: HCl, NaOH, NaCl, Na2SO4, Na2CO3, AgNO3; columns: quỳ, phenolphthalein, BaCl2, AgNO3, HCl
  const expected = {
    HCl: ["red", "clear", "clear", "ppt-white", "clear"],
    NaOH: ["blue", "pink", "clear", "ppt-black", "clear"],
    NaCl: ["purple", "clear", "clear", "ppt-white", "clear"],
    Na2SO4: ["purple", "clear", "ppt-white", "clear", "clear"],
    Na2CO3: ["blue", "pink", "ppt-white", "ppt-yellow", "gas"],
    AgNO3: ["purple", "clear", "ppt-white", "clear", "ppt-white"],
  };
  for (const sol of SOLUTIONS) {
    REAGENTS.forEach((r, i) => {
      assert.equal(TABLE[sol][r].look, expected[sol][i], `${sol} + ${r}`);
      assert.ok(LOOKS[TABLE[sol][r].look]);
    });
  }
});

// "Ba(NO3)2" → { Ba: 1, N: 2, O: 6 }
function atoms(formula) {
  let i = 0;
  const num = () => {
    const m = formula.slice(i).match(/^\d+/);
    if (!m) return 1;
    i += m[0].length;
    return Number(m[0]);
  };
  const group = () => {
    const out = {};
    const add = (e, c) => (out[e] = (out[e] ?? 0) + c);
    while (i < formula.length && formula[i] !== ")") {
      if (formula[i] === "(") {
        i++;
        const inner = group();
        i++; // ")"
        const k = num();
        for (const [e, c] of Object.entries(inner)) add(e, c * k);
      } else {
        const el = formula.slice(i).match(/^[A-Z][a-z]?/)[0];
        i += el.length;
        add(el, num());
      }
    }
    return out;
  };
  return group();
}

const side = text => {
  const total = {};
  for (const term of text.split("+")) {
    const [, k, f] = term.trim().match(/^(\d*)(.+)$/);
    for (const [e, c] of Object.entries(atoms(f))) total[e] = (total[e] ?? 0) + c * (Number(k) || 1);
  }
  return total;
};

test("formula parser counts groups", () => {
  assert.deepEqual(atoms("Ba(NO3)2"), { Ba: 1, N: 2, O: 6 });
  assert.deepEqual(atoms("Na2CO3"), { Na: 2, C: 1, O: 3 });
});

test("every equation is balanced and its product matches the look", () => {
  let count = 0;
  for (const sol of SOLUTIONS) {
    for (const r of REAGENTS) {
      const o = TABLE[sol][r];
      if (!o.eq) {
        assert.ok(["clear", "red", "blue", "purple", "pink"].includes(o.look), `${sol}+${r} needs an equation`);
        continue;
      }
      count++;
      const [left, right] = o.eq.split("->");
      assert.deepEqual(side(left), side(right), o.eq);
      assert.ok(left.includes(sol), o.eq);
      if (o.product) assert.ok(right.split("+").some(t => t.trim().replace(/^\d+/, "") === o.product), o.eq);
    }
  }
  assert.equal(count, 10);
});

test("a strategy exists for every preset and the stored fewest count is right", () => {
  for (const p of Object.values(PRESETS)) {
    // Distinct signatures over all reagents: testing everything always identifies every tube.
    const sig = new Set(p.solutions.map(sol => REAGENTS.map(r => TABLE[sol][r].look).join()));
    assert.equal(sig.size, p.solutions.length, p.label);
    assert.equal(fewestAdditions(p.solutions), p.best, p.label);
  }
});

test("a textbook strategy identifies the 4-tube preset in 4 additions, whatever the order", () => {
  for (let seed = 0; seed < 40; seed++) {
    const s = { ...initialState(), preset: "sulfate", seed };
    const hidden = tubes(s);
    // litmus on the first three tubes, then BaCl2 on one neutral tube
    for (let k = 0; k < 3; k++) addReagent(s, k, "q");
    const neutral = hidden.map((sol, k) => k).filter(k => k === 3 || ["NaCl", "Na2SO4"].includes(hidden[k]));
    addReagent(s, neutral[0], "b");
    assert.equal(additions(s), 4);
    assert.ok(determined(s), `seed ${seed}`);
    assert.deepEqual(consistent(s)[0], hidden);
  }
});

test("labelling check counts correct tubes", () => {
  const s = initialState();
  const hidden = tubes(s);
  assert.equal(allLabelled(s), false);
  hidden.forEach((sol, k) => (s[`l${k + 1}`] = sol));
  assert.equal(allLabelled(s), true);
  assert.equal(correctCount(s), hidden.length);
  [s.l1, s.l2] = [s.l2, s.l1];
  assert.equal(correctCount(s), hidden.length - 2);
  assert.equal(determined(s), false); // nothing observed yet
  clearRound(s);
  assert.equal(allLabelled(s), false);
});

test("forged state is cleaned", () => {
  const s = { ...initialState(), t1: "qqzz<script>".repeat(10), seed: NaN, preset: "nope" };
  assert.equal(tubes(s).length, 4);
  assert.ok(additions(s) <= 12);
  assert.equal(addReagent(s, 9, "q"), null);
});
