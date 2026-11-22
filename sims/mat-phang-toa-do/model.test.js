import test from "node:test";
import assert from "node:assert/strict";
import { initialState, snap, quadrant, reflect, isAt, place, target, TREASURES, grid, toScreen, fromScreen, RANGE } from "./model.js";

test("grid points: screen position and back give the same coordinates", () => {
  for (const view of [{ w: 800, h: 600 }, { w: 360, h: 330 }]) {
    const g = grid(view, 30);
    for (let x = -RANGE; x <= RANGE; x += 0.5) {
      for (let y = -RANGE; y <= RANGE; y += 0.5) {
        const [px, py] = toScreen(g, x, y);
        const [bx, by] = fromScreen(g, px, py);
        assert.deepEqual([snap(bx), snap(by)], [x + 0, y + 0]);
        // a click a few pixels off still picks the same grid point
        const [cx, cy] = fromScreen(g, px + 0.2 * g.ppu, py - 0.2 * g.ppu);
        assert.deepEqual([snap(cx), snap(cy)], [x + 0, y + 0]);
      }
    }
    // the origin is the centre of the grid, y grows upwards
    const [ox, oy] = toScreen(g, 0, 0);
    assert.equal(ox, view.w / 2);
    assert.ok(toScreen(g, 0, 1)[1] < oy);
    assert.ok(toScreen(g, 1, 0)[0] > ox);
  }
  assert.equal(snap(100), RANGE);
  assert.equal(snap(-100), -RANGE);
  assert.ok(Object.is(snap(-0.1), 0));
});

test("quadrant from the signs; points on the axes belong to none", () => {
  assert.equal(quadrant(3, 2), 1);
  assert.equal(quadrant(-3, 2), 2);
  assert.equal(quadrant(-0.5, -4), 3);
  assert.equal(quadrant(2, -1.5), 4);
  for (const [x, y] of [[0, 0], [0, 3], [0, -2], [4, 0], [-5, 0]]) assert.equal(quadrant(x, y), 0);
});

test("reflection across the axes and the origin", () => {
  assert.deepEqual(reflect(3, 2, "Ox"), [3, -2]);
  assert.deepEqual(reflect(3, 2, "Oy"), [-3, 2]);
  assert.deepEqual(reflect(3, 2, "O"), [-3, -2]);
  assert.deepEqual(reflect(0, 4, "Oy"), [0, 4]); // a point on Oy is its own image across Oy
  for (const [x, y] of [[1, 2], [-4.5, 3], [2, -6]]) {
    const q = quadrant(x, y);
    assert.equal(quadrant(...reflect(x, y, "Ox")), { 1: 4, 2: 3, 3: 2, 4: 1 }[q]);
    assert.equal(quadrant(...reflect(x, y, "Oy")), { 1: 2, 2: 1, 3: 4, 4: 3 }[q]);
    assert.equal(quadrant(...reflect(x, y, "O")), { 1: 3, 2: 4, 3: 1, 4: 2 }[q]);
    assert.deepEqual(reflect(...reflect(x, y, "Ox"), "Ox"), [x, y]);
  }
});

test("placement checking in the treasure game", () => {
  const s = { ...initialState(), mode: "game" };
  assert.equal(target(s), TREASURES[0]);
  assert.equal(place(s, 4, -3), null); // swapped coordinates are wrong
  assert.equal(place(s, 3, -4), null);
  assert.equal(s.found, 0);
  assert.equal(place(s, -3.1, 3.9), TREASURES[0]); // snapped to (−3; 4)
  assert.equal(s.found, 1);
  for (const t of TREASURES.slice(1)) assert.equal(place(s, t.x, t.y), t);
  assert.equal(target(s), null);
  assert.equal(place(s, 0, 0), null);
  // explore mode never counts, and a forged count stays in range
  const e = initialState();
  assert.equal(place(e, -3, 4), null);
  assert.equal(target({ ...s, found: -7 }), TREASURES[0]);
  assert.equal(target({ ...s, found: 99 }), null);
  assert.ok(isAt(1.5, 3.5, { x: 1.5, y: 3.5 }) && !isAt(3.5, 1.5, { x: 1.5, y: 3.5 }));
  // every treasure is on the grid
  for (const t of TREASURES) assert.deepEqual([snap(t.x), snap(t.y)], [t.x, t.y]);
});
