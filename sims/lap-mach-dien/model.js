// A circuit built on a grid. Components sit on the edges between neighbouring grid nodes.
// Edge ids: "h-x-y" joins node (x, y) to (x+1, y); "v-x-y" joins (x, y) to (x, y+1).
// Wires, closed switches: ideal (0 Ω, nodes merged). Bulbs: fixed resistance.
// Ammeter: nearly 0 Ω. Voltmeter: very large resistance. Pins: ideal sources, + at the first node unless flipped.

export const COLS = 6;
export const ROWS = 4;
export const TYPES = ["wire", "battery", "switch", "bulb", "ammeter", "voltmeter"];
export const R_AMMETER = 1e-4; // Ω
export const R_VOLTMETER = 1e6; // Ω
const G_MIN = 1e-12; // S, from every node to ground so a floating piece cannot make the system singular

const P = (e, t, extra = {}) => ({ e, t, ...extra });

export const initialState = () => ({
  parts: sortParts([
    P("v-0-0", "wire"),
    P("v-0-1", "battery"),
    P("h-0-0", "wire"),
    P("h-1-0", "switch", { on: true }),
    P("h-2-0", "ammeter"),
    P("h-3-0", "wire"),
    P("v-4-0", "bulb"),
    P("v-4-1", "wire"),
    P("h-0-2", "wire"),
    P("h-1-2", "wire"),
    P("h-2-2", "wire"),
    P("h-3-2", "wire"),
    P("h-4-0", "wire"),
    P("v-5-0", "voltmeter"),
    P("h-4-1", "wire"),
  ]),
  tool: "bulb",
  emf: 3, // V per pin
  bulbR: 6, // Ω per bulb
  task: "series1",
});

// ---------- edges ----------
const EDGE = /^([hv])-(\d+)-(\d+)$/;
export function validEdge(e) {
  const m = typeof e === "string" && e.match(EDGE);
  if (!m) return false;
  const x = +m[2];
  const y = +m[3];
  return m[1] === "h" ? x < COLS - 1 && y < ROWS : x < COLS && y < ROWS - 1;
}
export function ends(e) {
  const [, o, xs, ys] = e.match(EDGE);
  const x = +xs;
  const y = +ys;
  return o === "h" ? [[x, y], [x + 1, y]] : [[x, y], [x, y + 1]];
}
export const nodeId = ([x, y]) => y * COLS + x;
export const allEdges = () => {
  const out = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS - 1; x++) out.push(`h-${x}-${y}`);
  for (let y = 0; y < ROWS - 1; y++) for (let x = 0; x < COLS; x++) out.push(`v-${x}-${y}`);
  return out;
};

// Row-major by the edge's midpoint, so labels Đ1, Đ2… do not depend on the order of placing.
const key = e => {
  const [[x1, y1], [x2, y2]] = ends(e);
  return (y1 + y2) * 100 + (x1 + x2);
};
export const sortParts = parts => [...parts].sort((a, b) => key(a.e) - key(b.e));

/** Untrusted parts array → clean, deduplicated, sorted list. */
export function sanitizeParts(list) {
  if (!Array.isArray(list)) return null;
  const seen = new Set();
  const out = [];
  for (const p of list.slice(0, 200)) {
    if (!p || typeof p !== "object" || !validEdge(p.e) || !TYPES.includes(p.t) || seen.has(p.e)) continue;
    seen.add(p.e);
    const clean = { e: p.e, t: p.t };
    if (p.t === "switch") clean.on = p.on === true;
    if (p.t === "battery") clean.flip = p.flip === true;
    out.push(clean);
  }
  return sortParts(out);
}

