import test from "node:test";
import assert from "node:assert/strict";
import {
  DAYS, K, MAX_RATE, initialState, jar, ironRate, zincRate, corrosion, zincLoss, reason, add, remove, has,
  contents, step, winner, missionMet, ITEM_ORDER,
} from "./model.js";

const J = (patch = {}) => ({ liquid: "tap", oil: false, dry: false, coat: false, partner: "none", ...patch });

test("rust needs both water and oxygen on bare iron", () => {
  assert.equal(ironRate(J({ liquid: "none", dry: true })), 0); // no water
  assert.equal(ironRate(J({ liquid: "boiled", oil: true })), 0); // no oxygen
  assert.equal(ironRate(J({ coat: true, liquid: "salt" })), 0); // iron not reached
  assert.ok(ironRate(J({ liquid: "tap" })) > 0);
  assert.ok(ironRate(J({ liquid: "none" })) > 0 && ironRate(J({ liquid: "none" })) < ironRate(J({ liquid: "tap" })));
});

test("the documented order: Fe–Cu in salt water > salt water > tap water > boiled water > moist air", () => {
  const order = [
    J({ liquid: "salt", partner: "Cu" }), J({ liquid: "salt" }), J({ liquid: "tap" }), J({ liquid: "boiled" }), J({ liquid: "none" }),
  ].map(ironRate);
  for (let i = 1; i < order.length; i++) assert.ok(order[i - 1] > order[i], `${order[i - 1]} > ${order[i]}`);
});

test("an oil layer slows rusting but does not stop acid", () => {
  assert.ok(ironRate(J({ liquid: "salt", oil: true })) < ironRate(J({ liquid: "salt" })));
  assert.equal(ironRate(J({ liquid: "vinegar", oil: true })), ironRate(J({ liquid: "vinegar" })));
});

test("zinc is sacrificed and protects the iron; copper makes it worse", () => {
  const zn = J({ liquid: "salt", partner: "Zn" });
  assert.equal(ironRate(zn), 0);
  assert.ok(zincRate(zn) > 0);
  assert.ok(zincLoss(zn, DAYS) > 0.8);
  assert.equal(zincRate(J({ liquid: "none", partner: "Zn" })), 0); // dry: no cell at all
  assert.ok(ironRate(J({ liquid: "tap", partner: "Cu" })) > ironRate(J({ liquid: "tap" })));
  assert.equal(zincRate(J({ liquid: "salt", partner: "Cu" })), 0);
});

test("corrosion grows with time, stays in 0–1 and follows 1 − e^(−K·rate·t)", () => {
  const j = J({ liquid: "salt" });
  let last = -1;
  for (let d = 0; d <= DAYS; d += 3) {
    const c = corrosion(j, d);
    assert.ok(c > last && c >= 0 && c < 1);
    last = c;
  }
  assert.ok(Math.abs(corrosion(j, DAYS) - (1 - Math.exp(-K * 3 * DAYS))) < 1e-12);
  assert.equal(corrosion(j, -5), 0);
  assert.equal(corrosion(j, 1e9), corrosion(j, DAYS));
  assert.equal(corrosion(j, NaN), 0);
});

test("adding and removing items follows the lab rules", () => {
  const s = initialState();
  s.day = 12;
  assert.equal(add(s, 1, "salt"), "");
  assert.equal(s.day, 0); // a changed jar is a new experiment
  assert.ok(has(s, 1, "salt") && !has(s, 1, "tap")); // liquids replace each other
  assert.equal(add(s, 1, "oil"), "");
  assert.notEqual(add({ ...s, l2: "none" }, 2, "oil"), ""); // oil needs a liquid to float on
  add(s, 1, "dry"); // the drying agent empties the jar
  assert.deepEqual(contents(s, 1), ["dry"]);
  add(s, 1, "tap"); // and water makes it useless
  assert.deepEqual(contents(s, 1), ["tap"]);
  add(s, 1, "Zn");
  add(s, 1, "Cu"); // one partner metal at a time
  assert.ok(has(s, 1, "Cu") && !has(s, 1, "Zn"));
  remove(s, 1, "Cu");
  remove(s, 1, "tap");
  assert.deepEqual(contents(s, 1), []);
  assert.notEqual(add(s, 9, "tap"), "");
  assert.notEqual(add(s, 1, "gold"), "");
  for (const item of ITEM_ORDER) assert.equal(typeof has(s, 2, item), "boolean");
});

test("a run ends once, on the last day", () => {
  const s = initialState();
  let ends = 0;
  for (let i = 0; i < 4000; i++) if (step(s, 0.01)) ends++;
  assert.equal(ends, 1);
  assert.equal(s.day, DAYS);
  assert.ok(s.done);
});

test("the starting jars: salt water with copper rusts most, the painted nail not at all", () => {
  const s = initialState();
  assert.equal(winner(s), 2);
  assert.equal(corrosion(jar(s, 3), DAYS), 0);
  assert.ok(corrosion(jar(s, 2), DAYS) > corrosion(jar(s, 1), DAYS));
  assert.equal(winner({ ...s, p2: "none", c3: false }), 0); // two equal jars: no single winner
});

test("missions are met only by the right set-up", () => {
  const s = initialState();
  assert.ok(missionMet(s, "keep-shiny")); // jar 3: painted nail in salt water
  assert.ok(!missionMet({ ...s, c3: false }, "keep-shiny"));
  assert.ok(missionMet({ ...s, c3: false, p3: "Zn" }, "keep-shiny"));
  assert.ok(!missionMet(s, "sacrifice"));
  assert.ok(missionMet({ ...s, p1: "Zn" }, "sacrifice"));
  assert.ok(!missionMet(s, "fastest"));
  const fast = { ...s, l1: "vinegar", p1: "Cu" };
  assert.equal(ironRate(jar(fast, 1)), MAX_RATE);
  assert.ok(missionMet(fast, "fastest"));
  assert.ok(!missionMet(s, "none"));
});

test("forged jar contents fall back to something harmless, and every jar has an explanation", () => {
  const s = { ...initialState(), l1: "lava", p1: "Au", o1: "yes", c1: 1 };
  assert.deepEqual(jar(s, 1), { liquid: "none", oil: false, dry: false, coat: false, partner: "none" });
  for (const liquid of ["none", "boiled", "tap", "salt", "vinegar"])
    for (const partner of ["none", "Zn", "Cu"])
      for (const flag of [{}, { oil: true }, { dry: true }, { coat: true }]) assert.ok(reason(J({ liquid, partner, ...flag })).length > 10);
});
