import test from "node:test";
import assert from "node:assert/strict";
import { NETS, GOAL, GRID_W, GRID_H, polyominoes, canonical, checkNet, oppositePairs, foldNet, surfaceArea, initialState, parseCells, parseFound, toggleCell, checkPuzzle, rotate, step } from "./model.js";

const cells = str => str.split(";").map(p => p.split(",").map(Number));
const CROSS = cells("1,0;0,1;1,1;2,1;1,2;1,3");
const BLOCK = cells("0,0;1,0;2,0;0,1;1,1;2,1"); // 2 × 3
const ROW6 = cells("0,0;1,0;2,0;3,0;4,0;5,0");
const ROW5_PLUS = cells("0,0;1,0;2,0;3,0;4,0;2,1"); // a row of five with one square under it
const centre = pts => [0, 1, 2].map(k => pts.reduce((sum, p) => sum + p[k], 0) / 4);
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

/** Independent check by really folding: all corners on a unit cube and six different faces. */
function foldsToCube(shape) {
  const faces = foldNet(shape, 1);
  const all = faces.flat();
  const lo = [0, 1, 2].map(k => Math.min(...all.map(p => p[k])));
  const onCube = all.every(p => p.every((v, k) => Math.abs(v - lo[k]) < 1e-9 || Math.abs(v - lo[k] - 1) < 1e-9));
  const centres = new Set(faces.map(f => centre(f).map(v => v.toFixed(6)).join()));
  return onCube && centres.size === 6;
}

test("there are 35 hexominoes and exactly 11 of them are nets of a cube", () => {
  const all = polyominoes(6);
  assert.equal(all.length, 35);
  assert.deepEqual([1, 2, 3, 4, 5].map(n => polyominoes(n).length), [1, 1, 2, 5, 12]);
  assert.equal(all.filter(c => checkNet(c).valid).length, 11);
  assert.equal(NETS.length, 11);
  assert.equal(new Set(NETS.map(canonical)).size, 11); // all different up to rotation and reflection
  NETS.forEach((net, i) => assert.equal(checkNet(net).net, i + 1));
});

test("the rolling check agrees with actually folding, for all 35 hexominoes", () => {
  for (const shape of polyominoes(6)) assert.equal(checkNet(shape).valid, foldsToCube(shape), JSON.stringify(shape));
});

test("valid nets are accepted in any position, rotation or mirror image", () => {
  assert.ok(checkNet(CROSS).valid);
  for (const net of NETS) {
    const turned = net.map(([x, y]) => [7 - y, x + 3]);
    const mirrored = net.map(([x, y]) => [9 - x, y]);
    for (const shape of [net, turned, mirrored, [...net].reverse()]) {
      const res = checkNet(shape);
      assert.ok(res.valid);
      assert.equal(res.net, checkNet(net).net);
      assert.deepEqual([...res.faces].sort(), [0, 1, 2, 3, 4, 5]);
    }
  }
});

test("invalid shapes are rejected, with the reason", () => {
  assert.equal(checkNet(BLOCK).reason, "block");
  assert.equal(checkNet(ROW6).reason, "overlap");
  assert.equal(checkNet(ROW5_PLUS).reason, "overlap");
  assert.ok(checkNet(ROW5_PLUS).clash.length >= 2);
  assert.equal(checkNet(cells("0,0;1,0;2,0;3,0;4,0")).reason, "count"); // a row of five squares only
  assert.equal(checkNet([]).reason, "count");
  assert.equal(checkNet([...CROSS, [5, 5]]).reason, "count");
  assert.equal(checkNet(cells("0,0;1,0;2,0;3,0;1,1;5,3")).reason, "apart");
  assert.equal(checkNet(cells("0,0;1,1;2,2;3,3;4,4;5,5")).reason, "apart"); // touching at corners only
  assert.equal(checkNet(cells("0,0;1,0;0,1;1,1;2,1;3,1")).reason, "block");
  for (const bad of [BLOCK, ROW6, ROW5_PLUS]) {
    assert.equal(checkNet(bad).valid, false);
    assert.equal(checkNet(bad).net, 0);
    assert.deepEqual(oppositePairs(bad), []);
  }
});

test("opposite faces: three pairs, and each pair really ends up on opposite sides of the cube", () => {
  // the cross: the arms are opposite, and the two squares of the long bar that are two apart
  const pairs = oppositePairs(CROSS).map(p => p.map(i => CROSS[i].join()).sort().join(" | ")).sort();
  assert.deepEqual(pairs, ["0,1 | 2,1", "1,0 | 1,2", "1,1 | 1,3"]);
  for (const net of NETS) {
    const pairsOf = oppositePairs(net);
    assert.equal(pairsOf.length, 3);
    assert.deepEqual(pairsOf.flat().sort(), [0, 1, 2, 3, 4, 5]);
    const c = foldNet(net, 1).map(centre);
    for (let i = 0; i < 6; i++) {
      for (let j = i + 1; j < 6; j++) {
        const opposite = pairsOf.some(p => p.includes(i) && p.includes(j));
        assert.ok(Math.abs(dist(c[i], c[j]) - (opposite ? 1 : Math.SQRT1_2)) < 1e-9);
      }
    }
    // squares that share an edge in the net are never opposite
    for (const [i, j] of pairsOf) assert.ok(Math.abs(net[i][0] - net[j][0]) + Math.abs(net[i][1] - net[j][1]) > 1);
  }
});

