import test from "node:test";
import assert from "node:assert/strict";
import { initialState, term, limit, findN, lead, isCorrectGuess, summary, N_SCAN } from "./model.js";

const near = (x, y, eps = 1e-9) => assert.ok(Math.abs(x - y) < eps, `${x} ≠ ${y}`);
const S = extra => ({ ...initialState(), ...extra });

test("terms of the built-in sequences", () => {
  near(term(S({ seq: "inv" }), 4), 0.25);
  near(term(S({ seq: "alt" }), 3), -1 / 3);
  near(term(S({ seq: "alt" }), 4), 0.25);
  near(term(S({ seq: "ratio" }), 4), 1.25);
  near(term(S({ seq: "geo", q: 0.5 }), 3), 0.125);
  near(term(S({ seq: "geo", q: -2 }), 3), -8);
  near(term(S({ seq: "e" }), 1), 2);
  near(term(S({ seq: "e" }), 2), 2.25);
  near(term(S({ seq: "poly", p2: 2, p1: 0, p0: 1, r2: 1, r1: 0, r0: 3 }), 1), 0.75);
  assert.equal(term(S({ seq: "poly", p2: 0, p1: 1, p0: 0, r2: 0, r1: 1, r0: -3 }), 3), null); // n/(n − 3) at n = 3
});

test("limits of the built-in sequences", () => {
  assert.equal(limit(S({ seq: "inv" })).value, 0);
  assert.equal(limit(S({ seq: "alt" })).value, 0);
  assert.equal(limit(S({ seq: "ratio" })).value, 1);
  assert.equal(limit(S({ seq: "e" })).value, Math.E);
  // the terms really get close to those limits
  for (const seq of ["inv", "alt", "ratio", "e"]) near(term(S({ seq }), 1e6), limit(S({ seq })).value, 2e-6);
});

test("qⁿ → 0 iff |q| < 1; q = 1 gives 1; diverges for |q| > 1 and q = −1", () => {
  for (const q of [-0.95, -0.5, 0, 0.3, 0.95]) {
    assert.equal(limit(S({ seq: "geo", q })).value, 0);
    assert.ok(Math.abs(term(S({ seq: "geo", q }), 2000)) < 1e-40);
  }
  assert.equal(limit(S({ seq: "geo", q: 1 })).value, 1);
  assert.equal(limit(S({ seq: "geo", q: 1.05 })).value, Infinity);
  assert.equal(limit(S({ seq: "geo", q: -1 })).value, null);
  assert.equal(limit(S({ seq: "geo", q: -1.5 })).value, null);
  assert.ok(term(S({ seq: "geo", q: 1.05 }), 1000) > 1e20);
  // a divergent sequence never settles in a band: no N
  assert.equal(findN(S({ seq: "geo", q: 1.2 }), 0, 1), null);
  assert.equal(findN(S({ seq: "geo", q: -1 }), 1, 0.5), null);
  assert.equal(findN(S({ seq: "geo", q: -1 }), 0, 1), null); // |(−1)ⁿ − 0| = 1, never < 1
});

test("N(ε) for 1/n around 0 is ⌊1/ε⌋ + 1", () => {
  assert.equal(findN(S({ seq: "inv" }), 0, 0.1), 11);
  assert.equal(findN(S({ seq: "inv" }), 0, 0.01), 101);
  assert.equal(findN(S({ seq: "inv" }), 0, 0.05), 21);
  for (const eps of [0.03, 0.07, 0.13, 0.33, 0.45, 0.99]) assert.equal(findN(S({ seq: "inv" }), 0, eps), Math.floor(1 / eps) + 1, `ε = ${eps}`);
  // and the definition holds: u_N inside, u_(N−1) outside
  const N = findN(S({ seq: "inv" }), 0, 0.07);
  assert.ok(1 / N < 0.07 && 1 / (N - 1) >= 0.07);
});

test("N for a wrong guess: none when the band misses the limit", () => {
  assert.equal(findN(S({ seq: "inv" }), 0.5, 0.1), null);
  assert.equal(findN(S({ seq: "ratio" }), 0.99, 0.01), null); // 1 + 1/n stays above 1
  assert.equal(findN(S({ seq: "ratio" }), 1.01, 0.01), 51); // |1/n − 0,01| < 0,01 ⟺ n > 50
  assert.equal(findN(S({ seq: "alt" }), 0, 0.1), 11);
});

test("(1 + 1/n)ⁿ increases towards e", () => {
  const s = S({ seq: "e" });
  let prev = 0;
  for (let n = 1; n <= 500; n++) {
    const u = term(s, n);
    assert.ok(u > prev && u < Math.E);
    prev = u;
  }
  near(term(s, 10), 2.5937424601, 1e-9);
  near(term(s, 1000), 2.7169239322, 1e-9);
  const N = findN(s, 2.72, 0.01); // |uₙ − 2,72| < 0,01 ⟺ uₙ > 2,71 since uₙ < e < 2,73
  assert.ok(N > 100 && N < 200);
  assert.ok(term(s, N - 1) <= 2.71 && term(s, N) > 2.71);
});

test("ratio of polynomials: limit by degrees and leading coefficients", () => {
  const P = (p2, p1, p0, r2, r1, r0) => S({ seq: "poly", p2, p1, p0, r2, r1, r0 });
  near(limit(P(2, 0, 1, 1, 0, 3)).value, 2); // (2n² + 1)/(n² + 3)
  near(limit(P(0, 3, -1, 0, 2, 5)).value, 1.5);
  near(limit(P(-4, 1, 0, 3, 0, 0)).value, -4 / 3);
  assert.equal(limit(P(0, 1, 0, 1, 0, 1)).value, 0); // n/(n² + 1)
  assert.equal(limit(P(0, 0, 5, 0, 1, 0)).value, 0);
  assert.equal(limit(P(1, 0, 0, 0, 1, 1)).value, Infinity); // n²/(n + 1)
  assert.equal(limit(P(1, 0, 0, 0, -1, 1)).value, -Infinity);
  assert.equal(limit(P(0, 0, 0, 1, 0, 0)).value, 0);
  assert.equal(limit(P(1, 0, 0, 0, 0, 0)).value, null);
  assert.deepEqual(lead([0, -3, 2]), { deg: 1, c: -3 });
  for (const s of [P(2, 0, 1, 1, 0, 3), P(0, 3, -1, 0, 2, 5), P(-4, 1, 0, 3, 0, 0)]) near(term(s, 1e6), limit(s).value, 1e-5);
});

test("guess check and summary", () => {
  assert.ok(isCorrectGuess({ value: Math.E }, 2.72));
  assert.ok(!isCorrectGuess({ value: Math.E }, 2.71));
  assert.ok(isCorrectGuess({ value: 2 / 3 }, 0.67));
  assert.ok(!isCorrectGuess({ value: Infinity }, 5));
  const r = summary(initialState());
  assert.equal(r.terms.length, 30);
  assert.equal(r.N, 11);
  assert.ok(r.correct);
  const bad = summary({ ...initialState(), eps: -1, nShow: 1e9 });
  assert.equal(bad.eps, 0.01);
  assert.equal(bad.nShow, 200);
  assert.ok(N_SCAN >= 1e5);
});
