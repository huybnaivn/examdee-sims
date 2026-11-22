import test from "node:test";
import assert from "node:assert/strict";
import { IDENTITIES, IDENTITY_KEYS, initialState, normalize, step, area, volume, expand, quizItems, quizSolved } from "./model.js";

const near = (x, y, msg) => assert.ok(Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(x), Math.abs(y)), `${msg}: ${x} vs ${y}`);
const pairs = [];
for (let a = 0.5; a <= 8; a += 0.5) for (let b = 0; b <= 8; b += 0.5) pairs.push([a, b]);
const ordered = pairs.filter(([a, b]) => b <= a);

// rectangles r1, r2 overlap with positive area
const overlap = (p, q) => Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x) > 1e-9 && Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y) > 1e-9;
const tiles = (rects, W, H, msg) => {
  near(rects.reduce((s, r) => s + area(r), 0), W * H, `${msg} area`);
  for (const r of rects) assert.ok(r.x >= -1e-9 && r.y >= -1e-9 && r.x + r.w <= W + 1e-9 && r.y + r.h <= H + 1e-9, `${msg} inside`);
  rects.forEach((r, i) => rects.slice(i + 1).forEach(q => assert.ok(!overlap(r, q), `${msg} overlap`)));
};

test("each identity holds numerically for many a, b", () => {
  for (const [a, b] of pairs) {
    near(IDENTITIES["binh-phuong-tong"].value(a, b), a * a + 2 * a * b + b * b, "(a+b)²");
    near(IDENTITIES["binh-phuong-hieu"].value(a, b), a * a - 2 * a * b + b * b, "(a-b)²");
    near(IDENTITIES["hieu-hai-binh-phuong"].value(a, b), (a - b) * (a + b), "a²-b²");
    near(IDENTITIES["lap-phuong-tong"].value(a, b), a ** 3 + 3 * a * a * b + 3 * a * b * b + b ** 3, "(a+b)³");
    for (const id of IDENTITY_KEYS) near(IDENTITIES[id].value(a, b), expand(id, a, b), id);
  }
  assert.equal(IDENTITIES["binh-phuong-tong"].value(5, 3), 64);
  assert.equal(IDENTITIES["lap-phuong-tong"].value(2, 1), 27);
});

test("piece areas add up to the whole figure, and the pieces tile it", () => {
  for (const [a, b] of pairs) {
    const sum = IDENTITIES["binh-phuong-tong"].pieces(a, b).map(p => p.from);
    tiles(sum, a + b, a + b, "(a+b)²");
    near(sum.reduce((s, r) => s + area(r), 0), IDENTITIES["binh-phuong-tong"].whole(a, b), "(a+b)² whole");
  }
  for (const [a, b] of ordered) {
    const diff = IDENTITIES["binh-phuong-hieu"].pieces(a, b).map(p => p.from);
    tiles(diff, a, a, "(a-b)²");
    // (a − b)² = a² − 2·b(a − b) − b²
    near(area(diff[0]), a * a - 2 * area(diff[1]) - area(diff[3]), "(a-b)² from a²");
    near(area(diff[0]), (a - b) ** 2, "(a-b)² piece");
    const I = IDENTITIES["hieu-hai-binh-phuong"];
    const l = I.pieces(a, b).map(p => p.from);
    tiles([...l, I.hole(a, b)], a, a, "a²-b² with hole");
    near(l.reduce((s, r) => s + area(r), 0), I.whole(a, b), "a²-b² whole");
  }
});

test("rearranging keeps every area and makes the target shape", () => {
  for (const [a, b] of ordered) {
    for (const id of ["binh-phuong-tong", "binh-phuong-hieu", "hieu-hai-binh-phuong"]) {
      for (const p of IDENTITIES[id].pieces(a, b)) {
        near(area(p.to), area(p.from), `${id} area kept`);
        if (p.to.rot === 90) assert.deepEqual([p.to.w, p.to.h], [p.from.h, p.from.w]);
        else assert.deepEqual([p.to.w, p.to.h], [p.from.w, p.from.h]);
      }
    }
    // L-shape a² − b² becomes the rectangle (a − b) × (a + b)
    tiles(IDENTITIES["hieu-hai-binh-phuong"].pieces(a, b).map(p => p.to), a - b, a + b, "rectangle (a-b)(a+b)");
  }
});

test("the cube is cut into a³, 3 a²b, 3 ab², b³", () => {
  for (const [a, b] of pairs) {
    const blocks = IDENTITIES["lap-phuong-tong"].blocks(a, b);
    near(blocks.reduce((s, k) => s + volume(k.from), 0), (a + b) ** 3, "volume");
    for (const k of blocks) near(volume(k.to), volume(k.from), "volume kept");
    const want = [a ** 3, a * a * b, a * b * b, b ** 3];
    for (const k of blocks) near(volume(k.from), want[k.term], "block term");
    assert.deepEqual([0, 1, 2, 3].map(t => blocks.filter(k => k.term === t).length), [1, 3, 3, 1]);
  }
});

test("edge cases a = b and b = 0", () => {
  assert.equal(IDENTITIES["binh-phuong-hieu"].value(4, 4), 0);
  assert.equal(IDENTITIES["hieu-hai-binh-phuong"].value(4, 4), 0);
  assert.equal(area(IDENTITIES["binh-phuong-hieu"].pieces(4, 4)[0].from), 0);
  assert.deepEqual(quizItems("binh-phuong-hieu", 4, 4).map(p => p.term), [2]); // only b² is left
  assert.deepEqual(quizItems("hieu-hai-binh-phuong", 4, 4), []);
  for (const id of IDENTITY_KEYS) {
    near(IDENTITIES[id].value(3, 0), IDENTITIES[id].solid ? 27 : 9, id);
    assert.deepEqual(quizItems(id, 3, 0).map(p => p.term), [0], id); // only a² (a³) has a size
  }
});

test("quiz is solved only when every visible piece has its term", () => {
  const labels = [0, 1, 1, 2];
  assert.ok(quizSolved("binh-phuong-tong", 5, 3, labels));
  assert.ok(!quizSolved("binh-phuong-tong", 5, 3, [0, 1, 2, 2]));
  assert.ok(quizSolved("binh-phuong-tong", 5, 0, [0, -1, -1, -1]));
  const cube = IDENTITIES["lap-phuong-tong"].blocks(2, 1).map(k => k.term);
  assert.ok(quizSolved("lap-phuong-tong", 2, 1, cube));
});

test("normalize keeps b ≤ a where the figure needs it; the animation stops at its goal", () => {
  const s = normalize({ ...initialState(), identity: "binh-phuong-hieu", a: 3, b: 7, t: 9 });
  assert.deepEqual([s.a, s.b, s.t], [3, 3, 1]);
  const u = normalize({ ...initialState(), identity: "binh-phuong-tong", a: 3, b: 7 });
  assert.equal(u.b, 7);
  const v = { ...initialState(), apart: true };
  let n = 0;
  while (step(v, 1 / 120)) n++;
  assert.equal(v.t, 1);
  assert.ok(n > 100 && n < 200);
});
