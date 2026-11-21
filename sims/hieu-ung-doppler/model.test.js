import test from "node:test";
import assert from "node:assert/strict";
import { SOUND, EMIT, initialState, restart, heardFrequency, mach, machAngle, fronts, step, side } from "./model.js";

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);
const make = over => ({ ...initialState(), ...over });

test("f′ = f·(v + v_N)/(v − v_S) with v_N, v_S positive towards each other", () => {
  // source at −150 to the left of the listener at 0
  close(heardFrequency(make({ sourceVelocity: 100 })), (500 * 340) / 240); // source approaching
  close(heardFrequency(make({ sourceVelocity: -100 })), (500 * 340) / 440); // source receding
  close(heardFrequency(make({ listenerVelocity: -40, sourceVelocity: 0 })), (500 * 380) / 340); // listener approaching (moves left)
  close(heardFrequency(make({ listenerVelocity: 40, sourceVelocity: 0 })), (500 * 300) / 340); // listener receding (no restart)
  close(heardFrequency(restart(make({ listenerVelocity: 40, sourceVelocity: 0 }))), (500 * 380) / 340); // restart puts S ahead of N
  close(heardFrequency(make({ listenerVelocity: -40, sourceVelocity: 100 })), (500 * 380) / 240);
  // the same physics mirrored: source on the right
  const mirrored = make({ sourceVelocity: -100, listenerVelocity: 40 });
  restart(mirrored);
  assert.equal(mirrored.sourceX, 150);
  close(heardFrequency(mirrored), (500 * 380) / 240);
});

test("zero speeds give f; approaching raises the pitch, receding lowers it", () => {
  close(heardFrequency(make({ sourceVelocity: 0, listenerVelocity: 0 })), 500);
  for (const u of [5, 50, 200, 330]) {
    assert.ok(heardFrequency(make({ sourceVelocity: u })) > 500);
    assert.ok(heardFrequency(make({ sourceVelocity: -u })) < 500);
  }
  for (const u of [5, 50, 100]) {
    assert.ok(heardFrequency(make({ sourceVelocity: 0, listenerVelocity: -u })) > 500);
    assert.ok(heardFrequency(make({ sourceVelocity: 0, listenerVelocity: u })) < 500);
  }
  // before and after the source passes: the same speed gives a higher, then a lower pitch
  const s = make({ sourceVelocity: 170 });
  close(heardFrequency(s, 1), 1000);
  close(heardFrequency(s, -1), 500 * (340 / 510));
});

test("a source at or above the speed of sound is not heard before it arrives", () => {
  assert.equal(heardFrequency(make({ sourceVelocity: 340 })), 0);
  assert.equal(heardFrequency(make({ sourceVelocity: 500 })), 0);
  close(heardFrequency(make({ sourceVelocity: 500 }), -1), (500 * 340) / 840);
});

test("wavefront centres lie on the source's path, where the source was at emission", () => {
  const s = make({ sourceVelocity: 120, listenerVelocity: 30 });
  const path = []; // [time, x]
  for (let i = 0; i < 300; i++) {
    path.push([s.time, s.sourceX]);
    step(s, 1 / 120);
  }
  for (const f of fronts(s)) {
    assert.equal(f.y, 0);
    close(f.r, SOUND * f.age, 1e-9);
    const t = s.time - f.age;
    if (t < 0) continue; // emitted before the run: the motion had been going on already
    close(f.x, -150 + 120 * t, 1e-6);
    const [, xs] = path.reduce((best, p) => (Math.abs(p[0] - t) < Math.abs(best[0] - t) ? p : best));
    assert.ok(Math.abs(f.x - xs) <= 120 / 240 + 1e-9);
  }
  // consecutive fronts are EMIT apart in age
  const ages = fronts(s).map(f => f.age);
  for (let i = 1; i < ages.length; i++) close(ages[i] - ages[i - 1], EMIT, 1e-9);
});

test("fronts bunch up ahead of a moving source: spacing (v − v_S)·Δt ahead, (v + v_S)·Δt behind", () => {
  const s = make({ sourceVelocity: 100 });
  const list = fronts(s);
  for (let i = 1; i < list.length; i++) {
    const ahead = list[i].x + list[i].r - (list[i - 1].x + list[i - 1].r);
    const behind = list[i].x - list[i].r - (list[i - 1].x - list[i - 1].r);
    close(ahead, (SOUND - 100) * EMIT, 1e-9);
    close(behind, -(SOUND + 100) * EMIT, 1e-9);
  }
});

test("counting the fronts that reach a moving listener gives the formula", () => {
  for (const [sourceX, sourceVelocity, listenerVelocity] of [[-400, 50, 0], [-450, 40, -20], [50, 50, 0], [-60, -40, 25], [-500, 0, -50]]) {
    const s = { ...make({ sourceVelocity, listenerVelocity }), sourceX, listenerX: 0, time: 0 };
    const dir = side(s);
    const reached = new Set();
    const count = () => {
      for (const f of fronts(s)) if (f.r >= Math.abs(s.listenerX - f.x)) reached.add(Math.round((s.time - f.age) / EMIT));
      return reached.size;
    };
    const first = count();
    const seconds = 6; // every front that arrives meanwhile is younger than the oldest one listed
    for (let i = 0; i < seconds * 120; i++) {
      step(s, 1 / 120);
      count();
    }
    assert.equal(side(s), dir, "the run must not pass");
    const rate = (reached.size - first) / seconds; // fronts per second at the listener
    const predicted = heardFrequency(s) / s.frequency / EMIT; // the drawn fronts are f·EMIT periods apart
    assert.ok(Math.abs(rate - predicted) / predicted < 0.015, `${sourceVelocity}, ${listenerVelocity}: ${rate} vs ${predicted}`);
  }
});

test("step reports the moment the source passes the listener", () => {
  const s = make({ sourceVelocity: 100 });
  let passes = 0;
  let at = 0;
  for (let i = 0; i < 3 * 120; i++) if (step(s, 1 / 120)) (passes++, (at = s.time));
  assert.equal(passes, 1);
  assert.ok(Math.abs(at - 1.5) < 1 / 120 + 1e-9);
});

test("Mach cone: sin θ = v/v_S, and every front touches the cone", () => {
  assert.equal(machAngle(make({ sourceVelocity: 300 })), null);
  for (const u of [400, 510, 680, -680]) {
    const s = make({ sourceVelocity: u });
    close(mach(s), Math.abs(u) / SOUND);
    const theta = machAngle(s);
    close(Math.sin(theta), SOUND / Math.abs(u));
    // cone edge through the source: points (x, y) with (x_S − x)·sgn(u)·sin θ = |y|·cos θ
    // distance from a front's centre to that line equals its radius (tangent)
    const sg = Math.sign(u);
    for (const f of fronts(s)) {
      const dist = Math.abs((s.sourceX - f.x) * sg * Math.sin(theta) - 0 * Math.cos(theta));
      close(dist, f.r, 1e-6);
    }
  }
});
