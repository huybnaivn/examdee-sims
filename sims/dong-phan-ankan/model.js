// Carbon skeletons on a grid, alkane checks and IUPAC substitutive names (n ≤ 7).
// State: atoms = [[col, row], ...], bonds = [[i, j], ...] (indices into atoms).

export const COLS = 9;
export const ROWS = 5;
export const MAX_C = 7;
const STEMS = ["", "methane", "ethane", "propane", "butane", "pentane", "hexane", "heptane"];
const ALKYL = ["", "methyl", "ethyl", "propyl"];
const MULT = ["", "", "di", "tri", "tetra"];

/** Two cells may be bonded when they touch, diagonals included. */
export const neighbours = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])) === 1;

export function initialState() {
  // 2-methylbutane: a chain of four with a methyl on C2
  return {
    atoms: [[2, 2], [3, 2], [4, 2], [5, 2], [3, 1]],
    bonds: [[0, 1], [1, 2], [2, 3], [1, 4]],
    target: 5,
    found: [2],
    showAll: false,
  };
}

export function adjacency(n, bonds) {
  const adj = Array.from({ length: n }, () => []);
  for (const [a, b] of bonds) {
    adj[a].push(b);
    adj[b].push(a);
  }
  return adj;
}

// Rooted-tree code (AHU); the smallest code over all roots is the same for every drawing of one isomer.
const rooted = (adj, v, parent) => "(" + adj[v].filter(u => u !== parent).map(u => rooted(adj, u, v)).sort().join("") + ")";
export const canonical = adj => adj.map((_, v) => rooted(adj, v, -1)).sort()[0];

function pathBetween(adj, a, b) {
  const prev = new Map([[a, -1]]);
  const queue = [a];
  while (queue.length) {
    const v = queue.shift();
    for (const u of adj[v]) if (!prev.has(u)) (prev.set(u, v), queue.push(u));
  }
  const path = [];
  for (let v = b; v !== -1; v = prev.get(v)) path.unshift(v);
  return path;
}

const lexLess = (a, b) => {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] < b[i];
  return a.length < b.length;
};

/** Main chain and substituents of a tree by IUPAC rules, and the name. */
export function nameTree(adj) {
  const n = adj.length;
  const ends = n === 1 ? [0] : adj.map((a, v) => (a.length === 1 ? v : -1)).filter(v => v >= 0);
  let chains = [];
  for (const a of ends) for (const b of ends) if (a !== b || n === 1) chains.push(pathBetween(adj, a, b));
  const longest = Math.max(...chains.map(c => c.length));
  chains = chains.filter(c => c.length === longest);

  let best = null;
  for (const chain of chains) {
    const inChain = new Set(chain);
    const subs = [];
    chain.forEach((v, i) => {
      for (const u of adj[v]) {
        if (inChain.has(u)) continue;
        const branch = [];
        const stack = [[u, v]];
        while (stack.length) {
          const [x, from] = stack.pop();
          branch.push(x);
          for (const y of adj[x]) if (y !== from) stack.push([y, x]);
        }
        // ponytail: only straight branches get a name; with a longest main chain and n ≤ 7 every branch is methyl or ethyl
        const straight = branch.every(x => adj[x].length <= 2);
        subs.push({ pos: i + 1, at: v, branch, name: straight && ALKYL[branch.length] || "?" });
      }
    });
    const locants = subs.map(s => s.pos).sort((a, b) => a - b);
    const alpha = [...subs].sort((a, b) => a.name.localeCompare(b.name) || a.pos - b.pos).map(s => s.pos);
    const cand = { chain, subs, locants, alpha };
    if (
      !best ||
      subs.length > best.subs.length ||
      (subs.length === best.subs.length &&
        (lexLess(locants, best.locants) || (locants.join() === best.locants.join() && lexLess(alpha, best.alpha))))
    ) best = cand;
  }

  const groups = new Map();
  for (const s of [...best.subs].sort((a, b) => a.pos - b.pos)) groups.set(s.name, [...(groups.get(s.name) ?? []), s.pos]);
  const prefix = [...groups.keys()].sort().map(k => `${groups.get(k).join(",")}-${MULT[groups.get(k).length]}${k}`).join("-");
  return { chain: best.chain, subs: best.subs, name: prefix + STEMS[longest] };
}

/** Check a skeleton and, if it is an alkane, name it. */
export function analyse(atoms, bonds) {
  const n = atoms.length;
  if (!n) return { ok: false, error: "empty", n };
  const adj = adjacency(n, bonds);
  const over = adj.map((a, v) => (a.length > 4 ? v : -1)).filter(v => v >= 0);
  if (over.length) return { ok: false, error: "valence", n, over };
  let components = 0;
  const seen = new Set();
  for (let s = 0; s < n; s++) {
    if (seen.has(s)) continue;
    components++;
    const stack = [s];
    seen.add(s);
    while (stack.length) for (const u of adj[stack.pop()]) if (!seen.has(u)) (seen.add(u), stack.push(u));
  }
  if (bonds.length > n - components) return { ok: false, error: "ring", n };
  if (components > 1) return { ok: false, error: "disconnected", n };
  const hydrogens = adj.map(a => 4 - a.length);
  const canon = canonical(adj);
  return { ok: true, n, H: hydrogens.reduce((a, b) => a + b, 0), hydrogens, canon, id: isomerId(n, canon), ...nameTree(adj) };
}

