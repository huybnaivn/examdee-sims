import test from "node:test";
import assert from "node:assert/strict";
import { initialState, cell, run, step, anodeHalf, cathodeHalf, overall, metal, metalIndex, METALS, F } from "./model.js";

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(Math.abs(a), Math.abs(b), 1), `${a} ≠ ${b}`);
const at = over => ({ ...initialState(), ...over });

test("E°pin = E°catot − E°anot, the more negative metal is the anode", () => {
  const c = cell(at({ left: "Zn", right: "Cu" }));
  assert.equal(c.anode.id, "Zn");
  assert.equal(c.cathode.id, "Cu");
  near(c.emf, 0.34 - -0.763); // 1,103 V
  near(cell(at({ left: "Mg", right: "Ag" })).emf, 0.799 + 2.37);
  near(cell(at({ left: "Fe", right: "Cu" })).emf, 0.78);
  near(cell(at({ left: "Zn", right: "Fe" })).emf, 0.323);
  for (const a of METALS)
    for (const b of METALS) {
      const x = cell(at({ left: a.id, right: b.id }));
      assert.ok(x.emf >= 0);
      assert.ok(x.anode.E <= x.cathode.E);
    }
});

test("swapping the electrodes keeps E positive and swaps the sides of anode and cathode", () => {
  const a = cell(at({ left: "Zn", right: "Ag" }));
  const b = cell(at({ left: "Ag", right: "Zn" }));
  near(a.emf, b.emf);
  assert.equal(a.anode.id, b.anode.id);
  assert.equal(a.anodeSide, "left");
  assert.equal(b.anodeSide, "right");
});

test("identical electrodes give 0 V and no current, nothing changes", () => {
  for (const m of METALS) {
    const r = run(at({ left: m.id, right: m.id, t: 3600 }));
    assert.equal(r.emf, 0);
    assert.equal(r.current, 0);
    assert.equal(r.q, 0);
    assert.equal(r.anodeLoss, 0);
    assert.equal(r.cathodeGain, 0);
    assert.ok(r.same);
  }
});

test("half-reaction and overall reaction strings", () => {
  assert.equal(anodeHalf(metal("Zn")), "Zn → Zn²⁺ + 2e");
  assert.equal(cathodeHalf(metal("Cu")), "Cu²⁺ + 2e → Cu");
  assert.equal(anodeHalf(metal("Ag")), "Ag → Ag⁺ + e");
  assert.equal(cathodeHalf(metal("Ag")), "Ag⁺ + e → Ag");
  assert.equal(overall(metal("Zn"), metal("Cu")), "Zn + Cu²⁺ → Zn²⁺ + Cu");
  assert.equal(overall(metal("Zn"), metal("Ag")), "Zn + 2Ag⁺ → Zn²⁺ + 2Ag");
  assert.equal(overall(metal("Mg"), metal("Fe")), "Mg + Fe²⁺ → Mg²⁺ + Fe");
});

test("I = E/R and Q = I·t", () => {
  const r = run(at({ R: 10, t: 3600 }));
  near(r.current, 1.103 / 10);
  near(r.q, (1.103 / 10) * 3600);
  near(r.ne, r.q / F);
});

test("mass changes follow the electron balance", () => {
  // Daniell cell, 1 h through 10 Ω: n(e) = 397,08 / 96485 ≈ 4,115·10⁻³ mol
  const r = run(at({ t: 3600 }));
  near(r.anodeLoss, (r.ne / 2) * 65);
  near(r.cathodeGain, (r.ne / 2) * 64);
  near(r.anodeLoss, 0.1338, 1e-3);
  // electrons given by the anode = electrons taken by the cathode, for every pair
  for (const a of METALS)
    for (const b of METALS) {
      if (a.id === b.id) continue;
      const x = run(at({ left: a.id, right: b.id, R: 5, t: 1000 }));
      near((x.anodeLoss / x.anode.M) * x.anode.z, (x.cathodeGain / x.cathode.M) * x.cathode.z);
      near((x.anodeLoss / x.anode.M) * x.anode.z, x.ne);
    }
  // Zn | Ag: one Zn gives two Ag
  const z = run(at({ left: "Zn", right: "Ag", t: 500 }));
  near(z.cathodeGain / 108, (2 * z.anodeLoss) / 65);
});

test("the run stops at the set duration; forged times are clamped", () => {
  const s = at({ duration: 60 });
  let stops = 0;
  for (let i = 0; i < 120 * 70; i++) if (step(s, 1 / 120)) stops++;
  assert.equal(stops, 1);
  assert.equal(s.t, 60);
  assert.equal(run(at({ t: -5 })).q, 0);
  assert.ok(Number.isFinite(run(at({ t: Infinity })).q));
});

test("indices for events", () => {
  assert.equal(metalIndex("Mg"), 0);
  assert.equal(metalIndex("Ag"), 4);
});
