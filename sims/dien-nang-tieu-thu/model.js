// Household electricity: A = P·t per appliance, daily and monthly energy in kWh, and the bill from a
// stepped (block) residential tariff. The tariff in initialState is ILLUSTRATIVE and editable in the sim,
// not an official price list. VAT is not included.

export const DAYS = 30; // days in a billing month

export const LAMPS = {
  incandescent: { name: "Sợi đốt 60 W", power: 60 },
  compact: { name: "Compact 15 W", power: 15 },
  led: { name: "LED 9 W", power: 9 },
};

// Block limits in kWh: tier k covers (LIMITS[k−1], LIMITS[k]]; the last tier has no upper limit.
export const LIMITS = [50, 100, 200, 300, 400, Infinity];

export const APPLIANCES = [
  { id: "lamp", name: "Bóng đèn", short: "Đèn" },
  { id: "fan", name: "Quạt điện", short: "Quạt" },
  { id: "fridge", name: "Tủ lạnh", short: "Tủ lạnh" },
  { id: "ac", name: "Điều hòa", short: "Điều hòa" },
  { id: "cooker", name: "Nồi cơm điện", short: "Nồi cơm" },
  { id: "tv", name: "Tivi", short: "Tivi" },
];

const defaults = () => ({
  lampType: "incandescent",
  lampCount: 4,
  h_lamp: 5, // h/day
  p_fan: 50, // W
  h_fan: 8,
  p_fridge: 120, // W while the compressor runs
  h_fridge: 10, // h/day the compressor runs
  p_ac: 1000,
  h_ac: 6,
  p_cooker: 700,
  h_cooker: 1,
  p_tv: 100,
  h_tv: 4,
  // illustrative tariff, đồng/kWh for tiers 1..6
  t1: 1984,
  t2: 2050,
  t3: 2380,
  t4: 2998,
  t5: 3350,
  t6: 3460,
  editTariff: false,
  target: 20, // % cut of the bill the learner aims for
});

/** Power (W) and hours per day of each appliance. */
export function appliances(s) {
  const lamp = LAMPS[s.lampType] ?? LAMPS.incandescent;
  const clampH = h => Math.min(24, Math.max(0, h));
  return APPLIANCES.map(a => ({
    ...a,
    power: a.id === "lamp" ? lamp.power * Math.max(0, s.lampCount) : Math.max(0, s[`p_${a.id}`]),
    hours: clampH(s[`h_${a.id}`]),
  }));
}

/** A = P·t: energy in Wh for power P (W) during t (h). */
export const energyWh = (power, hours) => power * hours;
export const whToKwh = wh => wh / 1000;
export const kwhToJ = kwh => kwh * 3.6e6;

export const prices = s => [s.t1, s.t2, s.t3, s.t4, s.t5, s.t6].map(p => Math.max(0, p));

/** Split `kwh` over the tiers; returns [{ kwh, price, cost }] for each tier. */
export function tiers(kwh, price) {
  let lower = 0;
  return LIMITS.map((upper, k) => {
    const part = Math.max(0, Math.min(kwh, upper) - lower);
    lower = upper;
    return { kwh: part, price: price[k], cost: part * price[k] };
  });
}

export const billOf = (kwh, price) => tiers(kwh, price).reduce((sum, t) => sum + t.cost, 0);

/** Everything the view needs. Costs per appliance share the bill in proportion to energy. */
export function compute(s) {
  const items = appliances(s).map(a => {
    const dayKwh = whToKwh(energyWh(a.power, a.hours));
    return { ...a, dayKwh, monthKwh: dayKwh * DAYS };
  });
  const dayKwh = items.reduce((sum, a) => sum + a.dayKwh, 0);
  const monthKwh = dayKwh * DAYS;
  const price = prices(s);
  const bill = billOf(monthKwh, price);
  for (const a of items) a.cost = monthKwh > 0 ? (bill * a.monthKwh) / monthKwh : 0;
  const top = items.reduce((best, a) => (a.monthKwh > best.monthKwh ? a : best), items[0]);
  return { items, dayKwh, monthKwh, bill, tiers: tiers(monthKwh, price), top };
}

/** Bill if every lamp were LED (everything else unchanged). */
export const billWithLed = s => compute({ ...s, lampType: "led" }).bill;

export const initialState = () => {
  const s = defaults();
  const c = compute(s);
  return { ...s, refKwh: c.monthKwh, goalReached: false };
};

/**
 * Reference bill: the reference month's energy priced with the current tariff, so editing the
 * tariff never counts as a saving.
 */
export const refBill = s => billOf(Math.max(0, s.refKwh), prices(s));

/** Percentage cut of the bill against the reference (negative if the bill went up). */
export function cutPercent(s, bill = compute(s).bill) {
  const ref = refBill(s);
  return ref > 0 ? (100 * (ref - bill)) / ref : 0;
}
