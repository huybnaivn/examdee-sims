import test from "node:test";
import assert from "node:assert/strict";
import { initialState, distances, pathDifference, relativeAmplitude, displacement, classify, probe, orders, countMaxima, countMinima } from "./model.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);
const make = over => ({ ...initialState(), ...over });

// Largest |u| over one period at a point, by brute force, in units of A.
const sampledAmplitude = (s, x, y) => {
  let max = 0;
  for (let i = 0; i < 3600; i++) max = Math.max(max, Math.abs(displacement(s, x, y, (i / 3600) * 2 * Math.PI)));
  return max;
};

test("path difference d₂ − d₁ from the geometry", () => {
  const s = make({ separation: 6 });
  near(distances(s, -3, 2.5).d1, 2.5);
  near(distances(s, -3, 2.5).d2, 6.5);
  near(pathDifference(s, -3, 2.5), 4);
  near(pathDifference(s, 0, 5), 0); // perpendicular bisector
  near(pathDifference(s, 1, 0), -2); // on the segment: d₂ − d₁ = −2x
  near(pathDifference(s, 3, 4.5), -3);
});

test("in-phase sources: maxima at d₂ − d₁ = kλ, minima at (k + ½)λ", () => {
  for (const k of [-3, -1, 0, 2]) {
    assert.deepEqual(classify(k, 0), { kind: 1, k });
    near(relativeAmplitude(k, 0), 2);
    assert.deepEqual(classify(k + 0.5, 0), { kind: -1, k });
    near(relativeAmplitude(k + 0.5, 0), 0);
  }
  assert.equal(classify(0.25, 0).kind, 0);
  assert.equal(classify(1.3, 0).kind, 0);
  // the initial probe sits on the k = 2 maximum: d₂ − d₁ = 4 cm = 2λ
  const p = probe(initialState());
  near(p.delta, 2);
  near(p.amplitude, 2);
  assert.equal(p.kind, 1);
  assert.equal(p.k, 2);
});

test("antiphase sources: the two conditions swap", () => {
  for (const k of [-2, 0, 1]) {
    assert.equal(classify(k, 180).kind, -1);
    near(relativeAmplitude(k, 180), 0);
    assert.equal(classify(k + 0.5, 180).kind, 1);
    near(relativeAmplitude(k + 0.5, 180), 2);
  }
  const s = make({ phaseDeg: 180 });
  assert.equal(probe(s).kind, -1); // same point, now a minimum
  near(sampledAmplitude(s, 0, 4), 0, 1e-6); // the bisector is a nodal line
});

test("amplitude at a point = 2A·|cos(π(d₂ − d₁)/λ)|, checked against the summed waves", () => {
  const s = make({ separation: 7, wavelength: 1.5 });
  for (const [x, y] of [[0, 3], [-2.2, 1.7], [4.1, -5], [9, 0.4], [1, 0]]) {
    const delta = pathDifference(s, x, y) / s.wavelength;
    near(relativeAmplitude(delta, 0), 2 * Math.abs(Math.cos(Math.PI * delta)));
    near(sampledAmplitude(s, x, y), relativeAmplitude(delta, 0), 1e-5);
  }
  // general phase difference: |cos(π(d₂ − d₁)/λ − Δφ/2)|
  const q = make({ separation: 5, wavelength: 2, phaseDeg: 90 });
  for (const [x, y] of [[0, 3], [-2.2, 1.7], [4.1, -5]]) {
    near(sampledAmplitude(q, x, y), relativeAmplitude(pathDifference(q, x, y) / q.wavelength, 90), 1e-5);
  }
});

test("number of maxima and minima on the segment between the sources", () => {
  // in phase: −d/λ < k < d/λ for maxima, −d/λ < k + ½ < d/λ for minima (sources themselves excluded)
  assert.equal(countMaxima(make({ separation: 6, wavelength: 2 })), 5);
  assert.equal(countMinima(make({ separation: 6, wavelength: 2 })), 6);
  assert.equal(countMaxima(make({ separation: 7, wavelength: 2 })), 7);
  assert.equal(countMinima(make({ separation: 7, wavelength: 2 })), 6);
  assert.equal(countMaxima(make({ separation: 10, wavelength: 4 })), 5);
  assert.equal(countMinima(make({ separation: 10, wavelength: 4 })), 4);
  assert.equal(countMaxima(make({ separation: 2, wavelength: 4 })), 1);
  assert.equal(countMinima(make({ separation: 2, wavelength: 4 })), 0);
  // antiphase: the counts swap
  assert.equal(countMaxima(make({ separation: 6, wavelength: 2, phaseDeg: 180 })), 6);
  assert.equal(countMinima(make({ separation: 6, wavelength: 2, phaseDeg: 180 })), 5);
  assert.equal(countMaxima(make({ separation: 7, wavelength: 2, phaseDeg: 180 })), 6);
  assert.equal(countMinima(make({ separation: 7, wavelength: 2, phaseDeg: 180 })), 7);
});

test("every listed line really is a maximum or a minimum on the segment", () => {
  for (const s of [make({}), make({ separation: 8.5, wavelength: 1.5, phaseDeg: 60 }), make({ separation: 5, wavelength: 3, phaseDeg: 180 })]) {
    for (const [offset, want] of [[0, 2], [0.5, 0]]) {
      const list = orders(s, offset);
      for (const { c } of list) {
        const x = (-c * s.wavelength) / 2; // where the line meets S₁S₂
        assert.ok(Math.abs(x) < s.separation / 2);
        near(pathDifference(s, x, 0), c * s.wavelength);
        near(sampledAmplitude(s, x, 0), want, 1e-5);
      }
      // none missed: count the extrema by scanning the segment
      let found = 0;
      const amp = x => relativeAmplitude(pathDifference(s, x, 0) / s.wavelength, s.phaseDeg);
      const N = 20000;
      for (let i = 1; i < N; i++) {
        const x = -s.separation / 2 + (i / N) * s.separation;
        const h = s.separation / N;
        const here = amp(x);
        if (want === 2 ? here > amp(x - h) && here >= amp(x + h) : here < amp(x - h) && here <= amp(x + h)) found++;
      }
      assert.equal(found, list.length);
    }
  }
});
