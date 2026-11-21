import test from "node:test";
import assert from "node:assert/strict";
import { REACTIONS, reactionById, deltaH, bondEstimate, scaledH, isExo, profile, nextQuestion } from "./model.js";

const close = (a, b, tol = 0.05) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);

test("ΔrH° = ΣΔfH°(products) − ΣΔfH°(reactants)", () => {
  close(deltaH(reactionById("ch4")), -393.5 + 2 * -241.8 - -74.6); // −802,5
  close(deltaH(reactionById("ch4")), -802.5);
  close(deltaH(reactionById("h2o")), -483.6);
  close(deltaH(reactionById("nh3")), -91.8);
  close(deltaH(reactionById("hcl")), -184.6);
  close(deltaH(reactionById("caco3")), 178.3);
  close(deltaH(reactionById("nh4no3")), 28.1);
});

test("bond-energy estimate: ΣEb(reactants) − ΣEb(products), close to the ΔfH° value for gases", () => {
  assert.equal(bondEstimate(reactionById("ch4")), 4 * 414 + 2 * 498 - (2 * 799 + 4 * 464));
  assert.equal(bondEstimate(reactionById("nh3")), 945 + 3 * 436 - 6 * 391);
  assert.equal(bondEstimate(reactionById("hcl")), 436 + 243 - 2 * 432);
  for (const r of REACTIONS) {
    if (r.bonds) assert.ok(Math.abs(bondEstimate(r) - deltaH(r)) < 10, r.id);
    else assert.equal(bondEstimate(r), null);
  }
});

test("sign of ΔrH° gives the classification", () => {
  const exo = REACTIONS.filter(r => isExo(deltaH(r))).map(r => r.id);
  assert.deepEqual(exo, ["ch4", "h2o", "nh3", "hcl"]);
  assert.equal(isExo(deltaH(reactionById("caco3"))), false);
  assert.equal(isExo(deltaH(reactionById("nh4no3"))), false);
});

test("heat scales with the amount of the reference reactant", () => {
  close(scaledH(reactionById("ch4"), 0.5), -401.25, 1e-9);
  close(scaledH(reactionById("h2o"), 1), -241.8, 1e-9); // per mol H2, the equation has 2 H2
  close(scaledH(reactionById("caco3"), 2), 356.6, 1e-9);
  for (const r of REACTIONS) close(scaledH(r, 3), 3 * scaledH(r, 1), 1e-9);
});

test("a catalyst lowers Ea and leaves ΔrH unchanged; the peak stays above both levels", () => {
  for (const r of REACTIONS) {
    const off = profile(r, false);
    const on = profile(r, true);
    assert.equal(on.dH, off.dH);
    assert.ok(on.ea < off.ea);
    assert.ok(on.ea > Math.max(0, on.dH));
  }
});

test("next quiz question is a different reaction", () => {
  for (const r of [0, 0.5, 0.9999]) assert.notEqual(nextQuestion("ch4", () => r), "ch4");
});
