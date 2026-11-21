import test from "node:test";
import assert from "node:assert/strict";
import {
  GM, initialState, period, position, sweptArea, sectors, speedAt, perihelion, aphelion, focusDistance, semiMinor, addPlanet, step, sanitizePlanets,
} from "./model.js";

const near = (a, b, rel, msg) => assert.ok(Math.abs(a - b) <= rel * Math.abs(b) + 1e-12, `${msg}: ${a} vs ${b}`);

// Newton's law of gravitation integrated with RK4, started at perihelion with the vis-viva speed.
function integrate(a, e, steps, T = period(a)) {
  const h = T / steps;
  let s = [perihelion(a, e), 0, 0, speedAt(a, perihelion(a, e))];
  const f = ([x, y, vx, vy]) => {
    const r3 = Math.hypot(x, y) ** 3;
    return [vx, vy, (-GM * x) / r3, (-GM * y) / r3];
  };
  const out = [{ t: 0, x: s[0], y: s[1], vx: s[2], vy: s[3] }];
  for (let i = 1; i <= steps; i++) {
    const k1 = f(s);
    const k2 = f(s.map((v, j) => v + (h / 2) * k1[j]));
    const k3 = f(s.map((v, j) => v + (h / 2) * k2[j]));
    const k4 = f(s.map((v, j) => v + h * k3[j]));
    s = s.map((v, j) => v + (h / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
    out.push({ t: i * h, x: s[0], y: s[1], vx: s[2], vy: s[3] });
  }
  return out;
}

test("Kepler-equation positions agree with Newton's law integrated numerically", () => {
  for (const [a, e] of [[1, 0.017], [1.5, 0.6], [3, 0.85]]) {
    const path = integrate(a, e, 20000);
    for (const p of path.filter((_, i) => i % 1000 === 0)) {
      const q = position(a, e, p.t);
      assert.ok(Math.hypot(p.x - q.x, p.y - q.y) < 1e-5 * a, `a=${a} e=${e} t=${p.t}`);
      near(Math.hypot(q.vx, q.vy), Math.hypot(p.vx, p.vy), 1e-5, "speed");
    }
    // back at perihelion after one period T = a^(3/2)
    near(path.at(-1).x, perihelion(a, e), 1e-6, "closed orbit");
  }
});

test("law II: the integrated orbit sweeps equal areas in equal times", () => {
  for (const [a, e] of [[1.5, 0.6], [2, 0.3]]) {
    const path = integrate(a, e, 24000);
    const chunk = path.length / 12 | 0; // 12 equal time slices
    const areas = [];
    for (let k = 0; k < 12; k++) {
      let A = 0;
      for (let i = k * chunk; i < (k + 1) * chunk; i++) A += 0.5 * Math.abs(path[i].x * path[i + 1].y - path[i + 1].x * path[i].y);
      areas.push(A);
    }
    for (const A of areas) near(A, (Math.PI * a * semiMinor(a, e)) / 12, 1e-4, `a=${a} e=${e}`);
    // areal velocity ½|r × v| is the same everywhere
    const h0 = 0.5 * Math.abs(path[0].x * path[0].vy - path[0].y * path[0].vx);
    for (const p of path.filter((_, i) => i % 997 === 0)) near(0.5 * Math.abs(p.x * p.vy - p.y * p.vx), h0, 1e-7, "areal velocity");
  }
});

test("the shaded sectors at perihelion and aphelion have equal areas", () => {
  for (const [a, e, sweep] of [[1.5, 0.6, 10], [4, 0.9, 5], [0.5, 0.2, 20]]) {
    const { near: A1, far: A2 } = sectors({ a, e, sweep });
    near(A1, A2, 2e-4, `a=${a} e=${e}`);
    near(A1, Math.PI * a * semiMinor(a, e) * (sweep / 100), 2e-4, "πab·Δt/T");
  }
  near(sweptArea(1.5, 0.6, 0, 0.1), sweptArea(1.5, 0.6, 0.5, 0.6), 1e-4, "any two equal times");
  assert.ok(sweptArea(1.5, 0.6, 0, 0.2) > 1.9 * sweptArea(1.5, 0.6, 0.5, 0.6), "twice the time, twice the area");
  // ...while the arcs are very different: the planet covers more path near the Sun
  const arc = (t1, t2) => Math.hypot(position(1.5, 0.6, t2).x - position(1.5, 0.6, t1).x, position(1.5, 0.6, t2).y - position(1.5, 0.6, t1).y);
  const T = period(1.5);
  assert.ok(arc(-0.05 * T, 0.05 * T) > 3 * arc(0.45 * T, 0.55 * T));
});

test("law III: T² ∝ a³ across planets", () => {
  for (const a of [0.387, 1, 1.524, 5.203]) {
    const path = integrate(a, 0.3, 4000);
    // the numerically integrated orbit closes after T = a^1.5 years
    assert.ok(Math.hypot(path.at(-1).x - path[0].x, path.at(-1).y - path[0].y) < 1e-6 * a);
    near(period(a) ** 2 / a ** 3, 1, 1e-12, `a=${a}`);
  }
  near(period(1), 1, 1e-12, "Earth year");
});

test("faster at perihelion, with r_p·v_p = r_a·v_a", () => {
  for (const [a, e] of [[1, 0.017], [1.5, 0.6], [3, 0.9]]) {
    const vp = Math.hypot(position(a, e, 0).vx, position(a, e, 0).vy);
    const va = Math.hypot(position(a, e, period(a) / 2).vx, position(a, e, period(a) / 2).vy);
    assert.ok(vp > va);
    near(perihelion(a, e) * vp, aphelion(a, e) * va, 1e-9, "r_p·v_p");
    near(vp, speedAt(a, perihelion(a, e)), 1e-9, "vis-viva");
  }
});

test("e = 0 is a circle at constant speed; the Sun sits c = a·e from the centre", () => {
  for (let t = 0; t < 1; t += 0.05) {
    const p = position(2, 0, t * period(2));
    near(Math.hypot(p.x, p.y), 2, 1e-12, "radius");
    near(Math.hypot(p.vx, p.vy), (2 * Math.PI * 2) / period(2), 1e-12, "speed");
  }
  const [a, e] = [2, 0.5];
  const xs = Array.from({ length: 2001 }, (_, i) => position(a, e, (i / 2000) * period(a)).x);
  const center = (Math.max(...xs) + Math.min(...xs)) / 2;
  near(-center, focusDistance(a, e), 1e-6, "c = a·e");
  near(Math.max(...xs), a - focusDistance(a, e), 1e-9, "r_p = a − c");
});

test("planet list, time wrap and forged input", () => {
  const s = addPlanet(addPlanet({ ...initialState(), a: 1 }));
  assert.equal(s.planets.length, 1);
  s.t = 1e9;
  step(s, 1 / 120);
  assert.ok(s.t >= 0 && s.t < period(s.a));
  assert.deepEqual(sanitizePlanets([{ a: 1, e: 0.1 }, { a: 1, e: 1.5 }, { a: -2, e: 0 }, null]), [{ a: 1, e: 0.1 }]);
});
