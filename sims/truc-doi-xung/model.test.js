import test from "node:test";
import assert from "node:assert/strict";
import { N, initialState, reflect, fromList, toList, mirrorCells, full, count, isSymmetric, toggle, sanitize, SHAPES, shapeOf, axesOf, axisCount, hasCentre, isCorrect, ANSWERS } from "./model.js";

test("reflection of grid cells across each axis", () => {
  assert.deepEqual(reflect(0, 0, "vertical"), [0, N - 1]);
  assert.deepEqual(reflect(2, 5, "vertical"), [2, 2]);
  assert.deepEqual(reflect(0, 3, "horizontal"), [N - 1, 3]);
  assert.deepEqual(reflect(1, 6, "diagonal"), [6, 1]);
  assert.deepEqual(reflect(4, 4, "diagonal"), [4, 4]); // a cell on the diagonal is its own image
  assert.deepEqual(reflect(0, 1, "center"), [N - 1, N - 2]);
  for (const axis of ["vertical", "horizontal", "diagonal", "center"])
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        const [r2, c2] = reflect(r, c, axis);
        assert.ok(r2 >= 0 && r2 < N && c2 >= 0 && c2 < N);
        assert.deepEqual(reflect(r2, c2, axis), [r, c], `${axis} twice is the identity`);
        // the axis is the perpendicular bisector: same distance on each side (cell centres r + 0.5)
        if (axis === "vertical") assert.equal(c + 0.5 - N / 2, -(c2 + 0.5 - N / 2));
        if (axis === "horizontal") assert.equal(r + 0.5 - N / 2, -(r2 + 0.5 - N / 2));
        // the centre O is the midpoint of a cell and its image
        if (axis === "center") assert.deepEqual([(r + r2 + 1) / 2, (c + c2 + 1) / 2], [N / 2, N / 2]);
      }
  // vertical then horizontal = half-turn about O
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) assert.deepEqual(reflect(...reflect(r, c, "vertical"), "horizontal"), reflect(r, c, "center"));
});

test("the drawn half and its image make a symmetric figure", () => {
  const s = initialState();
  const f = full(s.cells, "vertical");
  assert.equal(count(f), 2 * count(s.cells)); // the start drawing sits fully left of the axis
  assert.ok(isSymmetric(f, "vertical"));
  assert.ok(!isSymmetric(s.cells, "vertical"));
  const d = fromList([[0, 0], [1, 0], [1, 1]]);
  assert.equal(count(full(d, "diagonal")), 4); // (0,0) and (1,1) are on the diagonal
  assert.deepEqual(toList(mirrorCells(fromList([[0, 1]]), "horizontal")), [[N - 1, 1]]);
  assert.equal(toggle(toggle(s.cells, 7, 7, true), 7, 7, false), s.cells);
});

test("a shape symmetric about both axes is centrally symmetric", () => {
  let seed = 3;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let k = 0; k < 300; k++) {
    let cells = fromList(Array.from({ length: 1 + Math.floor(rand() * 10) }, () => [Math.floor(rand() * N), Math.floor(rand() * N)]));
    cells = full(full(cells, "vertical"), "horizontal");
    assert.ok(isSymmetric(cells, "vertical") && isSymmetric(cells, "horizontal"));
    assert.ok(isSymmetric(cells, "center"));
  }
  for (const sh of SHAPES) {
    const axes = axesOf(sh);
    const both = sh.circle || (axes.includes(0) && axes.includes(90));
    if (both) assert.ok(hasCentre(sh), sh.name);
  }
  // the converse does not hold: N and the parallelogram have a centre but no axis
  assert.ok(hasCentre(shapeOf("letterN")) && axisCount(shapeOf("letterN")) === 0);
  assert.ok(hasCentre(shapeOf("parallelogram")) && axisCount(shapeOf("parallelogram")) === 0);
});

test("axis count of each built-in shape", () => {
  const want = { letterA: 1, letterH: 2, letterE: 1, letterN: 0, square: 4, rectangle: 2, triangle: 3, trapezoid: 1, rhombus: 2, hexagon: 6, parallelogram: 0, circle: Infinity };
  for (const sh of SHAPES) assert.equal(axisCount(sh), want[sh.key], sh.name);
  assert.deepEqual(axesOf(shapeOf("square")), [0, 45, 90, 135]);
  assert.deepEqual(axesOf(shapeOf("letterA")), [90]);
  assert.deepEqual(axesOf(shapeOf("letterE")), [0]);
  assert.deepEqual(axesOf(shapeOf("triangle")), [30, 90, 150]);
  const centres = { letterH: true, letterN: true, square: true, rectangle: true, rhombus: true, hexagon: true, parallelogram: true, circle: true };
  for (const sh of SHAPES) assert.equal(hasCentre(sh), !!centres[sh.key], `tâm đối xứng: ${sh.name}`);
});

test("checking the learner's answer", () => {
  assert.ok(isCorrect(shapeOf("square"), 4));
  assert.ok(!isCorrect(shapeOf("square"), 2));
  assert.ok(isCorrect(shapeOf("circle"), -1));
  assert.ok(!isCorrect(shapeOf("circle"), 6));
  assert.ok(!isCorrect(shapeOf("hexagon"), -1));
  for (const sh of SHAPES) assert.equal(ANSWERS.filter(a => isCorrect(sh, a)).length, 1, `exactly one right button for ${sh.name}`);
});

test("forged grids are replaced", () => {
  const base = initialState();
  assert.equal(sanitize({ cells: "2".repeat(N * N) }, base).cells, base.cells);
  assert.equal(sanitize({ cells: "1" }, base).cells, base.cells);
  assert.equal(sanitize({ cells: "1".repeat(N * N), axis: "diagonal" }, base).cells, "1".repeat(N * N));
  assert.deepEqual(sanitize({ _tried: "x", mirror: "yes" }, base)._tried, []);
  assert.equal(sanitize({ mirror: "yes" }, base).mirror, true);
});