test("folding keeps every face a unit square and is flat at 0", () => {
  for (const net of NETS) {
    for (const t of [0, 0.3, 0.55, 1]) {
      for (const f of foldNet(net, t)) {
        for (let k = 0; k < 4; k++) assert.ok(Math.abs(dist(f[k], f[(k + 1) % 4]) - 1) < 1e-9);
        assert.ok(Math.abs(dist(f[0], f[2]) - Math.SQRT2) < 1e-9);
      }
    }
    assert.ok(foldNet(net, 0).flat().every(p => p[2] === 0));
    assert.ok(foldNet(net, 0.5).flat().every(p => p[2] > -1e-9)); // folds upwards, off the table
  }
  assert.deepEqual(foldNet(CROSS, 7), foldNet(CROSS, 1)); // forged fold is clamped
});

test("surface area of the cube is 6a², the area of its net", () => {
  assert.equal(surfaceArea(1), 6);
  assert.equal(surfaceArea(3), 54);
  assert.equal(surfaceArea(2.5), 37.5);
});

test("puzzle: placing squares, at most six, on the grid only", () => {
  const s = initialState();
  assert.equal(toggleCell(s, 1, 0), "placed");
  assert.equal(toggleCell(s, 1, 1), "placed");
  assert.equal(toggleCell(s, 1, 0), "removed");
  assert.equal(s.cells, "1,1");
  for (const [x, y] of CROSS) toggleCell(s, x, y); // 1,1 is taken off again by the cross, so add it back
  toggleCell(s, 1, 1);
  assert.equal(parseCells(s.cells).length, 6);
  assert.equal(toggleCell(s, 5, 4), "full");
  assert.equal(parseCells(s.cells).length, 6);
  assert.deepEqual(parseCells(`0,0;0,0;${GRID_W},0;0,${GRID_H};x;-1,2;3,4`), [[0, 0], [3, 4]]);
  assert.equal(parseCells("0,0;1,0;2,0;3,0;4,0;5,0;0,1;1,1").length, 6);
  assert.deepEqual(parseCells(undefined), []);
  assert.deepEqual(parseFound("3,3,x,0,12,7,1.5"), [3, 7]);
});

test("puzzle: a check records each different net once; five of them is the goal", () => {
  const s = initialState();
  s.cells = CROSS.map(c => c.join()).join(";");
  let res = checkPuzzle(s);
  assert.ok(res.valid && res.isNew && res.count === 1 && s.checked);
  res = checkPuzzle(s);
  assert.ok(res.valid && !res.isNew && res.count === 1);
  s.cells = CROSS.map(([x, y]) => [y, x].join()).join(";"); // the same net turned over: not new
  assert.ok(!checkPuzzle(s).isNew);
  s.cells = BLOCK.map(c => c.join()).join(";");
  res = checkPuzzle(s);
  assert.ok(!res.valid && !res.isNew && res.count === 1);
  let count = 1;
  for (const net of NETS) {
    s.cells = net.map(c => c.join()).join(";");
    res = checkPuzzle(s);
    if (res.isNew) count++;
    assert.equal(res.count, count);
  }
  assert.equal(count, 11);
  assert.ok(GOAL === 5 && parseFound(s.found).length === 11);
  // every net fits on the puzzle grid
  for (const net of NETS) assert.ok(net.every(([x, y]) => x < GRID_W && y < GRID_H));
});

test("the view rotation keeps lengths", () => {
  for (const p of [[1, 2, 3], [-4, 0.5, 2]]) {
    assert.ok(Math.abs(Math.hypot(...rotate(p, 30, 32)) - Math.hypot(...p)) < 1e-12);
  }
});

test("animation: folds to 100 % in 2,5 s, stops, and the next run unfolds", () => {
  const s = { ...initialState(), fold: 0, dir: 1 };
  let ticks = 0;
  while (!step(s, 1 / 120)) ticks++;
  assert.equal(s.fold, 100);
  assert.equal(s.dir, -1);
  assert.ok(Math.abs(ticks / 120 - 2.5) < 0.05);
  assert.equal(step(s, 1 / 120), false);
  assert.ok(s.fold < 100);
  while (!step(s, 1 / 120));
  assert.equal(s.fold, 0);
  assert.equal(s.dir, 1);
  const forged = { fold: NaN, dir: 7 };
  step(forged, 1);
  assert.equal(forged.fold, 40);
});
