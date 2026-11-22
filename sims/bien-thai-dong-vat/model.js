// Growth and development in animals: three life cycles to put in order and to classify,
// and a simple model of the two hormones that control moulting in insects.
//
// Kinds of development (the stages are listed in their true order):
//   complete metamorphosis (biến thái hoàn toàn)        butterfly: egg → larva (caterpillar) → pupa → adult
//   incomplete metamorphosis (biến thái không hoàn toàn) grasshopper: egg → nymph (several moults) → adult
//   no metamorphosis (không qua biến thái)               human: zygote → embryo → foetus → child → adult
//
// Hormones (threshold model, levels in % of the highest level, threshold 50 %):
//   ecdysone, from the prothoracic gland, triggers every moult;
//   juvenile hormone, from the corpora allata, keeps the insect a larva.
//   larva: ecdysone high + juvenile high → moults into a bigger larva
//          ecdysone high + juvenile low  → becomes a pupa
//   pupa:  ecdysone high + juvenile low  → the adult emerges
//   otherwise nothing happens (no ecdysone: no moult; juvenile high in a pupa: metamorphosis is held back).

export const ANIMALS = {
  butterfly: { id: 1, name: "Bướm", type: "complete", stages: ["Trứng", "Sâu bướm", "Nhộng", "Bướm"], cards: [2, 0, 3, 1] },
  grasshopper: { id: 2, name: "Châu chấu", type: "incomplete", stages: ["Trứng", "Ấu trùng", "Trưởng thành"], cards: [1, 2, 0] },
  human: { id: 3, name: "Người", type: "none", stages: ["Hợp tử", "Phôi", "Thai nhi", "Trẻ em", "Người lớn"], cards: [3, 0, 4, 2, 1] },
};
export const TYPES = { complete: "Biến thái hoàn toàn", incomplete: "Biến thái không hoàn toàn", none: "Không qua biến thái" };
export const THRESHOLD = 50; // %
export const OUTCOME = { none: 0, larvalMoult: 1, pupation: 2, adult: 3 };

const PLACED = { butterfly: "placedButterfly", grasshopper: "placedGrasshopper", human: "placedHuman" };
const CLASS = { butterfly: "classButterfly", grasshopper: "classGrasshopper", human: "classHuman" };

export const initialState = () => ({
  view: "cycle", // "cycle" | "hormone"
  animal: "butterfly",
  card: 1, // card number chosen with the stepper (keyboard way of placing a card)
  placedButterfly: "", // stage indices in the order they were put on the timeline, e.g. "0123"
  placedGrasshopper: "",
  placedHuman: "",
  classButterfly: "", // "" | "complete" | "incomplete" | "none"
  classGrasshopper: "",
  classHuman: "",
  classified: false, // the goal has been reported
  insectStage: "larva", // "larva" | "pupa"
  ecdysone: 80, // %
  juvenile: 80, // %
});

export const animalOf = s => (ANIMALS[s.animal] ? s.animal : "butterfly");

/** Stage indices on the timeline of one animal, in the order placed; invalid or repeated digits are dropped. */
export function placed(s, animal = animalOf(s)) {
  const n = ANIMALS[animal].stages.length;
  const out = [];
  for (const ch of String(s[PLACED[animal]] ?? "").slice(0, 12)) {
    const i = ch.charCodeAt(0) - 48;
    if (i >= 0 && i < n && !out.includes(i)) out.push(i);
  }
  return out;
}

export const isComplete = (s, animal = animalOf(s)) => placed(s, animal).length === ANIMALS[animal].stages.length;
export const isCorrect = (s, animal = animalOf(s)) => isComplete(s, animal) && placed(s, animal).every((stage, i) => stage === i);

/**
 * Put card number `card` (1-based, as numbered on screen) on the next free place of the timeline.
 * Returns { stage, position, correct } (stage and position 1-based), or null if that card cannot be placed.
 */
export function place(s, card) {
  const animal = animalOf(s);
  const stage = ANIMALS[animal].cards[Math.round(card) - 1];
  const list = placed(s, animal);
  if (stage == null || list.includes(stage)) return null;
  list.push(stage);
  s[PLACED[animal]] = list.join("");
  return { stage: stage + 1, position: list.length, correct: stage + 1 === list.length };
}

export function clearTimeline(s) {
  s[PLACED[animalOf(s)]] = "";
  return s;
}

export const chosenType = (s, animal) => s[CLASS[animal]];
export const classifiedRight = (s, animal) => chosenType(s, animal) === ANIMALS[animal].type;
export const classifiedCount = s => Object.keys(ANIMALS).filter(a => classifiedRight(s, a)).length;
export const allClassified = s => classifiedCount(s) === Object.keys(ANIMALS).length;

/** What the insect does at these hormone levels (see the table at the top). Returns an OUTCOME code. */
export function moultOutcome(stage, ecdysone, juvenile) {
  if (!(ecdysone >= THRESHOLD)) return OUTCOME.none;
  const high = juvenile >= THRESHOLD;
  if (stage === "pupa") return high ? OUTCOME.none : OUTCOME.adult;
  return high ? OUTCOME.larvalMoult : OUTCOME.pupation;
}
