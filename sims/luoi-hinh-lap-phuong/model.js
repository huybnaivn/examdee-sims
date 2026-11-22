// Nets of a cube. A net is six unit squares ("cells" [x, y]) joined edge to edge on a grid.
// Faces are numbered so that f and f ^ 1 are opposite: 0 bottom, 1 top, 2 north, 3 south, 4 east, 5 west.

export const GRID_W = 6;
export const GRID_H = 5;
export const GOAL = 5; // different nets to find in the puzzle

const key = (x, y) => `${x},${y}`;
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Shift to the corner and sort, so equal shapes give equal strings. */
function normal(cells) {
  const x0 = Math.min(...cells.map(c => c[0]));
  const y0 = Math.min(...cells.map(c => c[1]));
  return cells.map(([x, y]) => [x - x0, y - y0]).sort((p, q) => p[1] - q[1] || p[0] - q[0]);
}
const text = cells => cells.map(c => key(...c)).join(";");

/** The 8 rotations and reflections of a shape, each normalised. */
function variants(cells) {
  const out = [];
  let cur = cells;
  for (let i = 0; i < 4; i++) {
    cur = cur.map(([x, y]) => [-y, x]); // quarter turn
    out.push(normal(cur), normal(cur.map(([x, y]) => [-x, y])));
  }
  return out;
}

/** One string per shape, the same for all its rotations and mirror images. */
export const canonical = cells => variants(cells).map(text).sort()[0];

/** All free polyominoes of n cells (35 for n = 6). */
export function polyominoes(n) {
  let level = new Map([[canonical([[0, 0]]), [[0, 0]]]]);
  for (let size = 1; size < n; size++) {
    const next = new Map();
    for (const cells of level.values()) {
      const has = new Set(cells.map(c => key(...c)));
      for (const [x, y] of cells) {
        for (const [dx, dy] of STEPS) {
          if (has.has(key(x + dx, y + dy))) continue;
          const grown = [...cells, [x + dx, y + dy]];
          const k = canonical(grown);
          if (!next.has(k)) next.set(k, normal(grown));
        }
      }
    }
    level = next;
  }
  return [...level.values()];
}

// Rolling a cube one square over: which face comes to the bottom. o = [bottom, top, north, south, east, west].
const ROLL = {
  "1,0": ([d, u, n, s, e, w]) => [e, w, n, s, u, d],
  "-1,0": ([d, u, n, s, e, w]) => [w, e, n, s, d, u],
  "0,1": ([d, u, n, s, e, w]) => [n, s, u, d, e, w],
  "0,-1": ([d, u, n, s, e, w]) => [s, n, d, u, e, w],
};

/**
 * Does the shape fold into a cube? Roll a cube over the squares: each square takes the face that lands on it.
 * Returns { valid, reason, faces (face number per cell, −1 if not reached), clash (cells sharing a face), net }.
 * reason: "count" (not six squares), "apart" (not joined edge to edge), "block" (four squares round one corner),
 * "overlap" (two squares fold onto the same face), or null when valid. net is 1…11 for a valid net, else 0.
 */
export function checkNet(cells) {
  const index = new Map(cells.map((c, i) => [key(...c), i]));
  const count = cells.length === 6 && index.size === 6;
  const faces = count ? rollFaces(cells) : cells.map(() => -1);
  const fail = (reason, clash = []) => ({ valid: false, reason, faces, clash, net: 0 });
  if (!count) return fail("count");
  if (faces.includes(-1)) return fail("apart");
  // Four squares round one grid corner cannot fold: a cube has only three faces at a vertex.
  // (A hexomino has a closed loop of squares only in that case, so otherwise the rolling is unambiguous.)
  for (const [x, y] of cells) {
    const block = [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]].map(c => index.get(key(...c)));
    if (!block.includes(undefined)) return fail("block", block);
  }
  const clash = faces.map((f, i) => (faces.indexOf(f) !== i || faces.lastIndexOf(f) !== i ? i : -1)).filter(i => i >= 0);
  if (clash.length) return fail("overlap", clash);
  return { valid: true, reason: null, faces, clash: [], net: NET_KEYS.indexOf(canonical(cells)) + 1 };
}

