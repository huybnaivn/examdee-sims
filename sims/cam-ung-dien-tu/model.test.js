import test from "node:test";
import assert from "node:assert/strict";
import { initialState, restState, step, flux, launch, peakEmfAt, fluxTrend, RADIUS, XMAX, FAR } from "./model.js";

const DT = 1 / 120;
const near = (a, b, rel = 1e-9) => assert.ok(Math.abs(a - b) <= rel * Math.max(Math.abs(a), Math.abs(b), 1e-12), `${a} ≠ ${b}`);
const still = over => ({ ...restState(), auto: false, ...over });
/** Run one automatic pass from the left; returns { s, peak (signed emf of largest size), integral of e dt, first lobe sign }. */
const pass = over => {
  const s = { ...restState(), ...over };
  let integral = 0;
  let peak = 0;
  let first = 0;
  while (s.auto) {
    step(s, DT);
    integral += s.emf * DT;
    if (Math.abs(s.emf) > Math.abs(peak)) peak = s.emf;
    if (!first && Math.abs(s.emf) > 1e-3) first = Math.sign(s.emf);
  }
  return { s, peak, integral, first };
};

test("flux model: Φ₀ at the centre, symmetric, falls off with distance, sign follows the poles", () => {
  const s = still({ strength: 1.5 });
  near(flux(s, 0), 1.5e-3);
  near(flux(s, 5), flux(s, -5));
  near(flux(s, RADIUS), 1.5e-3 / 2 ** 1.5);
  assert.ok(flux(s, 2) > flux(s, 4) && flux(s, 4) > flux(s, 12) && flux(s, 12) > 0);
  near(flux({ ...s, flipped: true }, 3), -flux(s, 3));
});

test("emf is zero when the magnet is at rest, wherever it is", () => {
  for (const x of [-XMAX, -2, 0, 3]) {
    const s = still({ x, pos: x });
    for (let i = 0; i < 240; i++) step(s, DT);
    assert.equal(s.emf, 0);
    assert.equal(s.v, 0);
    assert.equal(fluxTrend(s), 0);
  }
  // changing N, the strength or the poles of a resting magnet induces nothing in this model
  const s = step(still({ x: 1, pos: 1, turns: 500, strength: 2, flipped: true }), DT);
  assert.equal(s.emf, 0);
});

test("e = −N·ΔΦ/Δt over one step", () => {
  const s = still({ x: 0, pos: -3 });
  const before = flux(s);
  step(s, DT);
  near(s.emf, (-s.turns * (flux(s) - before)) / DT);
  assert.ok(s.emf < 0); // N pole approaching from the left: flux to the right grows, e < 0
  assert.equal(fluxTrend(s), 1);
});

test("emf sign flips when the direction of motion flips", () => {
  const toward = step(still({ pos: -3, x: -2 }), DT);
  const away = step(still({ pos: -3, x: -4 }), DT);
  assert.ok(toward.emf < 0 && away.emf > 0);
  // same magnet, same place, on the other side: leaving to the right is also e > 0
  assert.ok(step(still({ pos: 3, x: 4 }), DT).emf > 0);
  // a whole pass the other way round mirrors the emf
  const right = pass();
  const left = pass({ pos: XMAX, x: XMAX, side: 1, autoTo: -XMAX });
  assert.equal(right.first, -1);
  assert.equal(left.first, -1); // approaching is approaching from either side
  near(Math.abs(right.peak), Math.abs(left.peak), 1e-9);
});

test("emf sign flips when the poles flip", () => {
  const n = step(still({ pos: -3, x: -2 }), DT);
  const sPole = step(still({ pos: -3, x: -2, flipped: true }), DT);
  near(sPole.emf, -n.emf);
  assert.equal(pass({ flipped: true }).first, 1);
  assert.equal(fluxTrend(sPole), 1); // flux magnitude still grows on approach
});

test("emf is proportional to N and to the magnet strength", () => {
  const base = pass({ turns: 100 });
  near(pass({ turns: 300 }).peak, 3 * base.peak);
  near(pass({ turns: 100, strength: 2 }).peak, 2 * base.peak);
});

test("emf is proportional to speed, and the peak matches the model's maximum slope", () => {
  const slow = pass({ speed: 10 });
  const fast = pass({ speed: 40 });
  // ΔΦ/Δt over a finite step averages the slope, so allow 1 %
  near(Math.abs(fast.peak) / Math.abs(slow.peak), 4, 1e-2);
  near(Math.abs(slow.peak), peakEmfAt(slow.s, 10), 1e-2);
  near(peakEmfAt(restState(), 20), (200 * 1e-3 * (0.2 / 0.04) * 1.5) / 1.25 ** 2.5); // ≈ 0,859 V
});

test("the time integral of emf equals −N·ΔΦ", () => {
  // a full pass: flux returns to its starting value, so the integral vanishes
  const full = pass();
  assert.ok(Math.abs(full.integral) < 1e-12);
  // from far left to the centre, by hand (lagging, speed-limited motion), then left to settle
  const s = still({ x: 0 });
  const phi0 = flux(s);
  let integral = 0;
  for (let i = 0; i < 600; i++) integral += step(s, DT).emf * DT;
  assert.equal(s.pos, 0);
  near(integral, -s.turns * (flux(s) - phi0), 1e-9);
  near(integral, -200 * (1e-3 - phi0), 1e-9);
  // independent of how fast it got there
  const quick = { ...restState(), autoTo: 0, speed: 60 };
  let other = 0;
  while (quick.auto) other += step(quick, DT).emf * DT;
  near(other, integral, 1e-9);
});

test("one result per completed pass, with its peak emf and speed", () => {
  const { s, peak } = pass({ speed: 30 });
  assert.equal(s.passes, 1);
  assert.equal(s.side, 1);
  near(s.lastPeakEmf, Math.abs(peak));
  near(s.lastPeakSpeed, 30, 1e-9);
  assert.equal(s.pos, XMAX);
  // going in and coming back out on the same side is not a pass
  const back = still({ x: 0 });
  for (let i = 0; i < 300; i++) step(back, DT);
  back.x = -XMAX;
  for (let i = 0; i < 300; i++) step(back, DT);
  assert.equal(back.passes, 0);
  assert.ok(Math.abs(back.pos) >= FAR && back.peakEmf === 0);
  // launch sends it to the other side
  assert.equal(launch(s).autoTo, -XMAX);
  while (s.auto) step(s, DT);
  assert.equal(s.passes, 2);
});

test("the opening state is the first pass under way, at the positive peak of e", () => {
  const s = initialState();
  assert.ok(s.auto && s.passes === 0 && s.autoTo === XMAX);
  near(s.pos, RADIUS / 2, 0.05);
  near(s.time, (XMAX + s.pos) / s.speed, 1e-6);
  assert.ok(s.emf > 0 && fluxTrend(s) === -1); // leaving the centre: flux falls, e > 0
  near(s.emf, peakEmfAt(s), 1e-2);
  near(s.peakEmf, peakEmfAt(s), 1e-2); // the negative lobe on the way in was just as large
});
