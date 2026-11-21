import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState, step, start, skipTransient, naturalFrequency, steadyAmplitude, resonanceFrequency, envelope, sanitizePoints,
} from "./model.js";

const DT = 1 / 120;
const make = over => start({ ...initialState(), ...over });
// Run until the steady state is recognised; returns the time it took.
const untilSteady = (s, limit = 300) => {
  for (let t = 0; t < limit; t += DT) if (step(s, DT) === "steady") return t;
  return Infinity;
};
const close = (a, b, rel, msg) => assert.ok(Math.abs(a - b) <= rel * Math.abs(b), `${msg}: ${a} vs ${b}`);

test("free damped oscillation: extremes sit on the envelope A₀·e^(−bt/2m)", () => {
  for (const [mass, damping] of [[0.5, 0.4], [1, 1], [0.2, 0.1]]) {
    const s = make({ mode: "free", mass, damping, amp0: 10 });
    let checked = 0;
    for (let i = 0; i < 20 / DT; i++) {
      const v0 = s.v;
      step(s, DT);
      if (v0 * s.v < 0 && Math.abs(s.x) > 0.005) {
        // turning point: compare |x| with the envelope at this time
        close(Math.abs(s.x), envelope(s, s.time), 0.01, `m=${mass} b=${damping} t=${s.time}`);
        checked++;
      }
    }
    assert.ok(checked >= 4);
  }
});

test("maintained oscillation keeps its amplitude and swings at ω₀ despite friction", () => {
  const s = make({ mode: "maintained", damping: 0.4, amp0: 8 });
  for (let i = 0; i < 30 / DT; i++) step(s, DT);
  let peak = 0;
  for (let i = 0; i < 3 / DT; i++) peak = Math.max(peak, Math.abs((step(s, DT), s.x)));
  close(peak, 0.08, 0.002, "amplitude");
  close(s.measuredPeriod, (2 * Math.PI) / naturalFrequency(s), 0.005, "period");
  const free = make({ mode: "free", damping: 0.4, amp0: 8 });
  for (let i = 0; i < 30 / DT; i++) step(free, DT);
  assert.ok(Math.abs(free.x) <= envelope(free, free.time) + 1e-9 && Math.abs(free.x) < 0.001); // without the source it dies out
});

test("steady-state amplitude matches F₀/√((k − mΩ²)² + (bΩ)²)", () => {
  for (const drive of [2, 5, 6.3, 8, 12]) {
    const s = make({ drive });
    untilSteady(s);
    assert.ok(s.amplitude > 0, `no steady state at Ω=${drive}`);
    close(s.amplitude, steadyAmplitude(s), 0.01, `Ω=${drive}`);
  }
});

test("steady state oscillates at the drive frequency, not at ω₀", () => {
  for (const drive of [3, 9]) {
    const s = make({ drive });
    untilSteady(s);
    for (let i = 0; i < 3 / DT; i++) step(s, DT);
    close(s.measuredPeriod, (2 * Math.PI) / drive, 0.01, `Ω=${drive}`);
    assert.ok(Math.abs(s.measuredPeriod - (2 * Math.PI) / naturalFrequency(s)) > 0.1);
  }
});

test("skipping the transient lands on the same steady state", () => {
  const s = make({ drive: 7, damping: 0.1 });
  for (let i = 0; i < 1 / DT; i++) step(s, DT);
  skipTransient(s);
  assert.ok(untilSteady(s) < 5);
  close(s.amplitude, steadyAmplitude(s), 0.01, "after skip");
});

test("the resonance peak is near ω₀ and sharper with less damping", () => {
  const width = damping => {
    const s = { ...initialState(), damping };
    const top = steadyAmplitude(s, resonanceFrequency(s));
    const ws = Array.from({ length: 4000 }, (_, i) => 0.005 * (i + 1));
    const above = ws.filter(w => steadyAmplitude(s, w) >= top / Math.SQRT2);
    return { s, top, peak: ws.reduce((a, w) => (steadyAmplitude(s, w) > steadyAmplitude(s, a) ? w : a)), width: above.at(-1) - above[0] };
  };
  const weak = width(0.1);
  const strong = width(0.8);
  close(weak.peak, naturalFrequency(weak.s), 0.01, "peak at ω₀");
  close(weak.peak, resonanceFrequency(weak.s), 0.002, "peak at √(ω₀² − b²/2m²)");
  assert.ok(weak.top > 5 * strong.top);
  assert.ok(weak.width < strong.width / 5);
  close(weak.width, 0.1 / 0.5, 0.05, "half-power width ≈ b/m");
  // and the simulation itself shows a bigger amplitude at ω₀ than off it
  const at = drive => (untilSteady(make({ drive })), steadyAmplitude(make({ drive })));
  assert.ok(at(6.3) > at(4) && at(6.3) > at(9));
});

test("forged points are dropped", () => {
  assert.deepEqual(sanitizePoints([{ w: 5, A: 0.1 }, { w: -1, A: 1 }, { w: 2, A: NaN }, null, "x"]), [{ w: 5, A: 0.1 }]);
  assert.deepEqual(sanitizePoints("nope"), []);
});
