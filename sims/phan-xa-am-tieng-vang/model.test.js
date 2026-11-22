import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState, echoDelay, echoHeard, minEchoDistance, reflectedAmplitude, seaDepth, depthFromDelay, sonarDelay,
  answerOk, delayOf, emitPulse, advance, distanceOf, V_AIR, V_SEA, ECHO_GAP,
} from "./model.js";

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

test("echo delay is t = 2d/v", () => {
  close(echoDelay(17), 0.1);
  close(echoDelay(34), 0.2);
  close(echoDelay(170, 340), 1);
  close(delayOf({ ...initialState(), distance: 25.5 }), (2 * 25.5) / V_AIR);
});

test("an echo is heard only when t ≥ 1/15 s, i.e. d ≥ about 11,3 m in air", () => {
  close(minEchoDistance(), 340 / 30);
  assert.ok(Math.abs(minEchoDistance() - 11.33) < 0.01);
  assert.equal(echoHeard(echoDelay(11.4)), true);
  assert.equal(echoHeard(echoDelay(11.2)), false);
  assert.equal(echoHeard(echoDelay(minEchoDistance())), true);
  assert.equal(echoHeard(ECHO_GAP / 2), false);
});

test("sonar depth is h = v·t/2 with v = 1500 m/s", () => {
  close(depthFromDelay(2), 1500);
  close(depthFromDelay(sonarDelay(1234)), 1234);
  for (const seed of [1, 2, 3, 77, 1000]) {
    const h = seaDepth(seed);
    assert.ok(h >= 200 && h <= 4000 && h % 5 === 0);
    const t = delayOf({ ...initialState(), scene: "sonar", seed });
    close(t, (2 * h) / V_SEA);
    assert.ok(answerOk(depthFromDelay(t), h));
    assert.ok(!answerOk(h * 1.05, h));
  }
  assert.notEqual(seaDepth(1), seaDepth(2));
});

test("absorbing surfaces send back less sound", () => {
  const a = s => reflectedAmplitude({ ...initialState(), surface: s });
  assert.ok(a("concrete") > a("wood") && a("wood") > a("curtain"));
  assert.ok(a("curtain") < 0.3 && a("concrete") > 0.9);
  assert.equal(a("nonsense"), a("concrete"));
});

test("the pulse reports its return once, after 2d/v", () => {
  const s = emitPulse({ ...initialState(), distance: 34 });
  const dt = 1 / 1200;
  let back = 0;
  let when = 0;
  for (let i = 0; i < 1200; i++) {
    if (advance(s, dt)) {
      back++;
      when = s.t;
    }
  }
  assert.equal(back, 1);
  close(when, 0.2, dt);
  assert.equal(s.flying, false);
});

test("forged distances are clamped", () => {
  assert.equal(distanceOf({ distance: -5 }), 2);
  assert.equal(distanceOf({ distance: 1e9 }), 40);
  assert.equal(distanceOf({ distance: NaN }), 17);
});