/** Put `tool` on edge e, or act on what is there. Returns what happened, or null. */
export function tap(s, e, tool) {
  if (!validEdge(e)) return null;
  const i = s.parts.findIndex(p => p.e === e);
  const cur = s.parts[i];
  if (tool === "erase") {
    if (!cur) return null;
    s.parts.splice(i, 1);
    return { did: "remove", type: cur.t };
  }
  if (cur?.t === "switch") {
    cur.on = !cur.on;
    return { did: "toggle", type: "switch", closed: cur.on };
  }
  if (cur?.t === "battery" && tool === "battery") {
    cur.flip = !cur.flip;
    return { did: "flip", type: "battery" };
  }
  if (cur?.t === "wire" && tool === "wire") {
    s.parts.splice(i, 1);
    return { did: "remove", type: "wire" };
  }
  if (cur?.t === tool) return null;
  if (!TYPES.includes(tool)) return null;
  const part = P(e, tool, tool === "switch" ? { on: false } : tool === "battery" ? { flip: false } : {});
  if (cur) s.parts[i] = part;
  else s.parts.push(part);
  s.parts = sortParts(s.parts);
  return { did: "place", type: tool };
}

// ---------- union–find ----------
function groups(parts, use) {
  const parent = new Map();
  const find = a => {
    while (parent.has(a) && parent.get(a) !== a) a = parent.get(a);
    return a;
  };
  for (const p of parts) {
    if (!use(p)) continue;
    const [a, b] = ends(p.e).map(nodeId);
    const ra = find(a);
    const rb = find(b);
    parent.set(ra, ra);
    parent.set(rb, rb);
    if (ra !== rb) parent.set(ra, rb);
  }
  return { find, same: (a, b) => find(a) === find(b) };
}
const isWire = p => p.t === "wire" || (p.t === "switch" && p.on);
const conducts = p => p.t !== "switch" || p.on;

// ---------- linear solve (Gaussian elimination, partial pivoting) ----------
function gauss(A, b) {
  const n = b.length;
  for (let c = 0; c < n; c++) {
    let best = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[best][c])) best = r;
    if (Math.abs(A[best][c]) < 1e-15) return null;
    [A[c], A[best]] = [A[best], A[c]];
    [b[c], b[best]] = [b[best], b[c]];
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / A[c][c];
      if (!f) continue;
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let sum = b[r];
    for (let k = r + 1; k < n; k++) sum -= A[r][k] * x[k];
    x[r] = sum / A[r][r];
  }
  return x;
}

const names = parts => {
  const count = { bulb: 0, ammeter: 0, voltmeter: 0, battery: 0, switch: 0 };
  const prefix = { bulb: "Đ", ammeter: "A", voltmeter: "V", battery: "Pin ", switch: "K" };
  return parts.map(p => (p.t in count ? `${prefix[p.t]}${++count[p.t]}` : ""));
};

/**
 * Solve the circuit by nodal analysis (modified for ideal pins).
 * Returns per-part results plus learner-facing errors and notes.
 */
