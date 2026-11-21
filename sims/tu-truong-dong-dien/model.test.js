import test from "node:test";
import assert from "node:assert/strict";
import { initialState, fieldAt, probe, theory, moveProbe, probePos, ellipKE, loopField, fieldLines, MU0, SOL_RADIUS, VIEW, ASPECT } from "./model.js";

const close = (a, b, rel, msg = "") => assert.ok(Math.abs(a - b) <= rel * Math.abs(b), `${msg} ${a} ≠ ${b}`);
const at = (patch, x, y) => {
  const s = { ...initialState(), ...patch };
  return fieldAt(s, x, y);
};

test("elliptic integrals: known values", () => {
  const z = ellipKE(0);
  close(z.K, Math.PI / 2, 1e-14);
  close(z.E, Math.PI / 2, 1e-14);
  const h = ellipKE(0.5);
  close(h.K, 1.854074677301372, 1e-12);
  close(h.E, 1.350643881047675, 1e-12);
});

test("straight wire: B = 2·10⁻⁷·I/r, circling the wire", () => {
  for (const I of [0.5, 5, 20]) {
    for (const [x, y] of [[0.03, 0], [0, -0.05], [-0.02, 0.05], [0.006, 0.008]]) {
      const s = moveProbe({ ...initialState(), source: "wire", current: I }, x, y);
      const r = Math.hypot(x, y);
      const p = probe(s);
      close(p.b, (2e-7 * I) / r, 1e-12);
      close(theory(s), (2e-7 * I) / r, 1e-12);
      assert.ok(Math.abs(p.bx * x + p.by * y) < 1e-12 * p.b * r, "B is perpendicular to the radius");
      assert.ok(x * p.by - y * p.bx > 0, "counter-clockwise for a current out of the screen");
    }
  }
  // 5 A at 3 cm: 33,3 µT
  close(probe(initialState()).b, 3.3333e-5, 1e-4);
});

test("circular loop: B = 2π·10⁻⁷·I/R at the centre, along the axis", () => {
  for (const R of [0.02, 0.05, 0.08]) {
    for (const I of [1, 7.5]) {
      const [bx, by] = at({ source: "loop", radius: R, current: I }, 0, 0);
      close(bx, (2 * Math.PI * 1e-7 * I) / R, 1e-12);
      assert.equal(by, 0);
      close(theory({ ...initialState(), source: "loop", radius: R, current: I }), (2 * Math.PI * 1e-7 * I) / R, 1e-12);
    }
  }
  // on the axis: μ0·I·R²/(2(R² + z²)^{3/2})
  for (const z of [0.01, 0.04, -0.1]) {
    const [bx] = at({ source: "loop", radius: 0.05, current: 3 }, z, 0);
    close(bx, (MU0 * 3 * 0.05 ** 2) / (2 * (0.05 ** 2 + z * z) ** 1.5), 1e-12);
  }
});

test("loop off the axis agrees with a direct Biot–Savart sum", () => {
  const a = 0.05;
  const I = 2;
  const n = 20000;
  for (const [x, y] of [[0.03, 0.02], [-0.04, -0.07], [0.01, 0.045]]) {
    let bx = 0;
    let by = 0;
    for (let k = 0; k < n; k++) {
      const p = ((k + 0.5) / n) * 2 * Math.PI;
      // point (0, a cos p, a sin p), current direction (0, −sin p, cos p): out of the screen at the top
      const dl = [0, -Math.sin(p), Math.cos(p)].map(v => (v * 2 * Math.PI * a) / n);
      const r = [x, y - a * Math.cos(p), -a * Math.sin(p)];
      const r3 = Math.hypot(...r) ** 3;
      bx += (dl[1] * r[2] - dl[2] * r[1]) / r3;
      by += (dl[2] * r[0] - dl[0] * r[2]) / r3;
    }
    const [ex, ey] = loopField(a, I, 0, x, y);
    close(ex, (MU0 * I * bx) / (4 * Math.PI), 1e-6, "Bx");
    close(ey, (MU0 * I * by) / (4 * Math.PI), 1e-6, "By");
  }
});

