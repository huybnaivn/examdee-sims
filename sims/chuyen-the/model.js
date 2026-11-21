// Heating a sample of ice at constant power until it is all steam, no heat loss.
// Five stages: ice warms, ice melts at 0 °C, water warms, water boils at 100 °C, steam warms.
// SI units: kg, °C, J, W, s.

export const C_ICE = 2100; // J/(kg·K), specific heat of ice
export const C_WATER = 4200; // J/(kg·K)
export const C_STEAM = 2000; // J/(kg·K), steam at constant pressure (rounded)
export const LAMBDA = 3.4e5; // J/kg, specific latent heat of fusion of ice
export const L_VAP = 2.3e6; // J/kg, specific latent heat of vaporisation of water at 100 °C
export const T_MELT = 0;
export const T_BOIL = 100;

export const initialState = () => ({
  mass: 0.5, // kg
  tStart: -20, // °C, initial temperature of the ice
  tEnd: 120, // °C, the run stops when the steam reaches this temperature
  power: 2000, // W, heater power, all of it absorbed by the sample
  time: 0, // s of heating
  stagesDone: 0, // number of stages already finished (0..5)
});

/** The five stages with their heat Q (J), duration Q/P (s) and start/end time and heat. */
export function stages(s) {
  const m = s.mass;
  const list = [
    { phase: "ice", Q: m * C_ICE * (T_MELT - s.tStart), from: s.tStart, to: T_MELT },
    { phase: "melt", Q: LAMBDA * m, from: T_MELT, to: T_MELT },
    { phase: "water", Q: m * C_WATER * (T_BOIL - T_MELT), from: T_MELT, to: T_BOIL },
    { phase: "boil", Q: L_VAP * m, from: T_BOIL, to: T_BOIL },
    { phase: "steam", Q: m * C_STEAM * (s.tEnd - T_BOIL), from: T_BOIL, to: s.tEnd },
  ];
  let t = 0;
  let q = 0;
  for (const st of list) {
    st.duration = st.Q / s.power;
    st.start = t;
    st.heatBefore = q;
    t += st.duration;
    q += st.Q;
    st.end = t;
    st.heatAfter = q;
  }
  return list;
}

export const totalHeat = s => stages(s).at(-1).heatAfter;
export const totalTime = s => stages(s).at(-1).end;

/**
 * Condition of the sample after `time` seconds of heating.
 * stage: index of the stage in progress (5 when finished); solid/liquid/gas: mass fractions.
 */
export function at(s, time = s.time) {
  const list = stages(s);
  const t = Math.min(Math.max(time, 0), list.at(-1).end);
  const heat = t * s.power;
  let stage = list.findIndex(st => t < st.end);
  if (stage < 0) stage = 5;
  if (stage === 5) return { stage, temperature: s.tEnd, solid: 0, liquid: 0, gas: 1, heat, fraction: 1 };
  const st = list[stage];
  const f = st.duration > 0 ? (t - st.start) / st.duration : 1;
  const temperature = st.from + (st.to - st.from) * f;
  const frac = [
    [1, 0, 0],
    [1 - f, f, 0],
    [0, 1, 0],
    [0, 1 - f, f],
    [0, 0, 1],
  ][stage];
  return { stage, temperature, solid: frac[0], liquid: frac[1], gas: frac[2], heat, fraction: f };
}

/**
 * Heat for dt more seconds. Returns the indices of the stages that ended during this step,
 * so each stage is reported exactly once.
 */
export function step(s, dt) {
  const list = stages(s);
  s.time = Math.min(Math.max(s.time + dt, 0), list.at(-1).end);
  s.stagesDone = Math.min(Math.max(Math.floor(s.stagesDone) || 0, 0), 5);
  const finished = [];
  while (s.stagesDone < 5 && s.time >= list[s.stagesDone].end) finished.push(s.stagesDone++);
  return finished;
}

/** Back to the start of the experiment, keeping the settings. */
export function restart(s) {
  s.time = 0;
  s.stagesDone = 0;
  return s;
}