export function solve(s) {
  const parts = s.parts;
  const label = names(parts);
  const emf = Math.max(0, s.emf);
  const R = Math.max(0.1, s.bulbR);
  const wire = groups(parts, isWire);
  const zero = groups(parts, p => isWire(p) || p.t === "ammeter");
  const errors = [];
  const notes = [];
  const items = parts.map((p, i) => ({ ...p, name: label[i], i: 0, u: 0, p: 0, value: 0, lit: false, level: 0 }));
  const pins = items.filter(p => p.t === "battery");
  const bulbs = items.filter(p => p.t === "bulb");
  const out = { items, bulbs, errors, notes, short: false, invalid: false, total: 0, closed: false, lit: 0, emfTotal: 0 };

  // short circuit: both poles of a pin joined through wires, closed switches or ammeters
  for (const b of pins) {
    const [a, c] = ends(b.e).map(nodeId);
    if (wire.same(a, c)) errors.push(`Đoản mạch: hai cực của ${b.name.toLowerCase()} được nối thẳng với nhau bằng dây dẫn.`);
    else if (zero.same(a, c)) errors.push(`Ampe kế mắc song song với ${b.name.toLowerCase()}: gây đoản mạch.`);
    if (zero.same(a, c)) out.short = true;
  }
  // ammeter in parallel with a bulb or a voltmeter (it bypasses it), bulb bypassed by a wire
  for (const p of items) {
    if (p.t !== "bulb" && p.t !== "voltmeter") continue;
    const [a, c] = ends(p.e).map(nodeId);
    if (wire.same(a, c)) {
      if (p.t === "bulb") notes.push(`Đèn ${p.name} bị nối tắt bằng dây dẫn nên không sáng.`);
    } else if (zero.same(a, c)) errors.push(`Ampe kế mắc song song với ${p.t === "bulb" ? "đèn" : "vôn kế"} ${p.name}: phải mắc nối tiếp.`);
  }
  // voltmeter in series: it is the only way the current of some pin can close its loop,
  // and it is not simply connected across that pin
  for (const v of items.filter(p => p.t === "voltmeter")) {
    const [va, vb] = ends(v.e).map(nodeId).map(zero.find);
    for (const b of pins) {
      const [ba, bb] = ends(b.e).map(nodeId);
      const withV = groups(parts, p => p.e !== b.e && conducts(p));
      const withoutV = groups(parts, p => p.e !== b.e && p.e !== v.e && conducts(p));
      const across = (va === zero.find(ba) && vb === zero.find(bb)) || (va === zero.find(bb) && vb === zero.find(ba));
      if (withV.same(ba, bb) && !withoutV.same(ba, bb) && !across) {
        errors.push(`Vôn kế ${v.name} mắc nối tiếp: dòng điện gần như bằng 0. Vôn kế phải mắc song song với vật cần đo.`);
        break;
      }
    }
  }
  if (out.short) return out;

  // unknowns: one potential per merged node (wire group), one current per pin
  const index = new Map();
  for (const p of parts) for (const n of ends(p.e).map(nodeId)) {
    const r = wire.find(n);
    if (!index.has(r)) index.set(r, index.size);
  }
  const N = index.size;
  const M = pins.length;
  if (!N) return out;
  const A = Array.from({ length: N + M }, () => new Array(N + M).fill(0));
  const rhs = new Array(N + M).fill(0);
  const at = n => index.get(wire.find(n));
  for (let k = 0; k < N; k++) A[k][k] += G_MIN;
  const G = { bulb: 1 / R, ammeter: 1 / R_AMMETER, voltmeter: 1 / R_VOLTMETER };
  for (const p of items) {
    const [a, c] = ends(p.e).map(nodeId).map(at);
    if (p.t in G && a !== c) {
      const g = G[p.t];
      A[a][a] += g;
      A[c][c] += g;
      A[a][c] -= g;
      A[c][a] -= g;
    }
  }
  pins.forEach((b, j) => {
    let [plus, minus] = ends(b.e).map(nodeId).map(at);
    if (b.flip) [plus, minus] = [minus, plus];
    const row = N + j;
    // current j flows out of the + pole into the circuit
    A[plus][row] -= 1;
    A[minus][row] += 1;
    A[row][plus] = 1;
    A[row][minus] = -1;
    rhs[row] = emf;
  });
  const x = gauss(A, rhs);
  if (!x) {
    out.invalid = true;
    errors.push("Các pin được nối thành vòng kín không có vật tiêu thụ: mô phỏng không giải được.");
    return out;
  }
  const pRef = (emf * emf) / R; // one bulb on one pin
  for (const p of items) {
    const [a, c] = ends(p.e).map(nodeId).map(at);
    const du = x[a] - x[c];
    if (p.t === "bulb") {
      p.u = Math.abs(du);
      p.i = p.u / R;
      p.p = p.u * p.i;
      p.level = pRef > 0 ? Math.min(1, p.p / pRef) : 0;
      p.lit = pRef > 0 && p.p > 0.01 * pRef;
    } else if (p.t === "ammeter") {
      p.value = a === c ? 0 : Math.abs(du) / R_AMMETER;
    } else if (p.t === "voltmeter") {
      p.value = Math.abs(du);
    }
  }
  pins.forEach((b, j) => (b.i = x[N + j]));
  out.total = Math.max(0, ...pins.map(b => Math.abs(b.i)));
  out.closed = out.total > 1e-3;
  out.lit = bulbs.filter(b => b.lit).length;
  return out;
}

