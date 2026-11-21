import test from "node:test";
import assert from "node:assert/strict";
import {
  isPrime, classify, factorize, product, divisors, gcd, lcm, euclidSteps, viaFactors, factorTree,
  SIEVE, sieveAt, START, initialState, step, answer, tidy,
} from "./model.js";

const PRIMES_100 = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];

test("the sieve leaves exactly the 25 primes up to 100", () => {
  const end = sieveAt(SIEVE.length);
  assert.equal(end.done, true);
  assert.equal(end.primes, 25);
  const found = end.status.map((v, n) => (v === 2 ? n : 0)).filter(Boolean);
  assert.deepEqual(found, PRIMES_100);
  assert.equal(end.status[1], 1); // 1 is crossed out
  // every crossed number from 4 on is composite; 1 + 74 crossings + 25 primes = 100 numbers
  for (let n = 2; n <= 100; n++) assert.equal(end.status[n] === 2, isPrime(n));
  assert.equal(SIEVE.filter(op => op.type === "cross").length, 74);
  // each crossing is by a prime ≤ 10 that divides the number
  for (const op of SIEVE.filter(op => op.type === "cross")) assert.ok(op.by <= 10 && op.n % op.by === 0 && op.n > op.by);
});

test("the starting picture: multiples of 2 and 3 crossed, 5 circled", () => {
  const s = sieveAt(START);
  assert.equal(s.current, 5);
  assert.deepEqual([2, 3, 5].map(n => s.status[n]), [2, 2, 2]);
  assert.equal(s.status[9], 1);
  assert.equal(s.status[25], 0);
});

test("stepping the animation finishes once and stops", () => {
  const s = initialState();
  let finished = 0;
  for (let i = 0; i < 120 * 60; i++) if (step(s, 1 / 120)) finished++;
  assert.equal(finished, 1);
  assert.equal(s.sieveIndex, SIEVE.length);
});

test("1 is neither prime nor composite; 2 is the only even prime", () => {
  assert.equal(classify(1), "neither");
  assert.equal(classify(2), "prime");
  assert.equal(classify(91), "composite"); // 7 · 13
  assert.equal(classify(97), "prime");
  assert.deepEqual(divisors(1), [1]);
  assert.deepEqual(divisors(13), [1, 13]); // a prime has exactly two divisors
});

test("prime factorisation up to 10 000", () => {
  assert.deepEqual(factorize(360), [[2, 3], [3, 2], [5, 1]]);
  assert.deepEqual(factorize(1), []);
  assert.deepEqual(factorize(9973), [[9973, 1]]);
  assert.deepEqual(factorize(10000), [[2, 4], [5, 4]]);
  for (let n = 2; n <= 10000; n++) {
    const f = factorize(n);
    assert.equal(product(f), n);
    for (const [p, k] of f) assert.ok(isPrime(p) && k >= 1);
  }
});

test("factor tree leaves multiply back to n and are all primes", () => {
  const leaves = t => (t.kids ? t.kids.flatMap(leaves) : [t.n]);
  for (const n of [4, 12, 360, 512, 997, 1000]) {
    const l = leaves(factorTree(n));
    assert.equal(l.reduce((a, b) => a * b, 1), n);
    assert.ok(l.every(isPrime));
  }
  assert.deepEqual(factorTree(360).kids.map(k => k.n), [18, 20]);
});

test("divisors, gcd and lcm agree with listing, and gcd·lcm = a·b", () => {
  assert.deepEqual(divisors(36), [1, 2, 3, 4, 6, 9, 12, 18, 36]);
  assert.equal(gcd(84, 90), 6);
  assert.equal(lcm(84, 90), 1260);
  for (let a = 1; a <= 120; a++) {
    for (let b = 1; b <= 120; b++) {
      const common = divisors(a).filter(d => b % d === 0);
      assert.equal(gcd(a, b), Math.max(...common));
      let m = a;
      while (m % b) m += a; // first nonzero common multiple
      assert.equal(lcm(a, b), m);
      assert.equal(gcd(a, b) * lcm(a, b), a * b);
      const v = viaFactors(a, b);
      assert.equal(product(v.gcd), gcd(a, b));
      assert.equal(product(v.lcm), lcm(a, b));
    }
  }
});

test("Euclid's algorithm steps", () => {
  assert.deepEqual(euclidSteps(252, 105), [
    [252, 105, 2, 42],
    [105, 42, 2, 21],
    [42, 21, 2, 0],
  ]);
  assert.deepEqual(euclidSteps(5, 20), [[20, 5, 4, 0]]); // larger number first
  for (const [a, b] of [[84, 90], [17, 5], [300, 299], [1, 1]]) {
    const steps = euclidSteps(a, b);
    for (const [x, y, q, r] of steps) assert.equal(x, y * q + r);
    assert.equal(steps.at(-1)[1], gcd(a, b)); // last nonzero remainder
  }
});

test("quiz scoring and forged state", () => {
  const s = { ...initialState(), quizN: 91 };
  assert.equal(answer(s, "prime"), false);
  assert.equal(answer(s, "composite"), true);
  assert.deepEqual([s.quizScore, s.quizTotal], [1, 2]);
  const forged = tidy({ ...initialState(), sieveIndex: -5, quizN: 1e9, quizScore: 50, quizTotal: 3, quizLast: "x" });
  assert.deepEqual([forged.sieveIndex, forged.quizN, forged.quizScore, forged.quizLast], [0, 100, 3, ""]);
});
