import test from "node:test";
import assert from "node:assert/strict";
import { initialState, screenShadow, pointUmbra, halfWidths, eclipse, order, placed, SCREEN_X } from "./model.js";

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);
const point = { ...initialState(), source: "point" };

test("point source: umbra by similar triangles, h' / h = (source–screen) / (source–object)", () => {
  for (const [sourceX, objectX, objectSize] of [[0, 50, 10], [10, 30, 12], [20, 80, 6]]) {
    const out = screenShadow({ ...point, sourceX, objectX, objectSize });
    near(out.umbra, (objectSize * (SCREEN_X - sourceX)) / (objectX - sourceX));
    near(out.umbra, pointUmbra(objectSize, objectX - sourceX, SCREEN_X - sourceX));
  }
  near(screenShadow({ ...point, sourceX: 0, objectX: 50, objectSize: 10 }).umbra, 20);
});

test("penumbra appears only for an extended source", () => {
  near(screenShadow({ ...point, bulbSize: 20 }).penumbra, 0);
  const bulb = screenShadow({ ...initialState(), source: "bulb", bulbSize: 8 });
  assert.ok(bulb.penumbra > 0);
  // the whole shadow is wider than the umbra by the penumbra on both sides
  near(bulb.outer, bulb.umbra + 2 * bulb.penumbra);
  // a bigger bulb: smaller umbra, wider penumbra
  const big = screenShadow({ ...initialState(), source: "bulb", bulbSize: 16 });
  assert.ok(big.umbra < bulb.umbra && big.penumbra > bulb.penumbra);
});

test("extended source: shadow edges follow the edge-to-edge lines", () => {
  // bulb d = 10 at x = 0, disc h = 10 at x = 50, screen at 100: umbra edges are parallel, penumbra doubles
  const out = screenShadow({ ...initialState(), source: "bulb", bulbSize: 10, sourceX: 0, objectX: 50, objectSize: 10 });
  near(out.umbra, 10);
  near(out.outer, 30);
  near(halfWidths(5, 5, 50, 50).u, 5);
  // a bulb bigger than the object: the umbra cone closes before the screen
  const closed = screenShadow({ ...initialState(), source: "bulb", bulbSize: 20, sourceX: 0, objectX: 50, objectSize: 6 });
  near(closed.umbra, 0);
  assert.ok(closed.penumbra > 0);
});

test("moving the object towards the source enlarges the shadow", () => {
  for (const source of ["point", "bulb"]) {
    let last = 0;
    for (const objectX of [80, 60, 40, 25]) {
      const out = screenShadow({ ...initialState(), source, sourceX: 10, objectX });
      assert.ok(out.umbra > last && out.outer > out.umbra - 1e-9);
      last = out.umbra;
    }
  }
});

test("object is never closer than 10 cm to the source, even from a forged state", () => {
  const p = placed({ ...initialState(), sourceX: 40, objectX: 5 });
  near(p.objectX - p.sourceX, 10);
});

test("eclipse type follows the alignment order", () => {
  assert.equal(eclipse(180), "solar-total");
  assert.deepEqual(order(180), ["Mặt Trời", "Mặt Trăng", "Trái Đất"]);
  assert.equal(eclipse(0), "lunar-total");
  assert.deepEqual(order(0), ["Mặt Trời", "Trái Đất", "Mặt Trăng"]);
  assert.equal(eclipse(90), "none");
  assert.equal(eclipse(270), "none");
  // a little off the line: first partial, then nothing
  const solar = [175, 170, 165, 160, 150, 140].map(eclipse);
  assert.ok(solar.includes("solar-partial"));
  assert.equal(solar.at(-1), "none");
  const lunar = [3, 6, 10, 20, 40].map(eclipse);
  assert.ok(lunar.includes("lunar-partial"));
  assert.equal(lunar.at(-1), "none");
  // symmetric above and below the line
  for (const a of [5, 12, 25]) {
    assert.equal(eclipse(180 + a), eclipse(180 - a));
    assert.equal(eclipse(a), eclipse(360 - a));
  }
});
