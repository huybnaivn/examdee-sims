import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState, linearDensity, stringFrequency, stringWaveSpeed, pipeFrequency, harmonicNumber, frequency, wavelength,
  modeShape, noteFrequency, centsFrom, nearestNote, noteName, inTune, TARGETS, TOLERANCE, SOUND_SPEED,
} from "./model.js";

const near = (a, b, rel = 1e-9) => assert.ok(Math.abs(a - b) <= rel * Math.abs(b), `${a} ≠ ${b}`);

test("string: f = (1/2L)·√(T/μ) with μ = ρπd²/4", () => {
  near(linearDensity(0.5), 7850 * Math.PI * 0.00025 ** 2);
  near(linearDensity(1) / linearDensity(0.5), 4); // twice as thick, four times as heavy
  const mu = 0.001;
  near(stringFrequency(0.5, 90, mu), 300); // √(90/0.001) = 300 m/s, λ = 1 m
  const s = { ...initialState(), length: 0.65, tension: 100, diameter: 0.5 };
  near(frequency(s), (1 / (2 * 0.65)) * Math.sqrt(100 / linearDensity(0.5)));
  near(frequency(s) * wavelength(s), stringWaveSpeed(100, linearDensity(0.5))); // v = λf
});

test("string: half the length is an octave up; four times the tension too; twice the diameter an octave down", () => {
  const s = initialState();
  const f = frequency(s);
  near(frequency({ ...s, length: s.length / 2 }), 2 * f);
  near(frequency({ ...s, tension: s.tension * 4 }), 2 * f);
  near(frequency({ ...s, diameter: s.diameter * 2 }), f / 2);
  near(centsFrom(2 * f, nearestNote(f).index), 1200 + nearestNote(f).cents, 1e-9);
  for (const k of [2, 3, 4]) near(frequency(s, k), k * f); // all harmonics
});

test("pipes: open v/(2L), closed v/(4L) with odd harmonics only", () => {
  near(pipeFrequency(0.5, false), SOUND_SPEED / 1);
  near(pipeFrequency(0.5, true), SOUND_SPEED / 2);
  const open = { ...initialState(), instrument: "open", pipeLength: 0.85 };
  const closed = { ...open, instrument: "closed" };
  near(frequency(open), 200);
  near(frequency(closed), 100); // an octave below the open pipe of the same length
  assert.deepEqual([1, 2, 3, 4].map(k => Math.round(frequency(open, k))), [200, 400, 600, 800]);
  assert.deepEqual([1, 2, 3, 4].map(k => Math.round(frequency(closed, k))), [100, 300, 500, 700]);
  assert.deepEqual([1, 2, 3, 4].map(k => harmonicNumber("closed", k)), [1, 3, 5, 7]);
  assert.deepEqual([1, 2, 3].map(k => harmonicNumber("open", k)), [1, 2, 3]);
  for (const s of [open, closed]) for (const k of [1, 2, 3]) near(frequency(s, k) * wavelength(s, k), SOUND_SPEED);
  near(frequency({ ...open, pipeLength: 0.425 }), 400); // half the length, an octave up
});

test("standing-wave shapes: nodes and antinodes at the right ends", () => {
  const zero = v => assert.ok(Math.abs(v) < 1e-12);
  const one = v => assert.ok(Math.abs(Math.abs(v) - 1) < 1e-12);
  for (const k of [1, 2, 3, 4]) {
    zero(modeShape("string", k, 0));
    zero(modeShape("string", k, 1));
    one(modeShape("open", k, 0));
    one(modeShape("open", k, 1));
    zero(modeShape("closed", k, 0));
    one(modeShape("closed", k, 1));
  }
  zero(modeShape("string", 2, 0.5)); // second harmonic has a node in the middle
  zero(modeShape("open", 1, 0.5));
});

test("nearest equal-tempered note, A4 = 440 Hz", () => {
  assert.deepEqual(nearestNote(440), { index: 69, cents: 0 });
  assert.equal(nearestNote(261.63).index, 60);
  assert.equal(noteName(69), "La4 (A4)");
  assert.equal(noteName(60), "Đô4 (C4)");
  assert.equal(noteName(61), "Đô♯4 (C♯4)");
  near(noteFrequency(57), 220);
  near(noteFrequency(81), 880);
  near(noteFrequency(60), 261.6256, 1e-6);
  near(centsFrom(noteFrequency(70), 69), 100);
  const up = nearestNote(440 * 2 ** (30 / 1200)); // 30 cents sharp
  assert.equal(up.index, 69);
  near(up.cents, 30, 1e-9);
  assert.equal(nearestNote(440 * 2 ** (70 / 1200)).index, 70); // closer to La♯4
  for (let f = 30; f < 3000; f *= 1.013) assert.ok(Math.abs(nearestNote(f).cents) <= 50);
});

test("tuning goal: only within the tolerance, and every target can be reached on the control grid", () => {
  const s = { ...initialState(), instrument: "open", target: 69, pipeLength: 0.386 };
  assert.ok(inTune(s));
  assert.ok(!inTune({ ...s, pipeLength: 0.39 }));
  assert.ok(!inTune({ ...s, target: 0 }));
  assert.ok(!inTune({ ...s, target: 68 })); // not a listed target (forged state)
  assert.ok(!inTune(initialState())); // the starting picture is a task, not a solved one
  for (const target of TARGETS) {
    const f = noteFrequency(target);
    for (const [instrument, L] of [["open", SOUND_SPEED / (2 * f)], ["closed", SOUND_SPEED / (4 * f)]]) {
      const pipeLength = Math.round(L * 1000) / 1000; // slider step 1 mm
      assert.ok(pipeLength >= 0.1 && pipeLength <= 1.5);
      assert.ok(Math.abs(centsFrom(frequency({ ...s, instrument, pipeLength }), target)) <= TOLERANCE, `${instrument} ${target}`);
    }
    // string: pick a length on the 5 mm grid that needs about 100 N, then fine-tune the tension (step 0.1 N)
    const base = initialState();
    const mu = linearDensity(base.diameter);
    const length = Math.round(Math.sqrt(100 / mu) / (2 * f) / 0.005) * 0.005;
    const tension = Math.round(mu * (2 * length * f) ** 2 * 10) / 10;
    assert.ok(length >= 0.2 && length <= 1 && tension >= 20 && tension <= 200, `L ${length} T ${tension}`);
    assert.ok(inTune({ ...base, target, length, tension }));
  }
});
