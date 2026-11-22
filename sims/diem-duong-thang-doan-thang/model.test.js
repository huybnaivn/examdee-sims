import test from "node:test";
import assert from "node:assert/strict";
import { W, H, MAX_POINTS, initialState, parsePoints, formatPoints, parseObjects, formatObjects, collinear, distance, midpoint, contains, pointsOn, distinctLines, lineCount, collinearGroups, oppositeRays, circlePoints, addPoint, freeSpot, movePoint, addObject, undo, segment, settle } from "./model.js";

test("collinearity (thẳng hàng)", () => {
  assert.ok(collinear([1, 6], [5, 4], [9, 2]));
  assert.ok(collinear([0, 0], [3, 3], [7, 7]));
  assert.ok(!collinear([1, 6], [5, 4], [9, 3]));
  const pts = parsePoints(initialState().points);
  assert.deepEqual(collinearGroups(pts), [[0, 1, 2]]); // A, B, C; D and E are off the line
  assert.deepEqual(collinearGroups([[0, 0], [1, 1], [2, 2], [3, 3], [0, 3], [3, 0]]), [[0, 1, 2, 3]]);
  assert.deepEqual(collinearGroups([[0, 0], [1, 0], [0, 1]]), []);
});

test("n points with no three collinear give n(n − 1)/2 lines", () => {
  assert.deepEqual([2, 3, 4, 5, 6, 7, 8].map(lineCount), [1, 3, 6, 10, 15, 21, 28]);
  for (let n = 2; n <= MAX_POINTS; n++) {
    const pts = circlePoints(n);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) assert.ok(!collinear(pts[i], pts[j], pts[k]));
    assert.equal(distinctLines(pts), lineCount(n));
    for (const [x, y] of pts) assert.ok(x > 0 && x < W && y > 0 && y < H);
  }
});

test("collinear points share one line, so there are fewer lines", () => {
  assert.equal(distinctLines([[0, 0], [1, 1], [2, 2]]), 1);
  assert.equal(distinctLines([[0, 0], [1, 1], [2, 2], [0, 2]]), 4); // 1 + 3, not 6
  assert.equal(distinctLines([[0, 0], [1, 0], [2, 0], [3, 0], [1, 5]]), 5);
  assert.equal(distinctLines(parsePoints(initialState().points)), 8); // 10 − 3 + 1
  assert.equal(distinctLines([[1, 1]]), 0);
});

test("a line, a ray and a segment contain different points", () => {
  const [a, b] = [[4, 4], [6, 4]];
  const before = [2, 4]; // on the far side of the origin a
  const between = [5, 4];
  const beyond = [9, 4];
  assert.deepEqual(["l", "r", "s"].map(t => contains(t, a, b, before)), [true, false, false]);
  assert.deepEqual(["l", "r", "s"].map(t => contains(t, a, b, between)), [true, true, true]);
  assert.deepEqual(["l", "r", "s"].map(t => contains(t, a, b, beyond)), [true, true, false]);
  for (const t of ["l", "r", "s"]) {
    assert.ok(contains(t, a, b, a) && contains(t, a, b, b)); // the ends belong to the figure
    assert.ok(!contains(t, a, b, [5, 5]));
  }
  // a ray contains points on one side of its origin only
  for (let x = 0; x <= W; x++) assert.equal(contains("r", a, b, [x, 4]), x >= 4);
  const pts = [[2, 4], [4, 4], [6, 4], [9, 4], [5, 6]];
  assert.deepEqual(pointsOn(pts, { type: "l", a: 1, b: 2 }), [0, 1, 2, 3]);
  assert.deepEqual(pointsOn(pts, { type: "r", a: 1, b: 2 }), [1, 2, 3]);
  assert.deepEqual(pointsOn(pts, { type: "r", a: 2, b: 1 }), [0, 1, 2]);
  assert.deepEqual(pointsOn(pts, { type: "s", a: 1, b: 2 }), [1, 2]);
});

test("opposite rays share the origin and make a line", () => {
  const pts = [[2, 4], [4, 4], [6, 4], [4, 7]];
  const rays = str => oppositeRays(pts, parseObjects(str, pts.length));
  assert.deepEqual(rays("r:1-0;r:1-2"), [[0, 1]]); // BA and BC
  assert.deepEqual(rays("r:0-1;r:0-2"), []); // same direction: the same ray
  assert.deepEqual(rays("r:1-0;r:1-3"), []); // not on one line
  assert.deepEqual(rays("r:1-0;r:2-3"), []); // different origins
  assert.deepEqual(rays("l:1-0;r:1-2"), []);
});

