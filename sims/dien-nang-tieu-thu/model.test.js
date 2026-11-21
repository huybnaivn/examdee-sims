import test from "node:test";
import assert from "node:assert/strict";
import { initialState, compute, energyWh, whToKwh, kwhToJ, billOf, tiers, prices, billWithLed, cutPercent, refBill, DAYS, LIMITS } from "./model.js";

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);
const P = prices(initialState());

test("A = P·t and the unit conversions", () => {
  near(energyWh(1000, 1), 1000); // 1 kW for 1 h
  near(whToKwh(energyWh(1000, 1)), 1);
  near(whToKwh(energyWh(60, 5)), 0.3);
  near(kwhToJ(1), 3.6e6);
  near(kwhToJ(whToKwh(energyWh(100, 2))), 100 * 2 * 3600); // P·t in W·s
});

test("each appliance: daily kWh = P·t/1000, monthly = daily × 30", () => {
  const c = compute(initialState());
  const ac = c.items.find(a => a.id === "ac");
  near(ac.dayKwh, (1000 * 6) / 1000);
  near(ac.monthKwh, 6 * DAYS);
  const lamp = c.items.find(a => a.id === "lamp");
  near(lamp.dayKwh, (4 * 60 * 5) / 1000);
});

test("stepped tariff at and around every tier boundary", () => {
  const cum = [0];
  let lower = 0;
  LIMITS.slice(0, 5).forEach((upper, k) => {
    cum.push(cum[k] + (upper - lower) * P[k]);
    lower = upper;
  });
  // exactly on a boundary everything is charged at the tiers below it
  LIMITS.slice(0, 5).forEach((upper, k) => near(billOf(upper, P), cum[k + 1]));
  // one more kWh is charged at the next tier's price
  LIMITS.slice(0, 5).forEach((upper, k) => near(billOf(upper + 1, P) - billOf(upper, P), P[k + 1]));
  near(billOf(0, P), 0);
  near(billOf(30, P), 30 * P[0]);
  near(billOf(150, P), 50 * P[0] + 50 * P[1] + 50 * P[2]);
  near(billOf(500, P), cum[5] + 100 * P[5]);
  // tier split adds up to the total energy
  near(tiers(357.5, P).reduce((a, t) => a + t.kwh, 0), 357.5);
  // a bill is never cheaper per kWh for a bigger consumer (prices rise with the tier)
  assert.ok(billOf(400, P) / 400 > billOf(100, P) / 100);
});

test("doubling the hours of one appliance doubles its energy", () => {
  const s = initialState();
  for (const id of ["lamp", "fan", "fridge", "ac", "cooker", "tv"]) {
    const one = compute(s).items.find(a => a.id === id).monthKwh;
    const two = compute({ ...s, [`h_${id}`]: s[`h_${id}`] * 2 }).items.find(a => a.id === id).monthKwh;
    near(two, 2 * one);
  }
  // doubling every appliance's hours doubles the total
  const all = { ...s };
  for (const id of ["lamp", "fan", "fridge", "ac", "cooker", "tv"]) all[`h_${id}`] = s[`h_${id}`] * 2;
  near(compute(all).monthKwh, 2 * compute(s).monthKwh);
});

test("totals equal the sum of the appliances; costs share the bill", () => {
  const c = compute(initialState());
  near(c.monthKwh, c.items.reduce((a, it) => a + it.monthKwh, 0));
  near(c.dayKwh * DAYS, c.monthKwh);
  near(c.items.reduce((a, it) => a + it.cost, 0), c.bill);
  near(c.monthKwh, 297); // 9,9 kWh/ngày
  near(c.bill, 50 * 1984 + 50 * 2050 + 100 * 2380 + 97 * 2998);
  assert.equal(c.top.id, "ac");
});

test("switching to LED and cutting hours lower the bill; the cut is measured against the reference", () => {
  const s = initialState();
  near(cutPercent(s), 0);
  const led = billWithLed(s);
  assert.ok(led < refBill(s));
  // 4 × (60 − 9) W × 5 h × 30 d = 30,6 kWh less, all of it taken from tier 4
  near(refBill(s) - led, 30.6 * 2998, 1e-9);
  const less = { ...s, h_ac: 3 };
  assert.ok(cutPercent(less) > 20);
  assert.ok(cutPercent({ ...s, h_ac: 10 }) < 0);
  // cheaper prices are not a saving in energy use
  near(cutPercent({ ...s, t4: 1000, t3: 1000 }), 0);
});

test("forged or empty inputs stay sane", () => {
  const c = compute({ ...initialState(), h_tv: 99, p_fan: -50, lampCount: -3, lampType: "x" });
  near(c.items.find(a => a.id === "tv").hours, 24);
  near(c.items.find(a => a.id === "fan").monthKwh, 0);
  near(c.items.find(a => a.id === "lamp").monthKwh, 0);
  const off = initialState();
  for (const id of ["lamp", "fan", "fridge", "ac", "cooker", "tv"]) off[`h_${id}`] = 0;
  assert.deepEqual([compute(off).monthKwh, compute(off).bill], [0, 0]);
});
