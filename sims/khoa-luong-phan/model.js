// Dichotomous key for eight animals.
// A key is a string of "path:feature" entries joined by ";". A path is the answers that lead to
// the question ("y" = có, "n" = không; the root path is empty), e.g. ":xuong;y:longmao;n:canh".

export const ORGANISMS = [
  { id: "ca-chep", name: "Cá chép", icon: "🐟" },
  { id: "ech", name: "Ếch đồng", icon: "🐸" },
  { id: "ran", name: "Rắn", icon: "🐍" },
  { id: "bo-cau", name: "Bồ câu", icon: "🐦" },
  { id: "meo", name: "Mèo", icon: "🐈" },
  { id: "doi", name: "Dơi", icon: "🦇" },
  { id: "buom", name: "Bướm", icon: "🦋" },
  { id: "cua", name: "Cua đồng", icon: "🦀" },
];

// `has` lists the organisms that have the characteristic, in the order of ORGANISMS.
export const FEATURES = [
  { id: "xuong", label: "Xương sống", question: "Con vật có xương sống không?", has: "11111100" },
  { id: "chan", label: "Chân", question: "Con vật có chân không?", has: "01011111" },
  { id: "canh", label: "Cánh", question: "Con vật có cánh không?", has: "00010110" },
  { id: "longvu", label: "Lông vũ", question: "Cơ thể có lông vũ bao phủ không?", has: "00010000" },
  { id: "longmao", label: "Lông mao", question: "Cơ thể có lông mao bao phủ không?", has: "00001100" },
  { id: "vay", label: "Vảy", question: "Da có vảy bao phủ không?", has: "10100000" },
  { id: "mang", label: "Mang", question: "Con vật thở bằng mang không?", has: "10000001" },
];
const FEATURE = Object.fromEntries(FEATURES.map(f => [f.id, f]));
export const feature = id => FEATURE[id];
export const has = (featureId, organism) => FEATURE[featureId].has[organism] === "1";

export const PRESET = ":xuong;y:longmao;yy:canh;yn:longvu;ynn:chan;ynnn:mang;n:canh";
export const MAX_QUESTIONS = 12;
export const MAX_DEPTH = 8;
const ALL_FOUND = 2 ** ORGANISMS.length - 1;

export const initialState = () => ({
  mode: "follow", // "follow": use the preset key; "build": write your own
  organism: ORGANISMS[0].id, // the animal being identified
  path: "", // answers given so far for it
  mistakes: 0, // wrong answers for it
  lastWrong: false, // the latest answer was wrong
  foundMask: 0, // bit i set = organism i has been identified
  showTable: false,
  key: "", // the learner's own key
  feature: FEATURES[0].id, // characteristic chosen for the next question in build mode
});

/** Key string -> Map(path -> feature id). Malformed, unknown and repeated entries are dropped. */
export function parseKey(text) {
  const key = new Map();
  for (const entry of String(text ?? "").split(";")) {
    const [path, id, extra] = entry.split(":");
    if (extra !== undefined || !FEATURE[id] || !/^[yn]*$/.test(path) || path.length >= MAX_DEPTH) continue;
    if (!key.has(path) && key.size < MAX_QUESTIONS) key.set(path, id);
  }
  return key;
}

/**
 * Walk a key over the whole set.
 * nodes: questions reached from the root, with the group they have to split;
 * leaves: ends of the key with the organisms that arrive there;
 * flagged: paths of questions that do not split their group (everyone gives the same answer);
 * separated: every organism ends at its own leaf; valid: separated and nothing flagged;
 * depth: the largest number of questions needed to reach an organism;
 * next: the first leaf that still holds more than one organism.
 */
export function analyze(text) {
  const key = parseKey(text);
  const nodes = [];
  const leaves = [];
  const flagged = [];
  const walk = (path, group) => {
    const id = key.get(path);
    if (!id) return void leaves.push({ path, group });
    const yes = group.filter(i => has(id, i));
    const no = group.filter(i => !has(id, i));
    if (!yes.length || !no.length) flagged.push(path);
    nodes.push({ path, feature: id, group });
    walk(path + "y", yes);
    walk(path + "n", no);
  };
  walk("", ORGANISMS.map((_, i) => i));
  const separated = leaves.every(leaf => leaf.group.length <= 1);
  return {
    nodes,
    leaves,
    flagged,
    separated,
    valid: separated && flagged.length === 0,
    depth: Math.max(0, ...leaves.filter(leaf => leaf.group.length).map(leaf => leaf.path.length)),
    next: leaves.find(leaf => leaf.group.length > 1) ?? null,
  };
}

/** Follow a key for one organism: the answers it gives and the questions it meets. */
export function identify(text, organism) {
  const key = parseKey(text);
  let path = "";
  const features = [];
  while (key.has(path)) {
    features.push(key.get(path));
    path += has(key.get(path), organism) ? "y" : "n";
  }
  return { path, features, steps: features.length };
}

// ---------- following the preset key ----------

export const organismIndex = s => Math.max(0, ORGANISMS.findIndex(o => o.id === s.organism));

/** Where the learner is for the current organism; a forged path is cut back to its correct prefix. */
export function progress(s) {
  const organism = organismIndex(s);
  const full = identify(PRESET, organism);
  let done = 0;
  while (done < full.steps && s.path[done] === full.path[done]) done++;
  return { organism, done, steps: full.steps, identified: done === full.steps, feature: full.features[done] ?? null, full };
}

export const found = s => ORGANISMS.map((_, i) => ((s.foundMask & ALL_FOUND) >> i) % 2 === 1);

/** Answer the current question. Returns null when there is none, otherwise { correct, identified, steps, mistakes }. */
export function answer(s, yes) {
  const p = progress(s);
  if (p.identified) return null;
  const correct = has(p.feature, p.organism) === yes;
  s.path = p.full.path.slice(0, p.done + (correct ? 1 : 0));
  s.lastWrong = !correct;
  s.mistakes = Math.max(0, Math.floor(Number(s.mistakes) || 0)) + (correct ? 0 : 1);
  const identified = correct && p.done + 1 === p.steps;
  if (identified) s.foundMask = (s.foundMask & ALL_FOUND) | (1 << p.organism);
  return { correct, identified, organism: p.organism, question: p.done + 1, steps: p.steps, mistakes: s.mistakes };
}

export function choose(s, id) {
  s.organism = id;
  s.path = "";
  s.mistakes = 0;
  s.lastWrong = false;
  return s;
}

/** Move on to the next organism that has not been identified yet (or simply the next one). */
export function nextOrganism(s) {
  const done = found(s);
  const start = organismIndex(s);
  const order = ORGANISMS.map((_, k) => (start + 1 + k) % ORGANISMS.length);
  return choose(s, ORGANISMS[order.find(i => !done[i]) ?? order[0]].id);
}

// ---------- building a key ----------

const entries = text => [...parseKey(text)].map(([path, id]) => `${path}:${id}`);

/** Ask `s.feature` of the first group that still holds several organisms. False when nothing was added. */
export function addQuestion(s) {
  const a = analyze(s.key);
  if (!a.next || !FEATURE[s.feature] || a.next.path.length >= MAX_DEPTH || parseKey(s.key).size >= MAX_QUESTIONS) return false;
  s.key = [...entries(s.key), `${a.next.path}:${s.feature}`].join(";");
  return true;
}

export function undo(s) {
  s.key = entries(s.key).slice(0, -1).join(";");
  return s;
}