// ---------- tasks ----------
export const TASKS = [
  { value: "series1", label: "Pin, công tắc và một đèn: đóng công tắc cho đèn sáng" },
  { value: "series2", label: "Hai đèn mắc nối tiếp cùng sáng" },
  { value: "parallel2", label: "Hai đèn mắc song song cùng sáng" },
  { value: "measure", label: "Đo cường độ dòng điện qua đèn và hiệu điện thế giữa hai đầu đèn" },
  { value: "mixed", label: "Một đèn nối tiếp với hai đèn mắc song song" },
];

const close = (a, b) => Math.abs(a - b) <= 0.01 * Math.max(Math.abs(a), Math.abs(b), 1e-9);

/** Has the learner built what the current task asks for? */
export function taskMet(s, sol = solve(s)) {
  if (sol.errors.length || !sol.closed) return false;
  const bulbs = sol.bulbs;
  const allLit = bulbs.every(b => b.lit);
  switch (s.task) {
    case "series1": {
      if (bulbs.length !== 1 || !allLit) return false;
      // some closed switch must control the bulb
      return s.parts.some((p, i) => {
        if (p.t !== "switch" || !p.on) return false;
        const off = { ...s, parts: s.parts.map((q, j) => (j === i ? { ...q, on: false } : q)) };
        return !solve(off).bulbs[0].lit;
      });
    }
    case "series2":
      return bulbs.length === 2 && allLit && close(bulbs[0].i, bulbs[1].i) && close(sol.total, bulbs[0].i);
    case "parallel2":
      return bulbs.length === 2 && allLit && close(bulbs[0].u, bulbs[1].u) && close(sol.total, bulbs[0].i + bulbs[1].i);
    case "measure": {
      const meters = t => sol.items.filter(p => p.t === t && p.value > 1e-6);
      return bulbs.some(b => b.lit && meters("ammeter").some(a => close(a.value, b.i)) && meters("voltmeter").some(v => close(v.value, b.u)));
    }
    case "mixed": {
      if (bulbs.length !== 3 || !allLit) return false;
      return bulbs.some((main, k) => {
        const [b1, b2] = bulbs.filter((_, j) => j !== k);
        return close(main.i, b1.i + b2.i) && close(b1.u, b2.u) && close(sol.total, main.i);
      });
    }
    default:
      return false;
  }
}

/** Ready-made layouts for the preset buttons. */
export const PRESETS = {
  series: [
    P("v-0-0", "wire"), P("v-0-1", "battery"), P("h-0-0", "switch", { on: true }), P("h-1-0", "bulb"), P("h-2-0", "bulb"),
    P("h-3-0", "wire"), P("v-4-0", "wire"), P("v-4-1", "wire"), P("h-0-2", "wire"), P("h-1-2", "wire"), P("h-2-2", "wire"), P("h-3-2", "wire"),
  ],
  parallel: [
    P("v-0-0", "wire"), P("v-0-1", "battery"), P("h-0-0", "switch", { on: true }), P("h-1-0", "wire"), P("h-2-0", "wire"), P("h-3-0", "wire"),
    P("v-2-0", "bulb"), P("v-2-1", "wire"), P("v-4-0", "bulb"), P("v-4-1", "wire"),
    P("h-0-2", "wire"), P("h-1-2", "wire"), P("h-2-2", "wire"), P("h-3-2", "wire"),
  ],
};
