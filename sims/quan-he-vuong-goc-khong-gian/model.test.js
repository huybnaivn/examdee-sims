import test from "node:test";
import assert from "node:assert/strict";
import { initialState, SOLIDS, EXAMPLES, points, element, relate, relation, planeOf, project, dot, angleOf, rotate, nameAt, quizPlane, frontFaces, segmentVisible, IN, PARALLEL, PERPENDICULAR, OBLIQUE } from "./model.js";

const cube = { ...initialState(), solid: "cube" };
const pyr = (edge = "a") => ({ ...initialState(), solid: "pyramid", edge });
const rel = (s, a, b) => relate(element(s, a), element(s, b));
const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);
const deg = r => (r * 180) / Math.PI;

test("line–plane angle is the angle with the projection", () => {
  const r = rel(cube, "A'C", "(ABCD)");
  assert.equal(r.code, OBLIQUE);
  assert.equal(nameAt(cube, r.I), "C");
  assert.equal(nameAt(cube, r.M), "A'");
  assert.equal(nameAt(cube, r.H), "A"); // projection of A'C is AC
  near(r.angle, deg(Math.atan(1 / Math.SQRT2))); // tan = AA'/AC = 1/√2, ≈ 35,26°
  near(rel(cube, "A'B", "(ABCD)").angle, 45);
  // for every line and plane: the angle with the projection equals arcsin |u·n|
  for (const kind of [cube, pyr(), pyr("a2")]) {
    for (const l of SOLIDS[kind.solid].lines) {
      for (const p of SOLIDS[kind.solid].planes) {
        const e = element(kind, l);
        const out = relate(e, element(kind, p));
        const u = e.q.map((v, i) => v - e.p[i]);
        const n = planeOf(element(kind, p).pts).n;
        const sin = Math.abs(dot(u, n)) / Math.hypot(...u);
        near(out.angle, deg(Math.asin(Math.min(1, sin))), 1e-5); // asin is ill-conditioned near 90°
        if (out.code === OBLIQUE) {
          // MH is perpendicular to the plane, and H lies in it
          const pl = planeOf(element(kind, p).pts);
          near(dot(pl.n, out.H) - pl.d, 0);
          const mh = out.M.map((v, i) => v - out.H[i]);
          near(Math.abs(dot(mh, pl.n)), Math.hypot(...mh));
        }
      }
    }
  }
});

test("perpendicularity by dot products", () => {
  // AC' ⊥ (A'BD): AC' is perpendicular to the two crossing lines A'B and A'D of the plane
  const P = points(cube);
  const v = (a, b) => P[b].map((x, i) => x - P[a][i]);
  assert.equal(dot(v("A", "C'"), v("A'", "B")), 0);
  assert.equal(dot(v("A", "C'"), v("A'", "D")), 0);
  for (const [s, a, b] of [[cube, "AC'", "(A'BD)"], [cube, "BD", "(ACC'A')"], [cube, "AA'", "(ABCD)"], [pyr(), "SO", "(ABCD)"], [pyr(), "BD", "(SAC)"], [pyr("a2"), "AC", "(SBD)"], [pyr(), "CD", "(SOM)"]]) {
    const r = rel(s, a, b);
    assert.equal(r.code, PERPENDICULAR, `${a} ⊥ ${b}`);
    assert.equal(r.angle, 90);
  }
  for (const [s, a, b] of [[cube, "(ACC'A')", "(BDD'B')"], [cube, "(A'BD)", "(ACC'A')"], [pyr(), "(SAC)", "(SBD)"], [pyr(), "(SOM)", "(ABCD)"], [pyr(), "(SOM)", "(SCD)"]]) {
    const r = rel(s, a, b);
    assert.equal(r.code, PERPENDICULAR, `${a} ⊥ ${b}`);
    near(r.angle, 90);
    near(dot(r.v1, r.v2), 0); // the two lines ⊥ the common line are ⊥ each other
  }
  assert.notEqual(rel(cube, "A'C", "(A'BD)").code, PERPENDICULAR);
});

test("parallel and contained", () => {
  assert.equal(rel(cube, "BD", "(CB'D')").code, PARALLEL);
  assert.equal(rel(cube, "AB", "(A'B'C'D')").code, PARALLEL);
  assert.equal(rel(pyr(), "AB", "(SCD)").code, PARALLEL);
  assert.equal(rel(cube, "(A'BD)", "(CB'D')").code, PARALLEL);
  assert.equal(rel(cube, "(ABCD)", "(A'B'C'D')").code, PARALLEL);
  assert.equal(rel(cube, "AB", "(ABCD)").code, IN);
  assert.equal(rel(pyr(), "SM", "(SCD)").code, IN);
  assert.equal(rel(cube, "(ABCD)", "(ABCD)").code, IN);
  for (const [a, b] of [["BD", "(CB'D')"], ["(A'BD)", "(CB'D')"]]) assert.equal(rel(cube, a, b).angle, 0);
});