test("segment length and midpoint", () => {
  assert.equal(distance([2, 1], [10, 7]), 10);
  assert.equal(distance([0, 0], [3, 4]), 5);
  assert.ok(Math.abs(distance([1, 1], [2, 2]) - Math.SQRT2) < 1e-12);
  assert.deepEqual(midpoint([2, 1], [10, 7]), [6, 4]);
  assert.deepEqual(midpoint([0, 0], [3, 4]), [1.5, 2]);
  const m = midpoint([1, 6], [4, 1]);
  assert.ok(Math.abs(distance([1, 6], m) - distance(m, [4, 1])) < 1e-12);
  assert.ok(collinear([1, 6], [4, 1], m));
});

test("M on AB: AM + MB = AB, and the midpoint has two equal halves", () => {
  const s = initialState();
  let g = segment(s);
  assert.equal(g.length, 10);
  assert.ok(Math.abs(g.am + g.mb - g.length) < 1e-12);
  assert.ok(Math.abs(distance(g.a, g.m) - g.am) < 1e-12 && Math.abs(distance(g.m, g.b) - g.mb) < 1e-12);
  assert.equal(settle(s), false);
  s.am = 5.04; // within half a slider step: snaps
  assert.equal(settle(s), true);
  g = segment(s);
  assert.equal(g.am, g.mb);
  assert.equal(g.am, g.length / 2);
  assert.deepEqual(g.m, g.mid);
  assert.deepEqual(g.m, [6, 4]);
  s.am = 5.2;
  assert.equal(settle(s), false);
  // an irrational length still has a reachable midpoint
  Object.assign(s, { ax: 1, ay: 1, bx: 3, by: 2, am: 1.1 });
  assert.equal(settle(s), true);
  assert.equal(s.am, Math.sqrt(5) / 2);
});

test("forged midpoint state is clamped", () => {
  const g = segment({ ax: -50, ay: 1e9, bx: NaN, by: "x", am: 1e9 });
  assert.deepEqual(g.a, [0, H]);
  assert.deepEqual(g.b, [10, 7]);
  assert.equal(g.am, g.length);
  const same = segment({ ax: W, ay: 3, bx: W, by: 3, am: -4 });
  assert.ok(same.length > 0);
  assert.equal(same.am, 0);
});

test("lists: parsing drops junk, editing keeps them valid", () => {
  assert.deepEqual(parsePoints("1,2;1,2;99,1;x;3,4;-1,2;1.5,2"), [[1, 2], [3, 4]]);
  assert.equal(parsePoints("0,0;1,0;2,0;3,0;4,0;5,0;6,0;7,0;8,0;9,0").length, MAX_POINTS);
  assert.deepEqual(parsePoints(undefined), []);
  assert.equal(formatObjects(parseObjects("l:0-1;l:1-0;r:0-1;r:1-0;s:0-0;s:0-5;q:0-1;l:0-1", 2)), "l:0-1;r:0-1;r:1-0");
  const s = initialState();
  assert.equal(formatPoints(parsePoints(s.points)), s.points);
  assert.equal(formatObjects(parseObjects(s.objects, 5)), s.objects);
  assert.ok(!addPoint(s, 1, 6)); // taken
  assert.ok(addPoint(s, ...freeSpot(s)));
  assert.equal(parsePoints(s.points).length, 6);
  assert.ok(addObject(s, "s", 0, 5));
  assert.ok(!addObject(s, "s", 5, 0)); // the same segment
  assert.ok(!addObject(s, "s", 0, 7)); // no such point
  assert.ok(!movePoint(s, 0, 5, 4)); // onto B
  assert.ok(movePoint(s, 0, 0, 0));
  assert.ok(undo(s)); // the segment
  assert.ok(undo(s) && undo(s) && undo(s)); // the three starting objects
  assert.ok(undo(s)); // then the last point
  assert.equal(parsePoints(s.points).length, 5);
  Object.assign(s, { points: "", objects: "" });
  assert.ok(!undo(s));
});