test("solenoid: B ≈ 4π·10⁻⁷·N·I/l inside, uniform near the centre, weak outside", () => {
  for (const [N, I, l] of [[200, 5, 0.3], [1000, 2, 0.5], [500, 10, 0.4]]) {
    const s = { ...initialState(), source: "solenoid", turns: N, current: I, length: l };
    const formula = (4 * Math.PI * 1e-7 * N * I) / l;
    close(theory(s), formula, 1e-12);
    const [bx, by] = fieldAt(s, 0, 0);
    // a finite solenoid: B = μ0·n·I·(l/2)/√((l/2)² + a²), which tends to the formula when l ≫ a
    close(bx, formula * (l / 2) / Math.hypot(l / 2, SOL_RADIUS), 2e-3);
    close(bx, formula, 0.025);
    assert.ok(Math.abs(by) < 1e-12);
    const [bx2] = fieldAt(s, l / 6, SOL_RADIUS / 2);
    close(bx2, bx, 0.03, "uniform inside");
    const [ox, oy] = fieldAt(s, 0, SOL_RADIUS * 3);
    assert.ok(Math.hypot(ox, oy) < 0.05 * bx, "weak outside");
    assert.ok(ox < 0, "returns the other way outside");
  }
});

test("B ∝ I and reversing the current reverses B everywhere", () => {
  for (const source of ["wire", "loop", "solenoid"]) {
    for (const [x, y] of [[0.02, 0.01], [-0.05, 0.03], [0, 0]]) {
      const [ax, ay] = at({ source, current: 4 }, x, y);
      const [bx, by] = at({ source, current: 8 }, x, y);
      const [cx, cy] = at({ source, current: 4, reversed: true }, x, y);
      if (Math.hypot(ax, ay) === 0) continue; // the wire's own axis
      close(bx, 2 * ax, 1e-12);
      close(by, 2 * ay, 1e-12);
      assert.ok(cx === -ax && cy === -ay);
      const p = probe(moveProbe({ ...initialState(), source, current: 4 }, x, y));
      const q = probe(moveProbe({ ...initialState(), source, current: 4, reversed: true }, x, y));
      close(Math.abs(p.angle - q.angle), 180, 1e-9);
    }
  }
});

test("probe stays in view and the field stays finite on the conductors", () => {
  const s = moveProbe({ ...initialState(), source: "loop" }, 9, -9);
  assert.deepEqual(probePos(s), [VIEW.loop, -VIEW.loop * ASPECT]);
  assert.deepEqual(probePos({ ...initialState(), source: "solenoid", probeU: 7, probeV: -3 }), [VIEW.solenoid, -VIEW.solenoid * ASPECT]);
  assert.deepEqual(probePos({ ...initialState(), probeU: NaN, probeV: Infinity }), [0, 0]);
  assert.deepEqual(probePos({ ...initialState(), source: "bogus" }), [0.3 * VIEW.wire, 0]);
  for (const [source, x, y] of [["wire", 0, 0], ["loop", 0, 0.05], ["solenoid", 0, SOL_RADIUS]]) {
    const p = probe(moveProbe({ ...initialState(), source }, x, y));
    assert.ok(Number.isFinite(p.b) && Number.isFinite(p.angle));
  }
});

test("field lines of a loop close around the conductor", () => {
  const s = { ...initialState(), source: "loop" };
  const lines = fieldLines(s, [[0, 0.035], [0, 0.045]], VIEW.loop / 150);
  for (const line of lines) {
    assert.ok(line.length > 20);
    const [x0, y0] = line[0];
    const [x1, y1] = line.at(-1);
    assert.ok(Math.hypot(x1 - x0, y1 - y0) < 1e-9, "closed");
  }
});
