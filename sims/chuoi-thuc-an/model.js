// Food chains, food webs and the energy pyramid.
// A link "a>b" is an arrow a → b: b eats a, energy flows from a to b (textbook convention).
// Links and removed species are kept in the state as strings and validated whenever they are read,
// so a forged or stale state can never put an impossible link in the web.

export const SPECIES = [
  { id: "co", name: "Cỏ", role: "producer" },
  { id: "chauchau", name: "Châu chấu", role: "consumer" },
  { id: "tho", name: "Thỏ", role: "consumer" },
  { id: "chuot", name: "Chuột", role: "consumer" },
  { id: "ech", name: "Ếch", role: "consumer" },
  { id: "ran", name: "Rắn", role: "consumer" },
  { id: "cu", name: "Cú", role: "consumer" },
  { id: "vikhuan", name: "Vi khuẩn phân giải", role: "decomposer" },
];
export const IDS = SPECIES.map(s => s.id);
export const byId = Object.fromEntries(SPECIES.map(s => [s.id, s]));

/** What each species eats. Decomposers break down the remains of every other organism. */
export const DIET = {
  co: [],
  chauchau: ["co"],
  tho: ["co"],
  chuot: ["co", "chauchau"],
  ech: ["chauchau"],
  ran: ["ech", "chuot"],
  cu: ["chuot", "ran", "tho"],
  vikhuan: IDS.filter(id => id !== "vikhuan"),
};

export const E0 = 10000; // kJ reaching the producers (level 1)

export const initialState = () => ({
  links: "co>chauchau,chauchau>ech,ech>ran,ran>cu,co>chuot,chuot>cu",
  removed: "",
  efficiency: 10, // ecological efficiency e, % of a level's energy passed to the next level
  from: "co",
  to: "tho",
  target: "co",
});

/** Is there a path a → … → b along the links? */
function reaches(links, a, b) {
  const seen = new Set([a]);
  const todo = [a];
  while (todo.length) {
    const x = todo.pop();
    if (x === b) return true;
    for (const [f, t] of links) if (f === x && !seen.has(t)) seen.add(t), todo.push(t);
  }
  return false;
}

/**
 * Can the arrow from → to be added to `links`? Returns { ok, reason }.
 * Checked in this order: unknown species, self, duplicate, cycle, removed species, diet.
 */
export function check(links, from, to, removed = new Set()) {
  if (!byId[from] || !byId[to]) return { ok: false, reason: "unknown" };
  if (from === to) return { ok: false, reason: "self" };
  if (links.some(([f, t]) => f === from && t === to)) return { ok: false, reason: "duplicate" };
  if (reaches(links, to, from)) return { ok: false, reason: "cycle" };
  if (removed.has(from) || removed.has(to)) return { ok: false, reason: "removed" };
  if (!DIET[to].includes(from)) return { ok: false, reason: "diet" };
  return { ok: true, reason: "" };
}

/** Links from the state string, keeping only those that pass check() in order. */
export function parseLinks(text) {
  const links = [];
  for (const part of String(text ?? "").split(",").slice(0, 64)) {
    const [from, to] = part.split(">");
    if (check(links, from, to).ok) links.push([from, to]);
  }
  return links;
}
export const linksText = links => links.map(([f, t]) => `${f}>${t}`).join(",");

/** Removed species from the state string: known ids only, no repeats. */
export const parseRemoved = text => new Set(String(text ?? "").split(",").filter(id => byId[id]));
export const removedText = set => IDS.filter(id => set.has(id)).join(",");

/**
 * The web after removals. A consumer (or decomposer) collapses when it has food links and every
 * one of its foods is removed or has collapsed; this repeats until nothing changes.
 */
export function web(s) {
  const links = parseLinks(s.links);
  const removed = parseRemoved(s.removed);
  const dead = new Set(removed);
  const collapsed = new Set();
  for (let changed = true; changed; ) {
    changed = false;
    for (const id of IDS) {
      if (dead.has(id) || byId[id].role === "producer") continue;
      const foods = links.filter(([, t]) => t === id).map(([f]) => f);
      if (foods.length && foods.every(f => dead.has(f))) dead.add(id), collapsed.add(id), (changed = true);
    }
  }
  const alive = id => !dead.has(id);
  // trophic level = 1 + length of the longest food chain from a producer (decomposers excluded)
  const level = {};
  const levelOf = id => {
    if (id in level) return level[id];
    level[id] = null; // links form no cycle, this only guards against recursion on bad data
    let best = null;
    if (byId[id].role === "producer") best = 1;
    else if (byId[id].role === "consumer") {
      for (const [f, t] of links) {
        if (t !== id || !alive(f)) continue;
        const l = levelOf(f);
        if (l != null && (best == null || l + 1 > best)) best = l + 1;
      }
    }
    return (level[id] = best);
  };
  for (const id of IDS) level[id] = alive(id) ? levelOf(id) : null;
  for (const id of IDS) if (!alive(id)) level[id] = null;
  const levels = Math.max(0, ...IDS.map(id => level[id] ?? 0));
  return { links, removed, collapsed, dead, alive, level, levels };
}

/** Energy at trophic level `k` (1 = producers): E₀·eᵏ⁻¹ in kJ, with e in percent. */
export const energyAt = (k, efficiency) => E0 * (efficiency / 100) ** (k - 1);

/** Energy of every level 1 … levels. */
export const pyramid = (levels, efficiency) => Array.from({ length: levels }, (_, i) => energyAt(i + 1, efficiency));

/** One longest food chain (producer first), following the trophic levels back down. */
export function longestChain(w) {
  let id = IDS.find(x => w.level[x] === w.levels && w.levels > 0);
  if (!id) return [];
  const chain = [id];
  while (w.level[id] > 1) {
    id = w.links.find(([f, t]) => t === id && w.alive(f) && w.level[f] === w.level[id] - 1)[0];
    chain.unshift(id);
  }
  return chain;
}

/** Add an arrow to the state if it is allowed. Returns check()'s verdict. */
export function addLink(s, from, to) {
  const links = parseLinks(s.links);
  const verdict = check(links, from, to, parseRemoved(s.removed));
  if (verdict.ok) s.links = linksText([...links, [from, to]]);
  return verdict;
}

export function removeLink(s, from, to) {
  const links = parseLinks(s.links);
  const kept = links.filter(([f, t]) => !(f === from && t === to));
  s.links = linksText(kept);
  return kept.length < links.length;
}

export const hasLink = (s, from, to) => parseLinks(s.links).some(([f, t]) => f === from && t === to);

/** Remove a species; returns how many others collapsed because of it. */
export function removeSpecies(s, id) {
  if (!byId[id]) return 0;
  const before = web(s).dead.size;
  const removed = parseRemoved(s.removed);
  removed.add(id);
  s.removed = removedText(removed);
  return Math.max(0, web(s).dead.size - before - 1);
}
