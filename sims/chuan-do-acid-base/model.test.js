import test from "node:test";
import assert from "node:assert/strict";
import {
  KW, KA_ACETIC, DROP, BURETTE, TOLERANCE, INDICATORS, initialState, equivalenceVolume, pHAt, pH, error, onTarget, addTitrant,
  restart, endTitration, indicatorColor, titrant,
} from "./model.js";

const near = (a, b, tol = 1e-3) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const strong = { ...initialState(), acid: "strong", ca: 0.1, va: 20, cb: 0.1 };
const weak = { ...strong, acid: "weak" };
const pKa = -Math.log10(KA_ACETIC);

test("equivalence volume from C₁V₁ = C₂V₂", () => {
  near(equivalenceVolume(strong), 20, 1e-12);
  near(equivalenceVolume({ ...strong, ca: 0.12 }), 24, 1e-12);
  near(equivalenceVolume({ ...weak, ca: 0.15, va: 25, cb: 0.1 }), 37.5, 1e-12);
  near(equivalenceVolume({ ...strong, ca: 0.05, va: 10, cb: 0.2 }), 2.5, 1e-12);
  // every setting the sliders allow fits in the burette
  assert.ok(equivalenceVolume({ ca: 0.15, va: 25, cb: 0.1 }) < BURETTE);
});

test("strong acid – strong base: pH before, half-way, at and after the equivalence point", () => {
  near(pHAt(strong, 0), 1); // 0.1 M HCl
  near(pHAt({ ...strong, ca: 0.05 }, 0), -Math.log10(0.05));
  // half-way: [H⁺] = (C_a·V_a − C_b·V_b) / (V_a + V_b) = 1 mmol / 30 mL
  near(pHAt(strong, 10), -Math.log10(1 / 30));
  // one drop before and after: the jump
  near(pHAt(strong, 19.95), -Math.log10((0.1 * 0.05) / 39.95));
  near(pHAt(strong, 20), 7, 1e-6);
  near(pHAt(strong, 20.05), 14 + Math.log10((0.1 * 0.05) / 40.05));
  // excess base: [OH⁻] = (C_b·V_b − C_a·V_a) / (V_a + V_b)
  near(pHAt(strong, 30), 14 + Math.log10(1 / 50));
  near(pHAt(strong, 40), 14 + Math.log10(2 / 60));
  // other concentrations: still 7 at equivalence
  const other = { ...strong, ca: 0.13, va: 17, cb: 0.11 };
  near(pHAt(other, equivalenceVolume(other)), 7, 1e-4);
});

test("weak acid – strong base: start, buffer region, equivalence above 7, excess base", () => {
  // start: h² / (C − h) = K_a
  const h0 = (-KA_ACETIC + Math.sqrt(KA_ACETIC ** 2 + 4 * KA_ACETIC * 0.1)) / 2;
  near(pHAt(weak, 0), -Math.log10(h0));
  near(pHAt(weak, 0), 2.88, 0.01);
  // half-equivalence: pH = pK_a
  near(pHAt(weak, 10), pKa, 2e-3);
  near(pKa, 4.757, 1e-3);
  // Henderson–Hasselbalch elsewhere in the buffer region: pH = pK_a + lg(V_b / (V_eq − V_b))
  near(pHAt(weak, 5), pKa + Math.log10(5 / 15), 5e-3);
  near(pHAt(weak, 15), pKa + Math.log10(15 / 5), 5e-3);
  // equivalence: 0.05 M CH₃COONa, [OH⁻] ≈ √(K_w/K_a · C)
  const atEq = pHAt(weak, 20);
  assert.ok(atEq > 7);
  near(atEq, 14 + Math.log10(Math.sqrt((KW / KA_ACETIC) * 0.05)), 5e-3);
  near(atEq, 8.73, 0.01);
  // far past equivalence the excess NaOH decides, as for the strong acid
  near(pHAt(weak, 30), pHAt(strong, 30), 1e-3);
  // and the weak acid is the less acidic one all the way to equivalence
  for (let v = 0; v <= 20; v += 2.5) assert.ok(pHAt(weak, v) > pHAt(strong, v));
});

test("pH rises monotonically with the volume of base, on the drop grid", () => {
  for (const s of [strong, weak, { ...weak, ca: 0.15, va: 25, cb: 0.1 }]) {
    let last = -Infinity;
    for (let i = 0; i <= BURETTE / DROP; i++) {
      const value = pHAt(s, i * DROP);
      assert.ok(value > last && value > 0 && value < 14, `V=${i * DROP}: ${value}`);
      last = value;
    }
  }
});

