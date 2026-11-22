import test from "node:test";
import assert from "node:assert/strict";
import { initialState, solve, taskMet, tap, sanitizeParts, sortParts, PRESETS } from "./model.js";

const near = (a, b, rel = 1e-3) => assert.ok(Math.abs(a - b) <= rel * Math.max(Math.abs(b), 1e-9), `${a} ≠ ${b}`);
const W = e => ({ e, t: "wire" });
const B = e => ({ e, t: "bulb" });
const pin = (e, flip = false) => ({ e, t: "battery", flip });
const make = (parts, extra = {}) => ({ ...initialState(), emf: 3, bulbR: 6, parts: sortParts(parts), ...extra });

// pin on the left edge, + at the top: (0,0)–(0,1)
const SERIES = [pin("v-0-0"), B("h-0-0"), B("h-1-0"), W("v-2-0"), W("h-0-1"), W("h-1-1")];
const PARALLEL = [pin("v-0-0"), W("h-0-0"), W("h-0-1"), B("v-1-0"), W("h-1-0"), W("h-1-1"), B("v-2-0")];
const MIXED = [pin("v-0-0"), B("h-0-0"), B("v-1-0"), W("h-1-0"), W("h-1-1"), B("v-2-0"), W("h-0-1")];

test("series: I = E / (R₁ + R₂), voltages add up", () => {
  const sol = solve(make(SERIES));
  near(sol.total, 3 / 12);
  for (const b of sol.bulbs) {
    near(b.i, 0.25);
    near(b.u, 1.5);
  }
  assert.equal(sol.errors.length, 0);
  assert.equal(sol.lit, 2);
});

test("parallel: same voltage on each bulb, currents add up", () => {
  const sol = solve(make(PARALLEL));
  near(sol.total, 1);
  for (const b of sol.bulbs) {
    near(b.u, 3);
    near(b.i, 0.5);
  }
});

test("mixed network: one bulb in series with two in parallel (nodal analysis)", () => {
  const sol = solve(make(MIXED));
  near(sol.total, 3 / 9); // R = 6 + 6/2 = 9 Ω
  const [main, ...branch] = [...sol.bulbs].sort((a, b) => b.p - a.p);
  near(main.i, 1 / 3);
  near(main.u, 2);
  for (const b of branch) {
    near(b.i, 1 / 6);
    near(b.u, 1);
  }
  // brightness ordering: the series bulb gets 4× the power of each parallel bulb
  near(main.p, 4 * branch[0].p);
  assert.ok(main.level > branch[0].level);
  // two pins in series double the current
  const two = solve(make([pin("v-0-0"), pin("v-0-1"), B("h-0-0"), W("v-1-0"), W("v-1-1"), W("h-0-2")]));
  near(two.total, 1); // 6 V over 6 Ω
  // a reversed pin cancels
  const off = solve(make([pin("v-0-0"), pin("v-0-1", true), B("h-0-0"), W("v-1-0"), W("v-1-1"), W("h-0-2")]));
  near(off.total + 1, 1);
  assert.equal(off.lit, 0);
});

test("brighter bulbs in parallel than in series", () => {
  assert.ok(solve(make(PARALLEL)).bulbs[0].p > solve(make(SERIES)).bulbs[0].p);
});

test("an open switch breaks the current; tapping it closes the circuit", () => {
  const s = make([...SERIES.filter(p => p.e !== "v-2-0"), { e: "v-2-0", t: "switch", on: false }]);
  const open = solve(s);
  assert.ok(open.total < 1e-9);
  assert.equal(open.closed, false);
  assert.equal(open.lit, 0);
  assert.deepEqual(tap(s, "v-2-0", "bulb"), { did: "toggle", type: "switch", closed: true });
  near(solve(s).total, 0.25);
});

test("short circuit: a wire across the pin", () => {
  const sol = solve(make([...SERIES, W("v-1-0")])); // wire from (1,0) to (1,1) bypasses bulb 2 only
  assert.equal(sol.short, false);
  assert.ok(sol.notes.some(n => n.includes("nối tắt")));
  near(sol.total, 0.5);
  const short = solve(make([pin("v-0-0"), W("h-0-0"), W("v-1-0"), W("h-0-1"), B("h-1-0"), W("v-2-0"), W("h-1-1")]));
  assert.equal(short.short, true);
  assert.ok(short.errors[0].startsWith("Đoản mạch"));
  assert.equal(short.lit, 0);
});

