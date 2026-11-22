import test from "node:test";
import assert from "node:assert/strict";
import {
  ANIMALS, TYPES, THRESHOLD, OUTCOME, initialState, animalOf, placed, isComplete, isCorrect, place, clearTimeline,
  classifiedRight, classifiedCount, allClassified, moultOutcome,
} from "./model.js";

// card number (1-based) that carries a given stage index
const cardOf = (animal, stage) => ANIMALS[animal].cards.indexOf(stage) + 1;

test("stage order and number of stages for each animal", () => {
  assert.deepEqual(ANIMALS.butterfly.stages, ["Trứng", "Sâu bướm", "Nhộng", "Bướm"]);
  assert.deepEqual(ANIMALS.grasshopper.stages, ["Trứng", "Ấu trùng", "Trưởng thành"]);
  assert.deepEqual(ANIMALS.human.stages, ["Hợp tử", "Phôi", "Thai nhi", "Trẻ em", "Người lớn"]);
  assert.deepEqual(Object.values(ANIMALS).map(a => a.stages.length), [4, 3, 5]);
  assert.ok(ANIMALS.butterfly.stages.includes("Nhộng")); // only complete metamorphosis has a pupa
  assert.ok(!ANIMALS.grasshopper.stages.includes("Nhộng"));
  for (const a of Object.values(ANIMALS)) {
    // the cards are a shuffle of all the stages, and not already in order
    assert.deepEqual([...a.cards].sort(), a.stages.map((_, i) => i));
    assert.notDeepEqual(a.cards, a.stages.map((_, i) => i));
  }
});

test("placing the cards in the true order completes the cycle correctly", () => {
  for (const animal of Object.keys(ANIMALS)) {
    const s = { ...initialState(), animal };
    const n = ANIMALS[animal].stages.length;
    for (let stage = 0; stage < n; stage++) {
      assert.ok(!isComplete(s));
      assert.deepEqual(place(s, cardOf(animal, stage)), { stage: stage + 1, position: stage + 1, correct: true });
    }
    assert.ok(isComplete(s) && isCorrect(s));
    assert.deepEqual(placed(s), ANIMALS[animal].stages.map((_, i) => i));
  }
});

test("a wrong order is complete but not correct; a card cannot be placed twice", () => {
  const s = initialState();
  assert.deepEqual(place(s, cardOf("butterfly", 0)), { stage: 1, position: 1, correct: true });
  assert.deepEqual(place(s, cardOf("butterfly", 2)), { stage: 3, position: 2, correct: false }); // pupa before caterpillar
  assert.equal(place(s, cardOf("butterfly", 2)), null);
  assert.equal(place(s, 9), null);
  assert.equal(place(s, 0), null);
  place(s, cardOf("butterfly", 1));
  place(s, cardOf("butterfly", 3));
  assert.ok(isComplete(s));
  assert.ok(!isCorrect(s));
  assert.equal(s.placedButterfly, "0213");
  clearTimeline(s);
  assert.deepEqual(placed(s), []);
  // each animal keeps its own timeline
  const t = { ...initialState(), placedButterfly: "0123", animal: "human" };
  assert.deepEqual(placed(t), []);
  assert.ok(isCorrect(t, "butterfly"));
  assert.equal(place({ ...initialState(), animal: "grasshopper" }, 4), null); // only three cards
});

test("forged state is cleaned", () => {
  assert.deepEqual(placed({ ...initialState(), placedButterfly: "0x0<9>31" }), [0, 3, 1]);
  assert.deepEqual(placed({ ...initialState(), animal: "grasshopper", placedGrasshopper: "3210" }), [2, 1, 0]);
  assert.equal(animalOf({ animal: "dragon" }), "butterfly");
  assert.deepEqual(placed({ animal: "dragon", placedButterfly: 5 }), []);
});

test("classification: butterfly complete, grasshopper incomplete, human none", () => {
  assert.deepEqual(Object.values(ANIMALS).map(a => a.type), ["complete", "incomplete", "none"]);
  assert.deepEqual(Object.keys(TYPES), ["complete", "incomplete", "none"]);
  const s = initialState();
  assert.equal(classifiedCount(s), 0);
  s.classButterfly = "complete";
  s.classGrasshopper = "complete"; // wrong
  s.classHuman = "none";
  assert.ok(classifiedRight(s, "butterfly") && !classifiedRight(s, "grasshopper") && classifiedRight(s, "human"));
  assert.equal(classifiedCount(s), 2);
  assert.ok(!allClassified(s));
  s.classGrasshopper = "incomplete";
  assert.ok(allClassified(s));
});

test("hormone model: larval moult, pupation, adult, or nothing", () => {
  assert.equal(THRESHOLD, 50);
  assert.equal(moultOutcome("larva", 80, 80), OUTCOME.larvalMoult); // both high: a bigger caterpillar
  assert.equal(moultOutcome("larva", 80, 20), OUTCOME.pupation); // juvenile low: pupa
  assert.equal(moultOutcome("larva", 20, 80), OUTCOME.none); // no ecdysone, no moult
  assert.equal(moultOutcome("larva", 20, 20), OUTCOME.none);
  assert.equal(moultOutcome("pupa", 80, 20), OUTCOME.adult);
  assert.equal(moultOutcome("pupa", 80, 80), OUTCOME.none); // juvenile hormone holds metamorphosis back
  assert.equal(moultOutcome("pupa", 20, 20), OUTCOME.none);
  // exactly at the threshold counts as high
  assert.equal(moultOutcome("larva", 50, 50), OUTCOME.larvalMoult);
  assert.equal(moultOutcome("larva", 50, 49), OUTCOME.pupation);
  assert.equal(moultOutcome("larva", 49, 0), OUTCOME.none);
  assert.equal(moultOutcome("larva", NaN, 0), OUTCOME.none);
  // the starting picture: a caterpillar moulting into a bigger caterpillar
  const s = initialState();
  assert.equal(moultOutcome(s.insectStage, s.ecdysone, s.juvenile), OUTCOME.larvalMoult);
});
