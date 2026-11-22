// Blood-glucose homeostasis over one day: a minimal negative-feedback model for teaching.
// It is NOT a clinical model. Glucose G is in mmol/L; insulin and glucagon are in relative units;
// liver glycogen is counted in the mmol/L of blood glucose it could release. Time is in minutes,
// the day runs from 06:00 (t = 0) to 06:00 the next morning (t = 1440).
//
// Each minute:
//   emptied  = KS · stomach, absorbed = KA · gut     a meal passes stomach → gut → blood
//   insulin  → secretion · max(0, G − SET)      β cells answer high glucose   (lag TAU)
//   glucagon → max(0, SET − G)                  α cells answer low glucose    (lag TAU)
//   uptake   = KI · sensitivity · insulin · G/SET     cells take glucose in; half is stored as liver glycogen
//   release  = KG · glucagon                    liver breaks glycogen down (half rate from other sources when empty)
//   basal    = U0                               brain and tissues use glucose all the time
//   exercise = KEX · level · G/SET              working muscle takes glucose without insulin
//   renal    = KR · max(0, G − RENAL)           above the kidney threshold glucose is lost in urine
//   dG = absorbed + release − uptake − basal − exercise − renal

export const SET = 5; // mmol/L, set point
export const RANGE = [3.9, 7.8]; // mmol/L, band used for "in range" (fasting values are normally 3.9–6.4)
export const RENAL = 10; // mmol/L, kidney threshold
export const DAY = 1440; // min
export const START_HOUR = 6;
export const GLYCOGEN_MAX = 40; // mmol/L equivalents, about 100 g of liver glycogen
const KS = 1 / 30; // 1/min, stomach emptying
const KA = 1 / 30; // 1/min, absorption from the gut
const TAU = 10; // min, lag of both hormones
const KI = 0.15; // insulin-driven uptake per unit of insulin
const KG = 0.1; // glycogen breakdown per unit of glucagon
const U0 = 0.012; // mmol/L per min, insulin-independent use (mostly the brain)
const KEX = 0.03; // per exercise level
const KR = 0.02; // 1/min, loss in urine above the kidney threshold
const VOLUME = 15; // L in which absorbed glucose spreads
/** Rise in blood glucose (mmol/L) if `carbs` grams of glucose entered the blood with no uptake at all. */
export const mealLoad = carbs => carbs / 0.18 / VOLUME;

// secretion: how strongly β cells answer (1 = healthy); sensitivity: how well cells answer insulin (1 = healthy)
export const CONDITIONS = {
  healthy: { code: 0, secretion: 1, sensitivity: 1 },
  type1: { code: 1, secretion: 0.003, sensitivity: 1 },
  type2: { code: 2, secretion: 1, sensitivity: 0.25 },
};

export const LIMITS = { carbs: [10, 120], minutes: [10, 90], level: [1, 3], events: 8 };
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * The schedule is one string so that the state stays flat: "m,60,60;x,660,30,2"
 * = a 60 g meal at t = 60 min, 30 min of exercise of level 2 at t = 660 min.
 * Anything malformed is dropped, numbers are clamped, at most LIMITS.events entries are kept.
 */
export function parseEvents(text) {
  const out = [];
  for (const part of String(text ?? "").split(";")) {
    const [kind, ...raw] = part.split(",");
    const n = raw.map(Number);
    if (!n.every(Number.isFinite) || !Number.isFinite(n[0]) || n[1] === undefined) continue;
    const t = clamp(Math.round(n[0]), 0, DAY - 1);
    if (kind === "m") out.push({ kind, t, carbs: clamp(n[1], ...LIMITS.carbs) });
    else if (kind === "x") out.push({ kind, t, minutes: clamp(n[1], ...LIMITS.minutes), level: clamp(Math.round(n[2] ?? 2), ...LIMITS.level) });
    if (out.length === LIMITS.events) break;
  }
  return out.sort((a, b) => a.t - b.t);
}
export const formatEvents = list => list.map(e => (e.kind === "m" ? `m,${e.t},${e.carbs}` : `x,${e.t},${e.minutes},${e.level}`)).join(";");
export const addEvent = (text, event) => formatEvents(parseEvents(`${formatEvents(parseEvents(text).slice(0, LIMITS.events - 1))};${formatEvents([event])}`));
export const removeLast = text => formatEvents(parseEvents(text).slice(0, -1)); // the latest in the day