test("textbook values for the cube and the regular pyramid", () => {
  near(rel(cube, "(A'BD)", "(ABCD)").angle, deg(Math.atan(Math.SQRT2))); // ≈ 54,74°
  near(rel(cube, "(ABC'D')", "(ABCD)").angle, 45);
  // all edges a: SA makes 45° with the base, (SCD) makes arctan √2
  const P = points(pyr());
  near(Math.hypot(...P.S.map((x, i) => x - P.A[i])), 1);
  near(rel(pyr(), "SA", "(ABCD)").angle, 45);
  near(rel(pyr(), "(SCD)", "(ABCD)").angle, deg(Math.atan(Math.SQRT2)));
  // SA = a√2: cos = OA/SA = 1/2, 60°; tan of the face angle = SO/OM = √6
  const Q = points(pyr("a2"));
  near(Math.hypot(...Q.S.map((x, i) => x - Q.A[i])), Math.SQRT2);
  near(rel(pyr("a2"), "SA", "(ABCD)").angle, 60);
  near(rel(pyr("a2"), "(SCD)", "(ABCD)").angle, deg(Math.atan(Math.sqrt(6))));
  // the dihedral construction of (SCD), (ABCD) is at M, the midpoint of CD: angle SMO
  const r = rel(pyr(), "(SCD)", "(ABCD)");
  assert.equal(nameAt(pyr(), r.K), "M");
  near(r.open, r.angle);
  // every example parses to real points and has the stated relation
  for (const [, solid, edge, a, b, text] of EXAMPLES) {
    const s = { ...initialState(), solid, edge: edge ?? "a" };
    const out = rel(s, a, b);
    assert.ok(Number.isFinite(out.angle), text);
    if (text.includes("⊥")) assert.equal(out.code, PERPENDICULAR, text);
    if (text.includes("//")) assert.equal(out.code, PARALLEL, text);
    for (const id of [a, b]) assert.ok(SOLIDS[solid].lines.includes(id) || SOLIDS[solid].planes.includes(id), id);
  }
  assert.equal(relation(initialState()).code, OBLIQUE);
});

test("each quiz plane has at least one perpendicular element", () => {
  for (const solid of ["cube", "pyramid"]) {
    const s = { ...initialState(), solid };
    SOLIDS[solid].quiz.forEach((p, i) => {
      assert.equal(quizPlane({ ...s, quiz: i }), p);
      const hits = [...SOLIDS[solid].lines, ...SOLIDS[solid].planes].filter(e => rel(s, e, p).code === PERPENDICULAR);
      assert.ok(hits.length > 0, p);
    });
    assert.equal(quizPlane({ ...s, quiz: -1 }), SOLIDS[solid].quiz.at(-1));
    assert.equal(quizPlane({ ...s, quiz: NaN }), SOLIDS[solid].quiz[0]);
  }
});

test("rotation preserves lengths and angles", () => {
  const P = points(cube);
  for (const [yaw, pitch] of [[0, 0], [-28, 22], [137, -40], [359, 60]]) {
    const R = k => rotate(P[k], yaw, pitch);
    for (const [a, b] of [["A", "B"], ["A", "C'"], ["B", "D"], ["A'", "C"]]) {
      near(Math.hypot(...R(a).map((x, i) => x - R(b)[i])), Math.hypot(...P[a].map((x, i) => x - P[b][i])));
    }
    const u = R("C'").map((x, i) => x - R("A")[i]);
    const v = R("B").map((x, i) => x - R("A")[i]);
    near(angleOf(u, v), angleOf(P["C'"], P.B));
  }
});

test("hidden edges: from the default view the back edges are dashed", () => {
  const s = initialState();
  const faces = frontFaces(s, s.yaw, s.pitch, 8);
  assert.equal(faces.filter(f => f.front).length, 3); // a cube seen from a corner shows 3 faces
  const P = points(s);
  assert.ok(segmentVisible(s, P.A, P.B, faces));
  assert.ok(!segmentVisible(s, P.A, P.D, faces)); // AD is behind
  assert.ok(!segmentVisible(s, P["A'"], P.C, faces)); // a diagonal through the inside
  assert.ok(segmentVisible(s, P["A'"], P["C'"], faces)); // on the top face
  const top = project(planeOf([P.A, P.B, P.C]), P["C'"]);
  assert.equal(nameAt(s, top), "C");
});
