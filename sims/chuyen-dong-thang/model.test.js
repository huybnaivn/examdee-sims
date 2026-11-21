import test from "node:test";
import assert from "node:assert/strict";
import { initialState, cart, at, turnTime, meeting, step, T_MAX } from "./model.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} ≉ ${b}`);
const state = extra => ({ ...initialState(), ...extra });

test("v = v₀ + a·t and x = x₀ + v₀t + ½at²", () => {
  for (const [x0, v0, a] of [[0, 10, -1], [-20, 3, 2.5], [5, -4, 0], [12, 0, -3]]) {
    const c = cart(state({ x0, v0, a }));
    for (const t of [0, 1.5, 7, 19]) {
      const m = at(c, t);
      near(m.v, v0 + a * t);
      near(m.x, x0 + v0 * t + 0.5 * a * t * t);
      near(m.a, a);
    }
  }
});

test("v² − v₀² = 2a·Δx", () => {
  const c = cart(state({ x0: 3, v0: 4, a: 1.5 }));
  for (const t of [0.5, 3, 11]) {
    const m = at(c, t);
    near(m.v ** 2 - 16, 2 * 1.5 * (m.x - 3));
  }
});

test("turns back at t = −v₀/a when a is opposite to v₀, or stops there when braking", () => {
  const c = cart(state({ x0: 0, v0: 10, a: -2 }));
  near(turnTime(c), 5);
  near(at(c, 5).x, 25); // x = v₀²/(2|a|)
  near(at(c, 5).v, 0);
  assert.ok(at(c, 7).v < 0 && at(c, 7).x < 25);
  assert.equal(turnTime(cart(state({ v0: 10, a: 2 }))), Infinity);
  assert.equal(turnTime(cart(state({ v0: 0, a: 2 }))), Infinity);
  const b = cart(state({ x0: 0, v0: 10, a: -2, brake: true }));
  near(at(b, 9).x, 25);
  near(at(b, 9).v, 0);
  near(at(b, 9).a, 0);
});

test("meeting time and place from the quadratic", () => {
  // 8t − 0,5t² = 60 − 4t  →  t² − 24t + 120 = 0  →  t = 12 − √24
  const m = meeting(state({ x0: 0, v0: 8, a: -1, twoCarts: true, x0B: 60, v0B: -4, aB: 0 }));
  near(m.time, 12 - Math.sqrt(24));
  near(m.x, 60 - 4 * m.time);
  // uniform chase: 2 + 3t = 10 + 1t → t = 4
  const chase = meeting(state({ x0: 2, v0: 3, a: 0, x0B: 10, v0B: 1, aB: 0 }));
  near(chase.time, 4);
  near(chase.x, 14);
});

test("no meeting, and carts that move together", () => {
  assert.equal(meeting(state({ x0: 0, v0: 2, a: 0, x0B: 10, v0B: 2, aB: 0 })), null);
  // 8t − 0,5t² = 50 − 3t + 0,25t² has a negative discriminant
  assert.equal(meeting(state({ x0: 0, v0: 8, a: -1, x0B: 50, v0B: -3, aB: 0.5 })), null);
  assert.deepEqual(meeting(state({ x0: 1, v0: 2, a: 3, x0B: 1, v0B: 2, aB: 3 })), { always: true });
});

test("meeting with a braked cart uses the rest position after it stops", () => {
  // A stops at t = 5, x = 25; B: x = 40 − 2t reaches 25 at t = 7,5
  const m = meeting(state({ x0: 0, v0: 10, a: -2, brake: true, x0B: 40, v0B: -2, aB: 0 }));
  near(m.time, 7.5);
  near(m.x, 25);
});

test("area under the v–t graph equals the displacement", () => {
  for (const extra of [{ x0: 0, v0: 10, a: -2 }, { x0: 0, v0: 10, a: -2, brake: true }, { x0: -5, v0: -3, a: 1.2 }]) {
    const c = cart(state(extra));
    const n = 20000;
    const T = 12;
    let area = 0;
    for (let i = 0; i < n; i++) area += ((at(c, (i * T) / n).v + at(c, ((i + 1) * T) / n).v) / 2) * (T / n);
    near(area, at(c, T).x - c.x0, 1e-6);
  }
});

test("the clock stops at T_MAX and never goes negative", () => {
  const s = state({ time: T_MAX - 0.001 });
  step(s, 1);
  assert.equal(s.time, T_MAX);
  assert.equal(step(state({ time: -5 }), 0).time, 0);
});
