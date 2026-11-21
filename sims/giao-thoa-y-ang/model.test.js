import test from "node:test";
import assert from "node:assert/strict";
import { initialState, spacing, intensity, brightAt, darkAt, readAt, count, markerX } from "./model.js";

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const at = over => ({ ...initialState(), ...over });

test("i = λD/a in mm", () => {
  close(spacing(initialState()), 1.2); // 0,6 µm · 2 m / 1 mm
  close(spacing(at({ wavelength: 500, slits: 0.5, distance: 1 })), 1); // textbook example
  close(spacing(at({ wavelength: 760, slits: 0.2, distance: 3 })), 11.4);
});

test("bright fringes at x = k·i, dark at (k + ½)·i, with the cos² intensity", () => {
  for (const s of [initialState(), at({ wavelength: 420, slits: 1.5, distance: 1.2 }), at({ wavelength: 700, slits: 0.3, distance: 2.8 })]) {
    const i = spacing(s);
    for (let k = -4; k <= 4; k++) {
      close(brightAt(s, k), k * i);
      close(darkAt(s, k), (k + 0.5) * i);
      close(intensity(s, brightAt(s, k)), 1);
      close(intensity(s, darkAt(s, k)), 0);
    }
    for (const x of [-3.3, -0.7, 0.2, 1.9, 5]) {
      const a = s.slits * 1e-3;
      const lambda = s.wavelength * 1e-9;
      close(intensity(s, x), Math.cos((Math.PI * a * (x * 1e-3)) / (lambda * s.distance)) ** 2);
      assert.ok(intensity(s, x) >= 0 && intensity(s, x) <= 1);
    }
  }
});

test("doubling a halves i; doubling D or λ doubles it", () => {
  const s = initialState();
  close(spacing(at({ slits: 2 * s.slits })), spacing(s) / 2);
  close(spacing(at({ distance: 2 * s.distance })), 2 * spacing(s));
  close(spacing(at({ wavelength: 2 * s.wavelength })), 2 * spacing(s));
});

test("red fringe spacing is larger than violet", () => {
  assert.ok(spacing(at({ wavelength: 700 })) > spacing(at({ wavelength: 400 })));
  close(spacing(at({ wavelength: 700 })) / spacing(at({ wavelength: 400 })), 700 / 400);
});

test("marker reading: bright order, dark order, between fringes", () => {
  const s = initialState(); // i = 1,2 mm
  assert.deepEqual(readAt(s, markerX(s)), { ratio: 2, kind: 1, order: 2 });
  assert.equal(readAt(s, 0).kind, 1);
  assert.equal(readAt(s, 0).order, 0);
  assert.deepEqual([readAt(s, -3.6).kind, readAt(s, -3.6).order], [1, -3]);
  assert.deepEqual([readAt(s, 0.6).kind, readAt(s, 0.6).order], [-1, 1]); // vân tối thứ 1
  assert.deepEqual([readAt(s, 3.0).kind, readAt(s, 3.0).order], [-1, 3]); // x = 2,5i: vân tối thứ 3
  assert.deepEqual([readAt(s, -1.8).kind, readAt(s, -1.8).order], [-1, -2]);
  assert.equal(readAt(s, 0.3).kind, 0); // x = 0,25i
  assert.equal(readAt(s, 1.2 + 0.1).kind, 1); // within 0,1·i of the first bright fringe
  close(markerX(at({ marker: 99 })), 5);
});

test("number of bright and dark fringes in a field of width L", () => {
  // i = 1,2 mm, L = 10 mm: L/2i = 4,17 → 9 bright, 8 dark
  assert.deepEqual(count(initialState()), { bright: 9, dark: 8 });
  // textbook: i = 1,5 mm, L = 12,5 mm → 9 bright, 8 dark
  assert.deepEqual(count(at({ wavelength: 750, slits: 1, distance: 2 }), 12.5), { bright: 9, dark: 8 });
  // edge exactly on a bright fringe: L = 12 mm, i = 1,2 mm → 11 bright, 10 dark
  assert.deepEqual(count(initialState(), 12), { bright: 11, dark: 10 });
  // edge on a dark fringe: L = 10,8 mm → L/2i = 4,5 → 9 bright, 10 dark
  assert.deepEqual(count(initialState(), 10.8), { bright: 9, dark: 10 });
  // brute force agrees
  for (const L of [3, 7.3, 10, 18, 25]) {
    const s = at({ wavelength: 530, slits: 0.8, distance: 1.7 });
    const i = spacing(s);
    let b = 0;
    let d = 0;
    for (let k = -200; k <= 200; k++) {
      if (Math.abs(k * i) <= L / 2) b++;
      if (Math.abs((k + 0.5) * i) <= L / 2) d++;
    }
    assert.deepEqual(count(s, L), { bright: b, dark: d });
  }
});