/** Target hormone levels for a glucose value: the two halves of the negative feedback. */
export const insulinTarget = (G, secretion = 1) => secretion * Math.max(0, G - SET);
export const glucagonTarget = G => Math.max(0, SET - G);

/**
 * Simulate the whole day minute by minute. Returns arrays with DAY + 1 samples and a summary.
 * `params` is { secretion, sensitivity }.
 */
export function simulate(events, params) {
  const list = typeof events === "string" ? parseEvents(events) : events;
  const secretion = clamp(params?.secretion ?? 1, 0, 2);
  const sensitivity = clamp(params?.sensitivity ?? 1, 0, 2);
  let G = SET;
  let I = 0;
  let N = 0;
  let stomach = 0;
  let gut = 0;
  let gly = GLYCOGEN_MAX * 0.4; // after the night's fast
  const out = { G: [G], insulin: [I], glucagon: [N], glycogen: [gly] };
  for (let t = 0; t < DAY; t++) {
    let level = 0;
    for (const e of list) {
      if (e.kind === "m" && e.t === t) stomach += mealLoad(e.carbs);
      if (e.kind === "x" && t >= e.t && t < e.t + e.minutes) level = Math.max(level, e.level);
    }
    const absorbed = KA * gut;
    const uptake = KI * sensitivity * I * (G / SET);
    const release = KG * N * (gly > 0 ? 1 : 0.5);
    const basal = U0 * Math.min(1, G / 2);
    const exercise = KEX * level * (G / SET);
    const renal = KR * Math.max(0, G - RENAL);
    const emptied = KS * stomach;
    stomach -= emptied;
    gut += emptied - absorbed;
    I += (insulinTarget(G, secretion) - I) / TAU;
    N += (glucagonTarget(G) - N) / TAU;
    gly = clamp(gly + 0.5 * uptake - (gly > 0 ? release : 0), 0, GLYCOGEN_MAX);
    G = Math.max(0, G + absorbed + release - uptake - basal - exercise - renal);
    out.G.push(G);
    out.insulin.push(I);
    out.glucagon.push(N);
    out.glycogen.push(gly);
  }
  const peak = Math.max(...out.G);
  const low = Math.min(...out.G);
  const above = out.G.filter(g => g > RANGE[1]).length; // minutes, one sample per minute
  const below = out.G.filter(g => g < RANGE[0]).length;
  const meals = list.filter(e => e.kind === "m");
  const carbs = meals.reduce((sum, e) => sum + e.carbs, 0);
  return { ...out, peak, low, above, below, meals: meals.length, carbs, exercises: list.length - meals.length, inRange: above === 0 && below === 0 };
}

export const GOAL = { meals: 3, carbs: 150 }; // a day only counts as "kept in range" with real meals in it
export const goalReached = day => day.inRange && day.meals >= GOAL.meals && day.carbs >= GOAL.carbs;

export const conditionOf = s => CONDITIONS[s.condition] ?? CONDITIONS.healthy;

/** "13:30" for t minutes after 06:00. */
export const clock = t => {
  const m = (((START_HOUR * 60 + Math.round(t)) % DAY) + DAY) % DAY;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

export const initialState = () => ({
  condition: "healthy",
  events: "m,60,60;m,360,80;x,660,30,2;m,780,70", // 07:00, 12:00, exercise 17:00, 19:00
  time: 405, // min after 06:00: where the cursor is, and where a new event goes (12:45)
  carbs: 60, // g of carbohydrate in the next meal
  minutes: 30, // length of the next exercise
  level: 2, // 1 light, 2 moderate, 3 hard
  compare: true, // also draw the healthy response when a diabetic condition is chosen
});