test("the charge balance holds at the returned pH", () => {
  for (const [s, v] of [[strong, 3], [strong, 19.95], [weak, 0], [weak, 12], [weak, 20], [weak, 33]]) {
    const h = 10 ** -pHAt(s, v);
    const total = s.va + v;
    const acid = (s.ca * s.va) / total;
    const anion = s.acid === "weak" ? (acid * KA_ACETIC) / (KA_ACETIC + h) : acid;
    const sodium = (s.cb * v) / total;
    assert.ok(Math.abs(h + sodium - KW / h - anion) < 1e-12);
  }
});

test("indicator colour ranges", () => {
  const name = (id, value) => indicatorColor(id, value).name;
  assert.deepEqual([8.1, 9, 10.1].map(v => name("phenolphthalein", v)), ["không màu", "hồng nhạt", "hồng"]);
  assert.deepEqual([3, 3.8, 4.5].map(v => name("methylOrange", v)), ["đỏ", "da cam", "vàng"]);
  assert.deepEqual([5.9, 7, 8.1].map(v => name("litmus", v)), ["đỏ", "tím", "xanh"]);
  for (const [id, ind] of Object.entries(INDICATORS)) {
    assert.deepEqual(indicatorColor(id, ind.lo - 0.01).rgb, ind.colors[0]);
    assert.deepEqual(indicatorColor(id, ind.hi + 0.01).rgb, ind.colors[1]);
    near(indicatorColor(id, (ind.lo + ind.hi) / 2).t, 0.5, 1e-12);
    assert.equal(indicatorColor(id, -3).t, 0);
    assert.equal(indicatorColor(id, 20).t, 1);
  }
  // strong–strong: one drop takes phenolphthalein from colourless to pink at the equivalence point
  assert.equal(name("phenolphthalein", pHAt(strong, 19.95)), "không màu");
  assert.notEqual(name("phenolphthalein", pHAt(strong, 20.05)), "không màu");
  assert.equal(name("phenolphthalein", pHAt(strong, 20)), "không màu"); // pH 7 exactly
  // weak acid: methyl da cam has already turned yellow long before equivalence, phenolphthalein has not
  assert.equal(name("methylOrange", pHAt(weak, 10)), "vàng");
  assert.equal(name("phenolphthalein", pHAt(weak, 19)), "không màu");
  assert.notEqual(name("phenolphthalein", pHAt(weak, 20.05)), "không màu");
});

test("adding titrant, the end point and its error", () => {
  const s = { ...initialState() }; // 0.12 M × 20 mL against 0.1 M: 24 mL
  near(equivalenceVolume(s), 24, 1e-12);
  assert.equal(addTitrant(s, 5), 5);
  for (let i = 0; i < 3; i++) addTitrant(s, DROP);
  assert.equal(s.added, 5.15); // no floating-point drift
  near(error(s), -18.85, 1e-9);
  assert.equal(onTarget(s), false);
  addTitrant(s, 18.8);
  assert.equal(s.added, 23.95);
  assert.equal(onTarget(s), true); // one drop short is inside the tolerance
  addTitrant(s, DROP);
  near(pH(s), 7, 1e-4);
  addTitrant(s, 2 * DROP);
  assert.equal(onTarget(s), false);

  const result = endTitration(s);
  near(result.volumeAdded, 24.1, 1e-9);
  near(result.equivalenceVolume, 24, 1e-9);
  near(result.error, 0.1, 1e-9);
  near(result.pH, pHAt(s, 24.1), 1e-12);
  assert.equal(s.ended, true);
  assert.equal(addTitrant(s, 1), 0); // nothing more after the end
  assert.equal(s.added, 24.1);

  restart(s);
  assert.deepEqual([s.added, s.ended], [0, false]);
  assert.ok(TOLERANCE >= DROP); // the drop grid can always land inside the tolerance
});

test("the burette cannot be overdrawn, and a forged volume is clamped", () => {
  const s = { ...initialState(), added: 49.5 };
  near(addTitrant(s, 5), 0.5, 1e-9);
  assert.equal(s.added, BURETTE);
  assert.equal(addTitrant(s, 1), 0);
  assert.equal(addTitrant(s, -1), 0);
  assert.equal(titrant({ added: -7 }), 0);
  assert.equal(titrant({ added: 1e9 }), BURETTE);
  assert.ok(Number.isFinite(pH({ ...initialState(), added: 1e9, acid: "nope" })));
});
