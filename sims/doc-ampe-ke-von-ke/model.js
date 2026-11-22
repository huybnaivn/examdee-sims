// Reading an analog ammeter / voltmeter with two ranges, in a one-bulb circuit.
// Volts, ohms, amperes. Every range has 30 divisions, as on school meters.

export const DIVISIONS = 30;
export const HALF_SPAN = 50; // degrees: the scale runs from −50° (zero) to +50° (full scale) about the vertical
export const R_SHORT = 0.2; // Ω, source + ammeter when the ammeter wrongly bypasses the bulb

export const METERS = {
  ammeter: { unit: "A", milli: "mA", symbol: "A", ranges: [0.6, 3] },
  voltmeter: { unit: "V", milli: "mV", symbol: "V", ranges: [3, 15] },
};

export const initialState = () => ({
  mode: "explore", // "explore" | "practice"
  meter: "ammeter", // "ammeter" | "voltmeter"
  ampRange: 3, // A, full-scale value (GHĐ) of the chosen ammeter range
  voltRange: 15, // V
  wiring: "correct", // "correct" | "reversed" (poles swapped) | "wrong" (ammeter in parallel / voltmeter in series)
  voltage: 6, // V, source
  resistance: 25, // Ω, bulb
  showDigital: true,
  answer: 0, // practice: the learner's reading, in divisions
  feedback: "", // practice: "" | "correct" | "wrong" | "range" | "overload" | "wiring"
});

const kind = s => (s.meter === "voltmeter" ? "voltmeter" : "ammeter");
export const meterOf = s => METERS[kind(s)];

/** Full-scale value (GHĐ) of the selected range; a forged value falls back to the largest range. */
export function rangeOf(s) {
  const { ranges } = meterOf(s);
  const r = kind(s) === "voltmeter" ? s.voltRange : s.ampRange;
  return ranges.includes(r) ? r : ranges.at(-1);
}

/** Smallest division (ĐCNN) of a range. */
export const smallestDivision = range => range / DIVISIONS;

/** Current through the bulb in a correctly wired circuit, I = U / R. */
export const current = s => s.voltage / s.resistance;

/** True signed value at the meter's terminals, in A or V. */
export function meterValue(s) {
  const amp = kind(s) === "ammeter";
  if (s.wiring === "wrong") return amp ? s.voltage / R_SHORT : s.voltage; // short circuit / voltmeter in series shows ≈ U
  const v = amp ? current(s) : s.voltage;
  return s.wiring === "reversed" ? -v : v;
}

/** Current through the bulb (A): none when it is bypassed or in series with a voltmeter. */
export const bulbCurrent = s => (s.wiring === "wrong" ? 0 : current(s));

export const overloaded = (value, range) => value > range * (1 + 1e-9);

/** Needle position as a fraction of full scale; mechanical stops just outside the scale. */
export const needleFraction = (value, range) => Math.min(1.06, Math.max(-0.05, value / range));

/** Needle angle in degrees from the vertical, positive clockwise. */
export const needleAngle = (value, range) => -HALF_SPAN + 2 * HALF_SPAN * needleFraction(value, range);

/** Reading snapped to the nearest division of the range. */
export function snapReading(value, range) {
  const d = smallestDivision(range);
  return Number((Math.round(value / d + 1e-9) * d).toFixed(6));
}

/** Smallest range that still contains the value, or null when every range is too small. */
export const bestRange = (value, ranges) => [...ranges].sort((a, b) => a - b).find(r => !overloaded(value, r)) ?? null;

export const toMilli = x => x * 1000; // A → mA, V → mV
export const fromMilli = x => x / 1000; // mA → A, mV → V

/** What the meter shows now. `reading` is null when the needle is off the scale. */
export function measure(s) {
  const value = meterValue(s);
  const range = rangeOf(s);
  const overload = overloaded(value, range);
  const reversed = value < 0;
  return {
    value,
    range,
    division: smallestDivision(range),
    overload,
    reversed,
    reading: overload || reversed ? null : snapReading(value, range),
    best: bestRange(Math.abs(value), meterOf(s).ranges),
    angle: needleAngle(value, range),
  };
}

/** Judge the learner's reading (`answer` divisions on the selected range). */
export function checkAnswer(s) {
  const m = measure(s);
  if (s.wiring !== "correct") return "wiring";
  if (m.overload) return "overload";
  if (Math.abs(s.answer - m.value / m.division) > 0.5 + 1e-6) return "wrong";
  return m.range === m.best ? "correct" : "range";
}

/** A new practice circuit; `rand` returns numbers in [0, 1). Half the voltmeter tasks suit the small range. */
export function newTask(s, rand = Math.random) {
  const pick = (lo, hi, step) => lo + step * Math.floor(rand() * ((hi - lo) / step + 1));
  s.voltage = kind(s) === "voltmeter" && rand() < 0.5 ? pick(1, 3, 0.5) : pick(1, 12, 0.5);
  s.resistance = pick(4, 50, 1);
  s.answer = 0;
  s.feedback = "";
  return s;
}
