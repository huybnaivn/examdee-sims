import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState, CELLS, ORGANELLES, LAYOUT, has, present, insideBody, hitTest, compare,
  quizOrder, quizTotal, quizStep, quizScore, quizDone, quizTarget, submitAnswer, nextQuestion, restartQuiz,
} from "./model.js";

const only = id => Object.keys(CELLS).filter(cell => has(cell, id));

test("among eukaryotes, only the plant cell has a cell wall, chloroplasts and a large vacuole", () => {
  for (const id of ["thanh-te-bao", "luc-lap", "khong-bao"]) {
    assert.equal(has("plant", id), true, id);
    assert.equal(has("animal", id), false, id);
  }
  assert.deepEqual(only("luc-lap"), ["plant"]);
  assert.deepEqual(only("khong-bao"), ["plant"]);
});

test("a prokaryote has a cell wall and ribosomes but no nucleus and no membrane-bound organelle", () => {
  assert.equal(has("prokaryote", "thanh-te-bao"), true);
  assert.equal(has("prokaryote", "ribosome"), true);
  assert.equal(has("prokaryote", "nhan"), false);
  assert.equal(has("prokaryote", "vung-nhan"), true);
  assert.deepEqual(present("prokaryote").filter(id => ORGANELLES[id].membrane), []);
  assert.deepEqual(only("vung-nhan"), ["prokaryote"]);
});

test("every cell has a plasma membrane, cytoplasm and ribosomes; eukaryotes share the membrane-bound organelles", () => {
  for (const id of ["mang-sinh-chat", "te-bao-chat", "ribosome"]) assert.equal(only(id).length, 3, id);
  for (const id of ["nhan", "luoi-noi-chat", "bo-may-golgi", "ti-the"]) assert.deepEqual(only(id), ["animal", "plant"], id);
  assert.deepEqual(only("lysosome"), ["animal"]);
  assert.deepEqual(only("trung-the"), ["animal"]);
  // ribosomes and centrosomes have no membrane; the others listed here do
  assert.equal(ORGANELLES.ribosome.membrane, false);
  assert.equal(ORGANELLES["trung-the"].membrane, false);
  for (const id of ["nhan", "luoi-noi-chat", "bo-may-golgi", "ti-the", "luc-lap", "khong-bao", "lysosome"]) assert.equal(ORGANELLES[id].membrane, true, id);
});

test("each diagram draws exactly the structures its cell type has", () => {
  for (const cell of Object.keys(CELLS)) {
    const drawn = [...LAYOUT[cell].layers.map(l => l[0]), "te-bao-chat", ...LAYOUT[cell].parts.map(p => p[0])];
    assert.deepEqual([...drawn].sort(), present(cell).sort(), cell);
    assert.equal(new Set(drawn).size, drawn.length, cell);
  }
});

test("every organelle lies inside the cytoplasm and its centre can be tapped", () => {
  for (const cell of Object.keys(CELLS)) {
    const { body, layers, parts, free } = LAYOUT[cell];
    const inner = layers.at(-1)[1];
    for (const [id, ellipses] of parts) {
      for (const p of ellipses) {
        assert.equal(hitTest(cell, p.x, p.y), id, `${cell} ${id} at ${p.x}, ${p.y}`);
        if (id !== "roi") assert.equal(insideBody(body, inner, p.x, p.y), true, `${cell} ${id} is inside the cell`);
      }
    }
    assert.equal(hitTest(cell, ...free), "te-bao-chat", cell);
  }
});

test("hit-testing maps taps to the layers of the cell boundary", () => {
  // plant: top edge at y = 6; wall 3,5 thick, then the membrane down to 5,5
  assert.equal(hitTest("plant", 50, 7.5), "thanh-te-bao");
  assert.equal(hitTest("plant", 50, 10.5), "mang-sinh-chat");
  assert.equal(hitTest("plant", 50, 13), "te-bao-chat");
  assert.equal(hitTest("plant", 9.5, 40), "thanh-te-bao");
  // animal: no wall, the membrane is the outermost layer
  assert.equal(hitTest("animal", 50, 7.5), "mang-sinh-chat");
  assert.equal(hitTest("animal", 11.5, 40), "mang-sinh-chat");
  assert.equal(hitTest("animal", 50, 11), "te-bao-chat");
  // prokaryote: wall, membrane, then cytoplasm; the flagellum is outside the body
  assert.equal(hitTest("prokaryote", 44, 17.5), "thanh-te-bao");
  assert.equal(hitTest("prokaryote", 44, 20.3), "mang-sinh-chat");
  assert.equal(hitTest("prokaryote", 44, 23.5), "te-bao-chat");
  assert.equal(hitTest("prokaryote", 44, 40), "vung-nhan");
  assert.equal(hitTest("prokaryote", 95, 41), "roi");
});

