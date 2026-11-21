import test from "node:test";
import assert from "node:assert/strict";
import { initialState, check, parseLinks, linksText, parseRemoved, web, energyAt, pyramid, longestChain, addLink, removeLink, removeSpecies, E0 } from "./model.js";

const make = (links, removed = "") => ({ ...initialState(), links, removed });
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b)), `${a} vs ${b}`);

test("valid links follow the diet table", () => {
  for (const [f, t] of [["co", "tho"], ["co", "chauchau"], ["chauchau", "ech"], ["ech", "ran"], ["chuot", "cu"], ["ran", "cu"], ["cu", "vikhuan"], ["co", "vikhuan"]]) {
    assert.deepEqual(check([], f, t), { ok: true, reason: "" }, `${f} → ${t}`);
  }
});

test("invalid links are rejected with a reason", () => {
  assert.equal(check([], "tho", "ech").reason, "diet"); // frogs do not eat rabbits
  assert.equal(check([], "ech", "co").reason, "diet"); // a producer eats nothing
  assert.equal(check([], "vikhuan", "chuot").reason, "diet");
  assert.equal(check([], "co", "co").reason, "self");
  assert.equal(check([["co", "tho"]], "co", "tho").reason, "duplicate");
  assert.equal(check([], "co", "soi").reason, "unknown");
  assert.equal(check([], "co", "tho", new Set(["tho"])).reason, "removed");
});

test("cycles are rejected first, before the diet check", () => {
  assert.equal(check([["co", "tho"]], "tho", "co").reason, "cycle");
  const chain = [["co", "chauchau"], ["chauchau", "ech"], ["ech", "ran"], ["ran", "cu"]];
  assert.equal(check(chain, "cu", "co").reason, "cycle");
  assert.equal(check(chain, "ran", "chauchau").reason, "cycle");
  assert.equal(check([...chain, ["cu", "vikhuan"]], "vikhuan", "co").reason, "cycle");
  // the same arrow without the chain is only a diet error
  assert.equal(check([], "cu", "co").reason, "diet");
});

test("links stored as a string are validated on read", () => {
  const links = parseLinks("co>tho,tho>co,co>tho,xx>yy,tho>ech,,co>chauchau,chauchau,tho>cu");
  assert.deepEqual(links, [["co", "tho"], ["co", "chauchau"], ["tho", "cu"]]);
  assert.equal(linksText(links), "co>tho,co>chauchau,tho>cu");
  assert.deepEqual([...parseRemoved("ran,foo,ran,co")].sort(), ["co", "ran"]);
  assert.deepEqual(parseLinks(undefined), []);
  assert.deepEqual(parseLinks(42), []);
});

test("trophic level is the longest path from a producer", () => {
  const w = web(initialState());
  assert.deepEqual(
    { co: w.level.co, chauchau: w.level.chauchau, ech: w.level.ech, ran: w.level.ran, chuot: w.level.chuot, cu: w.level.cu },
    { co: 1, chauchau: 2, ech: 3, ran: 4, chuot: 2, cu: 5 }
  );
  assert.equal(w.level.tho, null); // not linked to a producer
  assert.equal(w.levels, 5);
  assert.deepEqual(longestChain(w), ["co", "chauchau", "ech", "ran", "cu"]);
  // the mouse also eats grasshoppers: it moves up to level 3
  const s = initialState();
  addLink(s, "chauchau", "chuot");
  assert.equal(web(s).level.chuot, 3);
  assert.equal(web(s).level.cu, 5);
  // decomposers are not a trophic level
  addLink(s, "cu", "vikhuan");
  assert.equal(web(s).level.vikhuan, null);
  assert.equal(web(s).levels, 5);
});

test("energy per level: E₀·eᵏ⁻¹", () => {
  close(energyAt(1, 10), E0);
  close(energyAt(2, 10), 1000);
  close(energyAt(3, 10), 100);
  close(energyAt(5, 10), 1);
  close(energyAt(3, 20), 400);
  close(energyAt(4, 5), 1.25);
  const p = pyramid(4, 10);
  assert.equal(p.length, 4);
  p.slice(1).forEach((e, i) => close(e / p[i], 0.1));
});

test("removing a producer collapses every consumer that depends on it", () => {
  const s = initialState();
  addLink(s, "cu", "vikhuan");
  const n = removeSpecies(s, "co");
  const w = web(s);
  assert.equal(n, 6);
  for (const id of ["chauchau", "ech", "ran", "chuot", "cu", "vikhuan"]) assert.ok(w.collapsed.has(id), id);
  assert.equal(w.levels, 0);
  assert.equal(w.collapsed.has("tho"), false); // never linked: not part of this web
});

test("removing one prey: a predator with another food survives at a lower level", () => {
  const s = initialState();
  assert.equal(removeSpecies(s, "ech"), 1); // the snake ate only frogs
  const w = web(s);
  assert.ok(w.collapsed.has("ran"));
  assert.equal(w.alive("cu"), true);
  assert.equal(w.level.cu, 3); // cỏ → chuột → cú
  assert.equal(w.levels, 3);
  assert.equal(addLink(s, "ech", "vikhuan").reason, "removed");
});

test("links can be removed; adding stores a validated string", () => {
  const s = make("");
  assert.equal(addLink(s, "co", "tho").ok, true);
  assert.equal(addLink(s, "tho", "co").reason, "cycle");
  assert.equal(s.links, "co>tho");
  assert.equal(removeLink(s, "co", "tho"), true);
  assert.equal(s.links, "");
  assert.equal(removeLink(s, "co", "tho"), false);
});
