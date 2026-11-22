import test from "node:test";
import assert from "node:assert/strict";
import { BINS, SAMPLES, SUBSTANCES, ATOMS, ATOM, initialState, classify, place, placedIn, isCorrect, score, picture, sampleOf } from "./model.js";

// The classification the textbook gives for each sample.
const TABLE = {
  oxygen: "don-chat",
  sat: "don-chat",
  nuoc: "hop-chat",
  muoi: "hop-chat",
  khongkhi: "dong-nhat",
  nuocmuoi: "dong-nhat",
  catsat: "khong-dong-nhat",
  nuoccat: "khong-dong-nhat",
};

/** Atoms of each element in the drawn picture, per substance. */
const census = sample => {
  const out = {};
  for (const p of picture(sample)) {
    out[p.sub] ??= {};
    for (const [el] of p.atoms) out[p.sub][el] = (out[p.sub][el] ?? 0) + 1;
  }
  return out;
};

test("classification table for every sample", () => {
  assert.deepEqual(SAMPLES.map(s => s.id).sort(), Object.keys(TABLE).sort());
  for (const sample of SAMPLES) assert.equal(classify(sample), TABLE[sample.id], sample.name);
  // every leaf of the tree is used, and every answer is a leaf
  assert.deepEqual([...new Set(Object.values(TABLE))].sort(), BINS.map(b => b.id).sort());
});

test("elements: the picture holds atoms of one element only", () => {
  for (const sample of SAMPLES.filter(s => TABLE[s.id] === "don-chat")) {
    const elements = new Set(picture(sample).flatMap(p => p.atoms.map(a => a[0])));
    assert.equal(elements.size, 1, sample.name);
    assert.equal(sample.parts.length, 1);
  }
});

test("compounds: one substance, several elements, in the fixed ratio of the formula", () => {
  for (const sample of SAMPLES.filter(s => TABLE[s.id] === "hop-chat")) {
    const [[sub, units]] = sample.parts;
    assert.equal(sample.parts.length, 1, sample.name);
    const counts = census(sample)[sub];
    assert.ok(Object.keys(counts).length >= 2, sample.name);
    for (const [el, n] of Object.entries(SUBSTANCES[sub].atoms)) assert.equal(counts[el], n * units, `${sample.name}: ${el}`);
    // molecules: every drawn particle is one whole formula unit
    if (!SUBSTANCES[sub].ions) {
      for (const p of picture(sample)) assert.equal(p.atoms.length, Object.values(SUBSTANCES[sub].atoms).reduce((a, b) => a + b));
    }
  }
  const salt = census(sampleOf("muoi")).NaCl;
  assert.equal(salt.Na, salt.Cl); // 1 : 1
  const water = census(sampleOf("nuoc")).H2O;
  assert.equal(water.H, 2 * water.O); // 2 : 1
});

test("mixtures: several kinds of particles, each substance keeping its own formula", () => {
  for (const sample of SAMPLES.filter(s => TABLE[s.id].includes("dong-nhat"))) {
    const c = census(sample);
    assert.ok(Object.keys(c).length >= 2, sample.name);
    for (const [sub, units] of sample.parts) {
      for (const [el, n] of Object.entries(SUBSTANCES[sub].atoms)) assert.equal(c[sub][el], n * units, `${sample.name}: ${sub} ${el}`);
    }
  }
  // air: about 78 % of the drawn molecules are nitrogen
  const air = picture(sampleOf("khongkhi"));
  const n2 = air.filter(p => p.sub === "N2").length / air.length;
  assert.ok(n2 > 0.75 && n2 < 0.82, `N2 fraction ${n2}`);
  // salt water below saturation (26,4 % by mass at 20 °C)
  const [[, water], [, salt]] = sampleOf("nuocmuoi").parts;
  const massFraction = (salt * 58.44) / (salt * 58.44 + water * 18.015);
  assert.ok(massFraction < 0.264);
});

test("homogeneous mixtures are interleaved, heterogeneous ones are in clumps", () => {
  // number of changes of substance along the drawing order (rows, top to bottom)
  const switches = sample => {
    const subs = picture(sample).slice().sort((a, b) => a.y - b.y || a.x - b.x).map(p => p.sub);
    return subs.filter((sub, i) => i && sub !== subs[i - 1]).length;
  };
  for (const id of ["catsat", "nuoccat"]) assert.ok(switches(sampleOf(id)) <= 3, id);
  for (const id of ["khongkhi", "nuocmuoi"]) assert.ok(switches(sampleOf(id)) >= 3, id);
  // salt lattice: nearest neighbours are always of the other ion
  const ions = picture(sampleOf("muoi"));
  assert.equal(ions.length, 16);
  for (const a of ions) {
    for (const b of ions) {
      if (Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - 0.36) < 1e-9) assert.notEqual(a.atoms[0][0], b.atoms[0][0]);
    }
  }
});

test("every particle is inside the zoom circle, of a known element, and the picture is repeatable", () => {
  for (const sample of SAMPLES) {
    const a = picture(sample);
    assert.deepEqual(a, picture(sample));
    for (const p of a) {
      for (const [el, dx, dy] of p.atoms) {
        assert.ok(ATOMS[el], el);
        assert.ok(Math.hypot(p.x, p.y) + (Math.hypot(dx, dy) + ATOMS[el].r) * ATOM <= 1, `${sample.name} fits`);
      }
    }
  }
});

test("placing and scoring", () => {
  const s = initialState();
  assert.deepEqual(score(s), { total: 8, placed: 0, correct: 0, done: false, allCorrect: false });
  assert.equal(place(s, "oxygen", "don-chat"), true);
  assert.equal(place(s, "oxygen", "don-chat"), false); // no change
  assert.equal(place(s, "nuoc", "don-chat"), true); // wrong on purpose
  assert.equal(isCorrect(s, "oxygen"), true);
  assert.equal(isCorrect(s, "nuoc"), false);
  assert.deepEqual(score(s), { total: 8, placed: 2, correct: 1, done: false, allCorrect: false });
  for (const sample of SAMPLES) if (!placedIn(s, sample.id)) place(s, sample.id, TABLE[sample.id]);
  assert.deepEqual(score(s), { total: 8, placed: 8, correct: 7, done: true, allCorrect: false });
  place(s, "nuoc", "hop-chat");
  assert.deepEqual(score(s), { total: 8, placed: 8, correct: 8, done: true, allCorrect: true });
  assert.equal(place(s, "nuoc", ""), true); // back to the tray
  assert.equal(score(s).placed, 7);
});

test("unknown samples, unknown bins and forged state are ignored", () => {
  const s = initialState();
  assert.equal(place(s, "vang", "don-chat"), false);
  assert.equal(place(s, "oxygen", "kim-loai"), false);
  s.at_oxygen = "kim-loai";
  s.at_sat = 5;
  assert.equal(placedIn(s, "oxygen"), "");
  assert.equal(placedIn(s, "sat"), "");
  assert.equal(score(s).placed, 0);
});
