import test from "node:test";
import assert from "node:assert/strict";
import { DD, initialState, image, solve, focusAtInfinity, trace } from "./model.js";

const st = o => ({ ...initialState(), ...o });
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test("thin lens 1/f = 1/d + 1/d′", () => {
  for (const f of [1, 4, 5, 100]) for (const d of [0.5, 1.2, 3, 7, 150]) if (d !== f) close(1 / f, 1 / d + 1 / image(d, f));
  assert.equal(image(Infinity, 7), 7);
  assert.equal(image(4, 4), Infinity);
});

test("magnifier: G = Đ/f at infinity, final image virtual", () => {
  for (const magF of [2, 5, 8, 10]) {
    const s = st({ instrument: 0, magF, magD: magF - 1 });
    const r = solve(s);
    assert.ok(r.final < 0 && r.virtual);
    close(r.G, DD / s.magD);
    focusAtInfinity(s);
    const inf = solve(s);
    assert.equal(inf.final, Infinity);
    close(inf.G, DD / magF);
    close(inf.Ginf, DD / magF);
  }
  close(solve(st({ instrument: 0, magF: 5, magD: 5 })).G, 5);
  assert.equal(solve(st({ instrument: 0, magF: 5, magD: 8 })).G, null); // real image: not a magnifier any more
});

test("microscope: G∞ = δĐ/(f₁f₂), A₁B₁ on F₂ at infinity", () => {
  for (const [micF1, micF2, micL] of [[1, 4, 16], [0.5, 2, 20], [2, 5, 25], [0.8, 3, 12]]) {
    const s = st({ instrument: 1, micF1, micF2, micL });
    focusAtInfinity(s);
    const r = solve(s);
    const delta = micL - micF1 - micF2;
    close(r.delta, delta);
    close(r.lenses[0].dImage, micL - micF2, 1e-9); // intermediate image at the eyepiece focus
    assert.ok(r.lenses[0].dImage > 0); // A₁B₁ real
    assert.equal(r.final, Infinity);
    close(r.G, (delta * DD) / (micF1 * micF2), 1e-9);
    close(r.Ginf, r.G, 1e-9);
  }
  close(solve(st({ instrument: 1, micF1: 1, micF2: 4, micL: 16 })).Ginf, 68.75);
});

test("microscope, general setting: A₁B₁ = image of AB, final image virtual, G = |k₁|Đ/d₂", () => {
  const s = st({ instrument: 1, micF1: 1, micF2: 4, micL: 16, micD1: 1.1 });
  const r = solve(s);
  close(r.lenses[0].dImage, 11);
  close(r.k1, -10);
  close(r.lenses[1].d, 5); // beyond f₂ = 4: real final image, the eye cannot use it
  assert.equal(r.G, null);
  const t = st({ instrument: 1, micF1: 1, micF2: 4, micL: 16, micD1: 1.09 });
  const q = solve(t);
  assert.ok(q.lenses[1].d < 4 && q.final < 0 && q.virtual);
  close(q.G, (Math.abs(q.k1) * DD) / q.lenses[1].d);
});

test("telescope: G∞ = f₁/f₂ with O₁O₂ = f₁ + f₂, intermediate image at F₁′", () => {
  for (const [telF1, telF2] of [[100, 5], [60, 2], [120, 10], [40, 4]]) {
    const s = st({ instrument: 2, telF1, telF2, telL: 50 });
    focusAtInfinity(s);
    close(s.telL, telF1 + telF2);
    const r = solve(s);
    assert.equal(r.lenses[0].dImage, telF1);
    assert.equal(r.final, Infinity);
    close(r.G, telF1 / telF2);
  }
  const r = solve(st({ instrument: 2, telF1: 100, telF2: 5, telL: 104 }));
  close(r.final, -20); // virtual, on the object side of the eyepiece
  assert.ok(r.virtual);
  close(r.G, 25);
});

test("rays traced through the chain meet at the computed images", () => {
  // microscope: two rays from the object tip cross at A₁B₁ after the objective
  const s = st({ instrument: 1, micD1: 1.095 });
  const r = solve(s);
  const h = 1;
  const a = trace(r.lenses.slice(0, 1), -s.micD1, h, 0);
  const b = trace(r.lenses.slice(0, 1), -s.micD1, h, -h / s.micD1);
  const x1 = r.lenses[0].dImage;
  close(a.pts[1][1] + a.slope * x1, b.pts[1][1] + b.slope * x1, 1e-9);
  close(a.pts[1][1] + a.slope * x1, r.k1 * h, 1e-9);
  // telescope at infinity: a parallel bundle leaves parallel, angle magnified f₁/f₂
  const t = st({ instrument: 2 });
  focusAtInfinity(t);
  const tr = solve(t);
  const u = -0.01;
  const out1 = trace(tr.lenses, -10, 0.1, u);
  const out2 = trace(tr.lenses, -10, -2, u);
  close(out1.slope, out2.slope, 1e-12);
  close(out1.slope / u, -t.telF1 / t.telF2, 1e-9); // inverted image
});
