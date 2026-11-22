import test from "node:test";
import assert from "node:assert/strict";
import {
  V0, G, C_IN0, BURST, initialState, restartMembrane, stepMembrane, particles, waterFlow, conc,
  restartCell, stepCell, cellOutcome, reached, tonicity, cellInside, tidy,
} from "./model.js";

const DT = 1 / 120;
const membrane = (over, seed = 1) => {
  const s = { ...initialState(), ...over, seed };
  restartMembrane(s);
  return s;
};
const run = (s, seconds, each) => {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    stepMembrane(s, DT);
    each?.(s);
  }
  return s;
};

test("solute flows down its concentration gradient through a permeable membrane", () => {
  for (let seed = 1; seed <= 5; seed++) {
    const s = membrane({ membrane: "permeable", left0: 50, right0: 0 }, seed);
    run(s, 5);
    assert.ok(s.nR > 5 && s.nL < 45, `seed ${seed}: ${s.nL} | ${s.nR}`);
  }
});

test("permeable membrane: equal concentrations and equal volumes at equilibrium", () => {
  for (const [left0, right0] of [[50, 10], [5, 45], [30, 30]]) {
    const s = membrane({ membrane: "permeable", left0, right0 }, left0);
    let reachedAt = 0;
    for (let i = 0; i < 200 / DT && !reachedAt; i++) if (stepMembrane(s, DT)) reachedAt = s.time;
    assert.ok(reachedAt > 0, `${left0}/${right0} reaches equilibrium`);
    // average over a long stretch after equilibrium: fluctuations cancel
    let cL = 0, cR = 0, k = 0;
    run(s, 60, x => ((cL += conc(x.nL, x.vL)), (cR += conc(x.nR, x.vR)), k++));
    const mean = (left0 + right0) / (2 * V0);
    assert.ok(Math.abs(cL / k - cR / k) < 0.12 * mean + 0.05, `${cL / k} vs ${cR / k}`);
    assert.ok(Math.abs(s.vL - V0) < 1, `volume ${s.vL}`);
  }
});

test("semi-permeable membrane: water moves toward the side with more solute", () => {
  const s = membrane({ membrane: "semi", left0: 40, right0: 10 });
  assert.ok(waterFlow(s) < 0); // negative = right → left
  run(s, 2);
  assert.ok(s.vL > V0 + 0.2, `left gains water: ${s.vL}`);
  const t = membrane({ membrane: "semi", left0: 5, right0: 50 });
  run(t, 2);
  assert.ok(t.vR > V0 + 0.2);
  // solute never crosses
  run(t, 30);
  assert.equal(t.nL, 5);
  assert.equal(t.nR, 50);
});

test("semi-permeable equilibrium: osmotic difference balances the level difference", () => {
  const s = membrane({ membrane: "semi", left0: 40, right0: 10 });
  let done = false;
  for (let i = 0; i < 200 / DT && !done; i++) done = stepMembrane(s, DT);
  assert.ok(done);
  run(s, 60);
  const lhs = conc(s.nL, s.vL) - conc(s.nR, s.vR);
  assert.ok(Math.abs(lhs - G * (s.vL - s.vR)) < 0.01, `${lhs} vs ${G * (s.vL - s.vR)}`);
  assert.ok(s.vL > s.vR); // the concentrated side stands higher
  // equal solute on both sides: no osmosis at all
  const e = membrane({ membrane: "semi", left0: 20, right0: 20 });
  run(e, 10);
  assert.ok(Math.abs(e.vL - V0) < 1e-9);
});

test("particle count and water volume are conserved", () => {
  const s = membrane({ membrane: "permeable", left0: 37, right0: 12 });
  run(s, 20, x => {
    assert.equal(x.nL + x.nR, 49);
    assert.equal(particles(x).length, 49);
    assert.equal(particles(x).filter(p => p.x < 1).length, x.nL);
    assert.ok(Math.abs(x.vL + x.vR - 2 * V0) < 1e-9);
  });
});

test("same seed, same run", () => {
  const a = run(membrane({ membrane: "permeable" }, 9), 10);
  const b = run(membrane({ membrane: "permeable" }, 9), 10);
  assert.deepEqual([a.nL, a.vL, a.rng], [b.nL, b.vL, b.rng]);
});

const cell = (kind, outside) => {
  const s = { ...initialState(), scene: "cell", cell: kind, outside };
  restartCell(s);
  for (let i = 0; i < 300 / DT && !s.cellDone; i++) stepCell(s, DT);
  return s;
};

test("cell outcome per tonicity", () => {
  assert.equal(tonicity(C_IN0), "isotonic");
  assert.equal(tonicity(0), "hypotonic");
  assert.equal(tonicity(2), "hypertonic");
  const cases = [
    ["rbc", 0.9, "same"],
    ["rbc", 0, "burst"], // nước cất: hồng cầu vỡ
    ["rbc", 0.7, "swell"],
    ["rbc", 0.85, "swell"],
    ["rbc", 2, "shrink"],
    ["plant", 0.9, "same"],
    ["plant", 0, "swell"], // thành tế bào giữ cho tế bào không vỡ
    ["plant", 0.85, "swell"],
    ["plant", 3, "shrink"], // co nguyên sinh
  ];
  for (const [kind, outside, want] of cases) {
    assert.equal(cellOutcome(kind, outside), want, `${kind} ${outside}`);
    const s = cell(kind, outside);
    assert.ok(s.cellDone, `${kind} ${outside} settles`);
    assert.equal(reached(s), want, `${kind} ${outside} simulated`);
    if (!s.burst && kind === "rbc") assert.ok(Math.abs(cellInside(s) - outside) < 0.01, "inside equals outside at the end");
  }
  // plant cell in hypertonic solution: protoplast shrinks to c_in = c_out (plasmolysis)
  const p = cell("plant", 1.8);
  assert.ok(Math.abs(p.volume - C_IN0 / 1.8) < 0.01);
  // a wall-less cell in pure water reaches the burst volume
  assert.equal(cell("rbc", 0).volume, BURST);
});

test("a forged state is clamped", () => {
  const s = tidy({ ...initialState(), left0: 1e9, right0: -3, nL: 1e9, vL: -5, volume: -2, rng: NaN, time: -1 });
  assert.deepEqual([s.left0, s.right0, s.nL, s.nR, s.vL + s.vR, s.rng, s.time], [60, 0, 60, 0, 2 * V0, 0, 0]);
  assert.ok(s.vL > 0 && s.volume > 0);
});