/** Pairs of cell indices that become opposite faces of the cube (three pairs), for a valid net. */
export function oppositePairs(cells) {
  const { valid, faces } = checkNet(cells);
  if (!valid) return [];
  return [0, 2, 4].map(f => [faces.indexOf(f), faces.indexOf(f + 1)]);
}

/** Widest-first layout of a shape for the gallery. */
function upright(cells) {
  const size = c => [Math.max(...c.map(p => p[0])), Math.max(...c.map(p => p[1]))];
  return variants(cells)
    .filter(c => size(c)[0] >= size(c)[1])
    .sort((p, q) => (text(p) < text(q) ? -1 : 1))[0];
}

/** The 11 nets of the cube, as cell lists; net number k is NETS[k − 1]. */
export const NETS = polyominoes(6)
  .filter(cells => {
    const index = new Set(cells.map(c => key(...c)));
    if (cells.some(([x, y]) => index.has(key(x + 1, y)) && index.has(key(x, y + 1)) && index.has(key(x + 1, y + 1)))) return false;
    return new Set(rollFaces(cells)).size === 6;
  })
  .map(upright)
  .sort((p, q) => (text(p) < text(q) ? -1 : 1));
const NET_KEYS = NETS.map(canonical);

/** Face landing on each cell when a cube is rolled over the shape from cells[0]; −1 where it cannot get. */
function rollFaces(cells) {
  const index = new Map(cells.map((c, i) => [key(...c), i]));
  const faces = cells.map(() => -1);
  const queue = [[0, [0, 1, 2, 3, 4, 5]]];
  faces[0] = 0;
  while (queue.length) {
    const [i, o] = queue.shift();
    for (const [dx, dy] of STEPS) {
      const j = index.get(key(cells[i][0] + dx, cells[i][1] + dy));
      if (j == null || faces[j] >= 0) continue;
      const next = ROLL[key(dx, dy)](o);
      faces[j] = next[0];
      queue.push([j, next]);
    }
  }
  return faces;
}

/**
 * Fold a net by the fraction t (0 flat, 1 closed): every square turns 90°·t about the edge it shares
 * with its parent in a tree grown from the square with the most neighbours (the base, which stays flat).
 * Returns the four corners [x, y, z] of each square, in the order of `cells`.
 */
export function foldNet(cells, t) {
  const angle = (Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0)) * Math.PI) / 2;
  const [c, s] = [Math.cos(angle), Math.sin(angle)];
  const index = new Map(cells.map((cell, i) => [key(...cell), i]));
  const around = i => STEPS.map(([dx, dy]) => index.get(key(cells[i][0] + dx, cells[i][1] + dy))).filter(j => j != null);
  let root = 0;
  cells.forEach((_, i) => {
    if (around(i).length > around(root).length) root = i;
  });
  const parent = cells.map(() => -1);
  const seen = new Set([root]);
  const queue = [root];
  while (queue.length) {
    const i = queue.shift();
    for (const j of around(i)) {
      if (seen.has(j)) continue;
      seen.add(j);
      parent[j] = i;
      queue.push(j);
    }
  }
  return cells.map(([x, y], i) => {
    let pts = [[x, y, 0], [x + 1, y, 0], [x + 1, y + 1, 0], [x, y + 1, 0]];
    // own hinge first, then the hinges of the squares between it and the base
    for (let k = i; parent[k] >= 0; k = parent[k]) {
      const [kx, ky] = cells[k];
      const [px, py] = cells[parent[k]];
      const axis = kx !== px ? 0 : 1; // coordinate that changes across the hinge
      const dir = axis === 0 ? kx - px : ky - py;
      const hinge = (axis === 0 ? kx : ky) + (dir > 0 ? 0 : 1);
      pts = pts.map(p => {
        const u = (p[axis] - hinge) * dir; // distance beyond the hinge, away from the parent
        const q = [...p];
        q[axis] = hinge + dir * (u * c - p[2] * s);
        q[2] = u * s + p[2] * c;
        return q;
      });
    }
    return pts;
  });
}

