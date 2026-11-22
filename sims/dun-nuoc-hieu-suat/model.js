// Heating water to the boil with an electric kettle or a gas stove.
// SI units: kg, °C, W, J, s. Efficiency is stored in percent.

export const C_WATER = 4200; // J/(kg·K), specific heat capacity of water
export const BOIL = 100; // °C at standard pressure
export const J_PER_KWH = 3.6e6;
export const PRICE_KWH = 3000; // đ per kW·h, illustrative
export const GAS_HEAT = 44e6; // J/kg, heat of combustion of bottled gas
export const GAS_PRICE = 35000; // đ per kg, illustrative

/** Typical power and efficiency of each appliance (illustrative). */
export const PRESETS = {
  kettle: { power: 1500, efficiency: 90 },
  gas: { power: 2000, efficiency: 50 },
};

export const initialState = () => ({
  appliance: "kettle", // "kettle" (electric) | "gas"
  mass: 1.5, // kg of water
  startTemp: 25, // °C
  power: PRESETS.kettle.power, // W: electrical power, or heat released per second by the burner
  efficiency: PRESETS.kettle.efficiency, // %, share of the supplied energy that heats the water
  guess: 0, // s, the learner's predicted boiling time; 0 = no prediction
  time: 0, // s of heating so far
});

/** Heat the water must receive to reach the boil, Q = m·c·Δt. */
export const heatNeeded = (mass, startTemp) => mass * C_WATER * Math.max(0, BOIL - startTemp);

/** Time to the boil, t = Q / (H·P). */
export const boilTime = s => heatNeeded(s.mass, s.startTemp) / ((s.efficiency / 100) * s.power);

/** Heating time so far, kept inside [0, boilTime] even if the stored value was forged. */
export const elapsed = s => Math.min(Math.max(0, Number(s.time) || 0), boilTime(s));

/** Water temperature after t seconds of heating; it stops at the boiling point. */
export const tempAt = (s, t) => Math.min(BOIL, s.startTemp + ((s.efficiency / 100) * s.power * t) / (s.mass * C_WATER));

export const boiled = s => elapsed(s) >= boilTime(s);

/** Energy supplied by the appliance in t seconds, A = P·t (J). */
export const energySupplied = (s, t) => s.power * t;

export const toKwh = joules => joules / J_PER_KWH;

/** Mass of gas burnt to release the given energy (kg). */
export const gasMass = joules => joules / GAS_HEAT;

/** Cost in đồng at the illustrative prices. */
export const cost = (appliance, joules) => (appliance === "gas" ? gasMass(joules) * GAS_PRICE : toKwh(joules) * PRICE_KWH);

/** Everything about heating to the boil with the given settings. */
export function summary(s) {
  const heat = heatNeeded(s.mass, s.startTemp);
  const time = boilTime(s);
  const energy = energySupplied(s, time);
  return { heat, time, energy, loss: energy - heat, kwh: toKwh(energy), cost: cost(s.appliance, energy) };
}

/** The same water on the other appliance at its typical settings. */
export const other = s => {
  const appliance = s.appliance === "gas" ? "kettle" : "gas";
  return { ...s, appliance, ...PRESETS[appliance] };
};

export const restart = s => {
  s.time = 0;
  return s;
};

/** Advance the heating by dt seconds. Returns true on the step in which the water reaches the boil. */
export function step(s, dt) {
  const end = boilTime(s);
  let t = elapsed(s);
  if (t >= end) t = 0; // pressing play after the boil starts over with cold water
  s.time = Math.min(end, t + dt);
  return s.time >= end;
}

/** A prediction counts when it is within 5 % of the boiling time (or 10 s for short times). */
export const predictionOk = (guess, time) => guess > 0 && Math.abs(guess - time) <= Math.max(10, 0.05 * time);
