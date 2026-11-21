import test from "node:test";
import assert from "node:assert/strict";
import { initialState, toRad, toDeg, normDeg, trig, quadrant, signs, isSpecial, exact, piFraction, snap } from "./model.js";

const near = (x, y, eps = 1e-12) => assert.ok(Math.abs(x - y) < eps, `${x} ≠ ${y}`);

// "−√3/2" -> -0.866…
const value = text => {
  const m = text.match(/^(−?)(√?)(\d+)(?:\/(\d+))?$/);
  assert.ok(m, `unreadable exact value ${text}`);
  const top = m[2] ? Math.sqrt(Number(m[3])) : Number(m[3]);
  return (m[1] ? -1 : 1) * (top / Number(m[4] ?? 1));
};

test("sin² + cos² = 1 at every whole degree", () => {
  for (let d = 0; d <= 360; d++) {
    const { sin, cos } = trig(d);
    near(sin * sin + cos * cos, 1);
  }
});

test("values at the special angles", () => {
  const r2 = Math.SQRT2 / 2;
  const r3 = Math.sqrt(3) / 2;
  const table = { 0: [0, 1], 30: [0.5, r3], 45: [r2, r2], 60: [r3, 0.5], 90: [1, 0], 120: [r3, -0.5], 135: [r2, -r2], 150: [0.5, -r3], 180: [0, -1], 210: [-0.5, -r3], 225: [-r2, -r2], 240: [-r3, -0.5], 270: [-1, 0], 300: [-r3, 0.5], 315: [-r2, r2], 330: [-0.5, r3], 360: [0, 1] };
  for (const [d, [sin, cos]] of Object.entries(table)) {
    const t = trig(Number(d));
    near(t.sin, sin);
    near(t.cos, cos);
    if (cos !== 0) near(t.tan, sin / cos);
    assert.ok(isSpecial(Number(d)));
  }
  // exactly 0 and ±1 on the axes, never 6e-17 or −0
  assert.deepEqual(trig(90), { sin: 1, cos: 0, tan: null });
  assert.deepEqual(trig(180), { sin: 0, cos: -1, tan: 0 });
  assert.ok(Object.is(trig(180).tan, 0));
  assert.deepEqual(trig(360), trig(0));
});

test("exact text agrees with the numeric value at every special angle", () => {
  assert.deepEqual(exact(60), { sin: "√3/2", cos: "1/2", tan: "√3" });
  assert.deepEqual(exact(30), { sin: "1/2", cos: "√3/2", tan: "√3/3" });
  assert.deepEqual(exact(135), { sin: "√2/2", cos: "−√2/2", tan: "−1" });
  assert.deepEqual(exact(210), { sin: "−1/2", cos: "−√3/2", tan: "√3/3" });
  assert.deepEqual(exact(270), { sin: "−1", cos: "0", tan: null });
  assert.equal(exact(50), null);
  let count = 0;
  for (let d = 0; d <= 360; d++) {
    const e = exact(d);
    if (!e) continue;
    count++;
    const t = trig(d);
    near(value(e.sin), t.sin);
    near(value(e.cos), t.cos);
    if (t.tan === null) assert.equal(e.tan, null);
    else near(value(e.tan), t.tan);
  }
  assert.equal(count, 17);
});

test("tan is undefined at 90° and 270° only", () => {
  assert.equal(trig(90).tan, null);
  assert.equal(trig(270).tan, null);
  assert.equal(signs(90).tan, null);
  for (let d = 0; d <= 360; d++) {
    if (d === 90 || d === 270) continue;
    assert.ok(Number.isFinite(trig(d).tan), `tan ${d}°`);
  }
  assert.ok(trig(89).tan > 57 && trig(91).tan < -57);
});

test("degree/radian conversion", () => {
  near(toRad(180), Math.PI);
  near(toRad(60), Math.PI / 3);
  near(toDeg(Math.PI / 2), 90);
  for (let d = 0; d <= 360; d++) near(toDeg(toRad(d)), d, 1e-9);
  assert.equal(piFraction(0), "0");
  assert.equal(piFraction(30), "π/6");
  assert.equal(piFraction(60), "π/3");
  assert.equal(piFraction(135), "3π/4");
  assert.equal(piFraction(180), "π");
  assert.equal(piFraction(270), "3π/2");
  assert.equal(piFraction(360), "2π");
});

test("sign of each function per quadrant", () => {
  const expected = { 1: [1, 1, 1], 2: [1, -1, -1], 3: [-1, -1, 1], 4: [-1, 1, -1] };
  for (let d = 0; d <= 360; d++) {
    const q = quadrant(d);
    if (d % 90 === 0) {
      assert.equal(q, 0);
      continue;
    }
    assert.equal(q, Math.floor(d / 90) + 1);
    const s = signs(d);
    assert.deepEqual([s.sin, s.cos, s.tan], expected[q], `${d}°`);
  }
  assert.deepEqual(signs(0), { sin: 0, cos: 1, tan: 0 });
  assert.deepEqual(signs(270), { sin: -1, cos: 0, tan: null });
});

test("angles are kept as whole degrees in [0, 360]; dragging snaps to special angles", () => {
  assert.equal(normDeg(-20), 0);
  assert.equal(normDeg(400), 360);
  assert.equal(normDeg(59.6), 60);
  assert.equal(normDeg(NaN), 0);
  assert.equal(snap(58.2), 60);
  assert.equal(snap(43.4), 45);
  assert.equal(snap(52.3), 52);
  assert.equal(snap(-30), 330);
  assert.equal(snap(358.5), 360);
  assert.equal(initialState().deg, 60);
});