test("hit-testing: specific organelles, overlaps and misses", () => {
  assert.equal(hitTest("plant", 54, 44), "khong-bao");
  assert.equal(hitTest("plant", 25, 24), "nhan");
  assert.equal(hitTest("plant", 66, 20), "luc-lap");
  assert.equal(hitTest("animal", 46, 38), "nhan");
  assert.equal(hitTest("animal", 29, 40), "trung-the");
  assert.equal(hitTest("animal", 37, 58), "lysosome");
  // the same point means different things in different cells
  assert.equal(hitTest("animal", 66, 55), "bo-may-golgi");
  assert.equal(hitTest("plant", 66, 55), "khong-bao");
  // outside the cell, and nonsense input
  assert.equal(hitTest("plant", 1, 1), "");
  assert.equal(hitTest("animal", 12, 10), "");
  assert.equal(hitTest("prokaryote", 44, 70), "");
  assert.equal(hitTest("plant", NaN, 10), "");
  assert.equal(hitTest("fungus", 50, 40), "");
});

test("comparison counts the structures only one of the two cells has", () => {
  const ap = compare("animal", "plant");
  assert.deepEqual(ap.rows.filter(r => r.a !== r.b).map(r => r.id).sort(), ["khong-bao", "luc-lap", "lysosome", "thanh-te-bao", "trung-the"]);
  assert.equal(ap.differences, 5);
  assert.equal(ap.shared, 7);
  assert.equal(compare("prokaryote", "animal").differences, 10);
  assert.equal(compare("prokaryote", "animal").shared, 3);
  assert.equal(compare("prokaryote", "plant").differences, 9);
  assert.equal(compare("prokaryote", "plant").shared, 4);
  // symmetric, and a cell does not differ from itself
  assert.equal(compare("plant", "animal").differences, 5);
  assert.equal(compare("plant", "plant").differences, 0);
  assert.equal(compare("plant", "plant").shared, present("plant").length);
});

test("quiz order: every structure of the cell once, fixed by the seed", () => {
  for (const cell of Object.keys(CELLS)) {
    assert.deepEqual(quizOrder(cell, 5).sort(), present(cell).sort());
    assert.deepEqual(quizOrder(cell, 5), quizOrder(cell, 5));
  }
  assert.notDeepEqual(quizOrder("plant", 1), quizOrder("plant", 2));
});

test("quiz checking: all correct gives a full score", () => {
  const s = { ...initialState(), mode: "quiz", cell: "animal" };
  const total = quizTotal(s);
  assert.equal(total, 9);
  let last;
  for (let i = 0; i < total; i++) {
    assert.equal(quizStep(s), i);
    s.answer = quizTarget(s);
    last = submitAnswer(s);
    assert.equal(last.correct, true);
    assert.equal(last.finished, i === total - 1);
    nextQuestion(s);
  }
  assert.deepEqual(last, { correct: true, finished: true, score: 9, total: 9 });
  assert.equal(quizDone(s), true);
  assert.equal(quizTarget(s), "");
  assert.equal(quizScore(s), 9);
});

test("quiz checking: a wrong answer scores nothing and the quiz moves on", () => {
  const s = { ...initialState(), mode: "quiz", cell: "prokaryote" };
  const target = quizTarget(s);
  s.answer = target === "nhan" ? "ti-the" : "nhan"; // a prokaryote has no nucleus, so this is always wrong
  assert.deepEqual(submitAnswer(s), { correct: false, finished: false, score: 0, total: 7 });
  nextQuestion(s);
  assert.equal(quizStep(s), 1);
  assert.equal(s.answer, "");
  s.answer = quizTarget(s);
  assert.equal(submitAnswer(s).score, 1);
  // nothing to score without an answer, or after the end
  nextQuestion(s);
  assert.equal(submitAnswer(s), null);
  nextQuestion(s);
  assert.equal(quizStep(s), 2);
  restartQuiz(s, true);
  assert.deepEqual([s.quizStep, s.quizScore, s.answer, s.quizSeed], [0, 0, "", 2]);
});

test("a forged quiz position or score is clamped", () => {
  const s = { ...initialState(), cell: "plant", quizStep: 99, quizScore: 1e9 };
  assert.equal(quizStep(s), 10);
  assert.equal(quizScore(s), 10);
  assert.equal(quizDone(s), true);
  s.answer = "nhan";
  assert.equal(submitAnswer(s), null);
  Object.assign(s, { quizStep: -3, quizScore: -5, answer: "" });
  assert.equal(quizStep(s), 0);
  assert.equal(quizScore(s), 0);
  Object.assign(s, { quizStep: NaN, quizScore: 7 });
  assert.equal(quizStep(s), 0);
  assert.equal(quizScore(s), 0);
});

test("initial state: a plant cell with a chloroplast selected", () => {
  const s = initialState();
  assert.equal(has(s.cell, s.selected), true);
  assert.equal(s.mode, "explore");
  assert.notEqual(s.cell, s.other);
});