/** Total surface area of a cube of edge a: six squares of area a². */
export const surfaceArea = a => 6 * a * a;

// ---------- state ----------

export const initialState = () => ({
  mode: "fold", // "fold" (gấp và mở), "gallery" (11 hình khai triển), "puzzle" (tự xếp)
  net: 10, // 1…11, the net shown in fold mode (10 is the cross)
  fold: 45, // percent folded: 0 flat, 100 closed cube
  dir: 1, // 1: "Chạy" folds, −1: it unfolds
  edge: 3, // cm, edge of the cube
  yaw: 32, // degrees, turn of the view about the vertical
  pitch: 60, // degrees, how far the view looks down
  cells: "", // puzzle squares, "x,y;x,y;…" on the GRID_W × GRID_H grid (y down)
  checked: false, // the squares on the grid have been checked
  found: "", // numbers of the different nets found in the puzzle, "3,7,…"
});

/**
 * Advance the fold animation by dt seconds (2,5 s for the whole fold), in the direction s.dir.
 * Returns true when it has just reached flat or closed; the direction is then reversed for the next run.
 */
export function step(s, dt) {
  const dir = s.dir < 0 ? -1 : 1;
  const fold = Number.isFinite(s.fold) ? s.fold : 0;
  s.fold = Math.min(100, Math.max(0, fold + dir * dt * 40));
  if (s.fold > 0 && s.fold < 100) return false;
  s.dir = -dir;
  return true;
}

/** Puzzle squares from the state string: on the grid, no repeats, six at most. */
export function parseCells(str) {
  const out = [];
  const seen = new Set();
  for (const part of String(str ?? "").split(";")) {
    if (!/^\d{1,2},\d{1,2}$/.test(part)) continue;
    const [x, y] = part.split(",").map(Number);
    if (x >= GRID_W || y >= GRID_H || seen.has(key(x, y)) || out.length >= 6) continue;
    seen.add(key(x, y));
    out.push([x, y]);
  }
  return out;
}
export const formatCells = text;

/** Net numbers found so far: 1…11, no repeats. */
export function parseFound(str) {
  const all = String(str ?? "").split(",").map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= NETS.length);
  return [...new Set(all)];
}

/** Put a square on (x, y) or take it off. Returns "placed", "removed" or "full" (already six). */
export function toggleCell(s, x, y) {
  const cells = parseCells(s.cells);
  const i = cells.findIndex(c => c[0] === x && c[1] === y);
  if (i < 0 && cells.length >= 6) return "full";
  if (i < 0) cells.push([x, y]);
  else cells.splice(i, 1);
  s.cells = cells.map(c => key(...c)).join(";");
  s.checked = false;
  return i < 0 ? "placed" : "removed";
}

/** Check the puzzle squares, record a new valid net. Returns the check plus { isNew, count }. */
export function checkPuzzle(s) {
  const res = checkNet(parseCells(s.cells));
  const found = parseFound(s.found);
  const isNew = res.valid && !found.includes(res.net);
  if (isNew) found.push(res.net);
  s.found = found.join(",");
  s.checked = true;
  return { ...res, isNew, count: found.length };
}

/** View rotation: yaw about the vertical z, then tilt. Returns [right, up, towards the viewer]. */
export function rotate(p, yawDeg, pitchDeg) {
  const y = (yawDeg * Math.PI) / 180;
  const t = (pitchDeg * Math.PI) / 180;
  const front = p[0] * Math.cos(y) - p[1] * Math.sin(y);
  const right = p[0] * Math.sin(y) + p[1] * Math.cos(y);
  return [right, p[2] * Math.cos(t) - front * Math.sin(t), p[2] * Math.sin(t) + front * Math.cos(t)];
}