const cache = new Map();
/** Every structural isomer of CnH2n+2, unbranched first (longest chain, then name). */
export function isomers(n) {
  if (cache.has(n)) return cache.get(n);
  let level = new Map([["()", [[]]]]);
  for (let k = 2; k <= n; k++) {
    const next = new Map();
    for (const adj of level.values()) {
      adj.forEach((a, v) => {
        if (a.length >= 4) return;
        const grown = [...adj.map(x => [...x]), [v]];
        grown[v].push(k - 1);
        const c = canonical(grown);
        if (!next.has(c)) next.set(c, grown);
      });
    }
    level = next;
  }
  const list = [...level.entries()]
    .map(([canon, adj]) => ({ canon, adj, ...nameTree(adj) }))
    .sort((a, b) => b.chain.length - a.chain.length || (a.name < b.name ? -1 : 1))
    .map((iso, i) => ({ ...iso, id: i + 1 }));
  cache.set(n, list);
  return list;
}

export const isomerId = (n, canon) => (n >= 1 && n <= MAX_C ? isomers(n).find(i => i.canon === canon)?.id ?? 0 : 0);

// ---------- edits ----------

export const atomAt = (s, x, y) => s.atoms.findIndex(a => a[0] === x && a[1] === y);
export const bondIndex = (s, i, j) => s.bonds.findIndex(([a, b]) => (a === i && b === j) || (a === j && b === i));

/** Adds a carbon at an empty cell; returns its index, or -1. */
export function addCarbon(s, x, y) {
  if (s.atoms.length >= MAX_C || x < 0 || y < 0 || x >= COLS || y >= ROWS || atomAt(s, x, y) >= 0) return -1;
  s.atoms.push([x, y]);
  return s.atoms.length - 1;
}

export function removeCarbon(s, i) {
  s.atoms.splice(i, 1);
  s.bonds = s.bonds.filter(([a, b]) => a !== i && b !== i).map(([a, b]) => [a - (a > i), b - (b > i)]);
}

/** Bonds two neighbouring carbons; returns true if a bond was added. */
export function addBond(s, i, j) {
  if (i === j || !neighbours(s.atoms[i], s.atoms[j]) || bondIndex(s, i, j) >= 0) return false;
  s.bonds.push([i, j]);
  return true;
}

/** After an edit: counts a new isomer of the chosen n. Returns the analysis with `isNew`. */
export function record(s) {
  const a = analyse(s.atoms, s.bonds);
  a.isNew = false;
  if (a.ok && a.n === s.target && !s.found.includes(a.id)) {
    s.found.push(a.id);
    a.isNew = true;
  }
  return a;
}

/** Keeps only a valid skeleton from untrusted state. */
export function sanitize(incoming, base) {
  const out = {};
  const atoms = [];
  const okCell = p => Array.isArray(p) && Number.isInteger(p[0]) && Number.isInteger(p[1]) && p[0] >= 0 && p[1] >= 0 && p[0] < COLS && p[1] < ROWS;
  const cells = Array.isArray(incoming.atoms) && incoming.atoms.every(okCell) ? incoming.atoms : null;
  if (cells && cells.length <= MAX_C && new Set(cells.map(p => p.join())).size === cells.length) {
    for (const p of cells) atoms.push([p[0], p[1]]);
    const s = { atoms, bonds: [] };
    const okIndex = i => Number.isInteger(i) && i >= 0 && i < atoms.length;
    for (const b of Array.isArray(incoming.bonds) ? incoming.bonds : []) if (Array.isArray(b) && okIndex(b[0]) && okIndex(b[1])) addBond(s, b[0], b[1]);
    Object.assign(out, s);
  }
  if (Number.isInteger(incoming.target)) out.target = Math.min(MAX_C, Math.max(1, incoming.target));
  const target = out.target ?? base.target;
  if (Array.isArray(incoming.found)) {
    out.found = [...new Set(incoming.found.filter(id => Number.isInteger(id) && id >= 1 && id <= isomers(target).length))];
  } else if (out.target !== undefined) out.found = [];
  if (typeof incoming.showAll === "boolean") out.showAll = incoming.showAll;
  return out;
}

/** CnH2n+2 with subscripts. */
const SUBS = "₀₁₂₃₄₅₆₇₈₉";
export const sub = k => String(k).replace(/\d/g, d => SUBS[d]);
export const formula = (n, h) => `C${n > 1 ? sub(n) : ""}H${sub(h)}`;