test("ammeter in parallel is detected, in series it reads the current", () => {
  const good = solve(make([...SERIES.filter(p => p.e !== "v-2-0"), { e: "v-2-0", t: "ammeter" }]));
  assert.equal(good.errors.length, 0);
  near(good.items.find(p => p.t === "ammeter").value, 0.25);
  // ammeter across bulb 2: it bypasses the bulb
  const bad = solve(make([...SERIES, { e: "v-1-0", t: "ammeter" }]));
  assert.ok(bad.errors.some(e => e.startsWith("Ampe kế mắc song song với đèn")));
  assert.equal(bad.bulbs.filter(b => b.lit).length, 1);
  // ammeter straight across the pin
  const worse = solve(make([pin("v-0-0"), { e: "v-1-0", t: "ammeter" }, W("h-0-0"), W("h-0-1")]));
  assert.equal(worse.short, true);
  assert.ok(worse.errors.some(e => e.startsWith("Ampe kế mắc song song với pin")));
});

test("voltmeter in series is detected; across a bulb it reads its voltage", () => {
  const good = solve(make([...SERIES, { e: "v-1-0", t: "voltmeter" }])); // across... (1,0)-(1,1): bulb 2 + wires
  assert.equal(good.errors.length, 0);
  near(good.items.find(p => p.t === "voltmeter").value, 1.5);
  const bad = solve(make([...SERIES.filter(p => p.e !== "v-2-0"), { e: "v-2-0", t: "voltmeter" }]));
  assert.ok(bad.errors.some(e => e.startsWith("Vôn kế")));
  assert.equal(bad.lit, 0);
  near(bad.items.find(p => p.t === "voltmeter").value, 3, 1e-4); // it reads the whole source voltage
  // a voltmeter straight across the pin is a correct use
  const across = solve(make([pin("v-0-0"), W("h-0-0"), W("h-0-1"), { e: "v-1-0", t: "voltmeter" }]));
  assert.equal(across.errors.length, 0);
  near(across.items.find(p => p.t === "voltmeter").value, 3);
});

test("initial circuit: closed, the meters read the bulb's current and voltage", () => {
  const s = initialState();
  const sol = solve(s);
  assert.equal(sol.errors.length, 0);
  near(sol.total, 0.5);
  near(sol.items.find(p => p.t === "ammeter").value, 0.5);
  near(sol.items.find(p => p.t === "voltmeter").value, 3);
  assert.ok(taskMet(s));
  assert.ok(taskMet({ ...s, task: "measure" }));
});

test("tasks recognise the requested circuits", () => {
  assert.ok(taskMet(make(PRESETS.series, { task: "series2" })));
  assert.ok(!taskMet(make(PRESETS.series, { task: "parallel2" })));
  assert.ok(taskMet(make(PRESETS.parallel, { task: "parallel2" })));
  assert.ok(!taskMet(make(PRESETS.parallel, { task: "series2" })));
  assert.ok(taskMet(make(MIXED, { task: "mixed" })));
  assert.ok(!taskMet(make(SERIES, { task: "series1" }))); // two bulbs and no switch
});

test("tap places, replaces, flips and erases", () => {
  const s = make([]);
  assert.equal(tap(s, "h-0-0", "bulb").did, "place");
  assert.equal(tap(s, "h-0-0", "ammeter").did, "place");
  assert.equal(s.parts[0].t, "ammeter");
  tap(s, "v-0-0", "battery");
  assert.equal(tap(s, "v-0-0", "battery").did, "flip");
  assert.equal(s.parts.find(p => p.e === "v-0-0").flip, true);
  assert.equal(tap(s, "h-0-0", "erase").did, "remove");
  assert.equal(tap(s, "h-9-0", "wire"), null);
});

test("sanitize keeps only valid, unique parts", () => {
  const out = sanitizeParts([
    { e: "h-0-0", t: "bulb" },
    { e: "h-0-0", t: "wire" },
    { e: "h-5-0", t: "wire" }, // off the grid
    { e: "v-0-3", t: "wire" }, // off the grid
    { e: "v-1-1", t: "laser" },
    { e: "v-1-1", t: "switch", on: "yes", evil: 1 },
    null,
    "x",
  ]);
  assert.deepEqual(out, [{ e: "h-0-0", t: "bulb" }, { e: "v-1-1", t: "switch", on: false }]);
  assert.equal(sanitizeParts("nope"), null);
});
