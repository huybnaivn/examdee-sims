// Cell structure: which structures each cell type has, a schematic layout used for drawing and
// hit-testing, a comparison of two cell types and a "name the marked structure" quiz.
// No DOM here. Diagram coordinates are schematic units: x 0..100 to the right, y 0..80 downwards.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const CELLS = {
  prokaryote: { index: 0, name: "Tế bào nhân sơ (vi khuẩn)", short: "Nhân sơ" },
  animal: { index: 1, name: "Tế bào động vật", short: "Động vật" },
  plant: { index: 2, name: "Tế bào thực vật", short: "Thực vật" },
};

const ALL = ["prokaryote", "animal", "plant"];
const EUKARYOTES = ["animal", "plant"];

// `membrane` marks the membrane-bound organelles (bào quan có màng bao bọc).
// Presence follows the typical cells of the school textbook (a bacterium, an animal cell, a leaf cell).
export const ORGANELLES = {
  "thanh-te-bao": {
    name: "Thành tế bào",
    cells: ["prokaryote", "plant"],
    membrane: false,
    fn: "Lớp vỏ cứng nằm ngoài màng sinh chất; quy định hình dạng và bảo vệ tế bào.",
    notes: {
      prokaryote: "Ở vi khuẩn, thành tế bào cấu tạo từ peptidoglycan.",
      plant: "Ở thực vật, thành tế bào cấu tạo chủ yếu từ cellulose.",
    },
  },
  "mang-sinh-chat": {
    name: "Màng sinh chất",
    cells: ALL,
    membrane: false,
    fn: "Lớp kép phospholipid cùng các protein bao bọc tế bào; kiểm soát sự trao đổi chất giữa tế bào với môi trường (thấm chọn lọc).",
  },
  "te-bao-chat": {
    name: "Tế bào chất",
    cells: ALL,
    membrane: false,
    fn: "Gồm bào tương và các bào quan; là nơi diễn ra phần lớn các hoạt động sống của tế bào.",
    notes: { prokaryote: "Tế bào chất của tế bào nhân sơ không có bào quan có màng bao bọc." },
  },
  ribosome: {
    name: "Ribosome",
    cells: ALL,
    membrane: false,
    fn: "Bào quan không có màng bao bọc; là nơi tổng hợp protein.",
    notes: { prokaryote: "Ribosome của tế bào nhân sơ (70S) nhỏ hơn ribosome của tế bào nhân thực (80S)." },
  },
  "vung-nhan": {
    name: "Vùng nhân",
    cells: ["prokaryote"],
    membrane: false,
    fn: "Chứa một phân tử DNA dạng vòng, không có màng bao bọc; mang thông tin di truyền của tế bào nhân sơ.",
  },
  plasmid: {
    name: "Plasmid",
    cells: ["prokaryote"],
    membrane: false,
    fn: "Phân tử DNA vòng nhỏ nằm ngoài vùng nhân, có ở nhiều vi khuẩn; có thể mang gene có lợi như gene kháng thuốc kháng sinh.",
  },
  roi: {
    name: "Roi",
    cells: ["prokaryote"],
    membrane: false,
    fn: "Sợi dài mọc ra ngoài tế bào; giúp vi khuẩn di chuyển.",
  },
  nhan: {
    name: "Nhân",
    cells: EUKARYOTES,
    membrane: true,
    fn: "Có màng kép bao bọc, bên trong chứa chất nhiễm sắc (DNA) và nhân con; là trung tâm điều khiển mọi hoạt động sống của tế bào.",
  },
  "luoi-noi-chat": {
    name: "Lưới nội chất",
    cells: EUKARYOTES,
    membrane: true,
    fn: "Hệ thống ống và túi dẹp thông với nhau. Lưới nội chất hạt (có ribosome) tổng hợp protein; lưới nội chất trơn tổng hợp lipid và khử độc.",
  },
  "bo-may-golgi": {
    name: "Bộ máy Golgi",
    cells: EUKARYOTES,
    membrane: true,
    fn: "Chồng túi dẹp; biến đổi, đóng gói và phân phối các sản phẩm (protein, lipid) đến nơi sử dụng.",
  },
  "ti-the": {
    name: "Ti thể",
    cells: EUKARYOTES,
    membrane: true,
    fn: "Có màng kép, màng trong gấp nếp thành các mào; là nơi hô hấp tế bào, tạo ATP cung cấp năng lượng cho tế bào.",
  },
  "luc-lap": {
    name: "Lục lạp",
    cells: ["plant"],
    membrane: true,
    fn: "Có màng kép, chứa diệp lục trên các thylakoid; là nơi quang hợp, chuyển năng lượng ánh sáng thành năng lượng hoá học trong chất hữu cơ.",
  },
  "khong-bao": {
    name: "Không bào trung tâm",
    cells: ["plant"],
    membrane: true,
    fn: "Túi lớn có màng đơn, chứa dịch bào; dự trữ nước và các chất, tạo áp suất giúp tế bào căng và cứng.",
  },
  lysosome: {
    name: "Lysosome",
    cells: ["animal"],
    membrane: true,
    fn: "Túi có màng đơn chứa enzyme thuỷ phân; tiêu hoá nội bào, phân huỷ bào quan và tế bào già, hỏng.",
  },
  "trung-the": {
    name: "Trung thể",
    cells: ["animal"],
    membrane: false,
    fn: "Gồm hai trung tử xếp vuông góc, không có màng bao bọc; hình thành thoi phân bào khi tế bào phân chia.",
  },
};

export const has = (cell, id) => ORGANELLES[id]?.cells.includes(cell) ?? false;
/** Ids of the structures a cell type has, in table order. */
export const present = cell => Object.keys(ORGANELLES).filter(id => has(cell, id));

// ---------- schematic layout ----------
// An ellipse: centre, radii, rotation (radians, clockwise on screen).
const E = (x, y, rx, ry = rx, rot = 0) => ({ x, y, rx, ry, rot });
const dots = (...xy) => xy.map(([x, y]) => E(x, y, 0.9));

// body: the cell outline. layers: [id, depth of its inner edge], outside in; the cytoplasm fills the rest.
// parts: [id, ellipses], drawn in this order (later ones lie on top). free: a point of bare cytoplasm.
export const LAYOUT = {
  prokaryote: {
    body: { kind: "rrect", cx: 44, cy: 40, a: 40, b: 24, r: 24 },
    layers: [["thanh-te-bao", 3], ["mang-sinh-chat", 5.5]],
    free: [24, 36],
    parts: [
      ["roi", [E(92, 41, 8, 3.5)]],
      ["vung-nhan", [E(44, 40, 15, 9.5)]],
      ["plasmid", [E(69, 32, 3), E(20, 48, 3)]],
      ["ribosome", dots([14, 42], [30, 27], [36, 54], [57, 26.5], [65, 49], [73, 42], [53, 55])],
    ],
  },
  animal: {
    body: { kind: "ellipse", cx: 50, cy: 40, a: 40, b: 34 },
    layers: [["mang-sinh-chat", 3]],
    free: [38, 20],
    parts: [
      ["nhan", [E(46, 38, 11)]],
      ["luoi-noi-chat", [E(64.5, 32, 6, 10, 0.25)]],
      ["bo-may-golgi", [E(66, 55, 8, 5, -0.3)]],
      ["ti-the", [E(27, 23, 6, 3, 0.5), E(26, 57, 6, 3, -0.5), E(52, 63, 6, 3, 0.1)]],
      ["lysosome", [E(37, 58, 2.8), E(75, 43, 2.8)]],
      ["trung-the", [E(29, 40, 3.5)]],
      ["ribosome", dots([50, 15], [62, 17], [19, 34], [41, 53], [78, 33], [40, 66], [20, 47], [81, 49])],
    ],
  },
  plant: {
    body: { kind: "rrect", cx: 50, cy: 40, a: 42, b: 34, r: 6 },
    layers: [["thanh-te-bao", 3.5], ["mang-sinh-chat", 5.5]],
    free: [71, 29],
    parts: [
      ["khong-bao", [E(54, 44, 20, 15)]],
      ["nhan", [E(25, 24, 8)]],
      ["luoi-noi-chat", [E(28, 39, 6, 4.5)]],
      ["bo-may-golgi", [E(80, 21, 5.5, 4)]],
      ["luc-lap", [E(66, 20, 6.5, 3.5), E(79, 36, 6.5, 3.5, 1.2), E(28, 62, 6.5, 3.5, -0.2), E(48, 64.5, 6.5, 3.2), E(80, 58, 6.5, 3.5, 1)]],
      ["ti-the", [E(44, 19, 5, 2.6), E(19, 50, 5, 2.6, 1.4), E(64, 64.5, 5, 2.6)]],
      ["ribosome", dots([36, 14.5], [55, 14.5], [16, 37], [83.5, 47], [38, 66.5], [15.5, 61])],
    ],
  },
};

/** Is (x, y) inside the cell outline shrunk by depth d (negative d grows it)? */
export function insideBody(body, d, x, y) {
  const a = body.a - d;
  const h = body.b - d;
  if (a <= 0 || h <= 0) return false;
  if (body.kind === "ellipse") return ((x - body.cx) / a) ** 2 + ((y - body.cy) / h) ** 2 <= 1;
  const r = clamp(body.r - d, 0, Math.min(a, h));
  const qx = Math.abs(x - body.cx) - (a - r);
  const qy = Math.abs(y - body.cy) - (h - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) <= r;
}

function insidePart(p, x, y) {
  const slack = p.rx < 2 ? 1.2 : 0.5; // small targets get a more forgiving edge
  const c = Math.cos(p.rot);
  const s = Math.sin(p.rot);
  const dx = x - p.x;
  const dy = y - p.y;
  return ((dx * c + dy * s) / (p.rx + slack)) ** 2 + ((dy * c - dx * s) / (p.ry + slack)) ** 2 <= 1;
}

/** The id of the structure under a tap at diagram point (x, y), or "" for a tap outside the cell. */
export function hitTest(cell, x, y) {
  const layout = LAYOUT[cell];
  if (!layout || !Number.isFinite(x) || !Number.isFinite(y)) return "";
  for (let i = layout.parts.length - 1; i >= 0; i--) {
    if (layout.parts[i][1].some(p => insidePart(p, x, y))) return layout.parts[i][0];
  }
  if (!insideBody(layout.body, -1, x, y)) return "";
  for (const [id, depth] of layout.layers) if (!insideBody(layout.body, depth, x, y)) return id;
  return "te-bao-chat";
}

// ---------- comparison ----------
/** Structures that at least one of the two cell types has, and how many of them only one has. */
export function compare(a, b) {
  const rows = Object.keys(ORGANELLES)
    .filter(id => has(a, id) || has(b, id))
    .map(id => ({ id, a: has(a, id), b: has(b, id) }));
  const differences = rows.filter(r => r.a !== r.b).length;
  return { rows, differences, shared: rows.length - differences };
}

// ---------- quiz: name the marked structure ----------
/** Every structure of the cell once, in an order fixed by the seed. */
export function quizOrder(cell, seed) {
  const ids = present(cell);
  let a = seed >>> 0;
  const random = () => {
    // mulberry32
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

export const quizTotal = s => present(s.cell).length;
// quizStep and quizScore have no control, so a forged state is clamped here.
export const quizStep = s => clamp(Math.floor(s.quizStep) || 0, 0, quizTotal(s));
export const quizDone = s => quizStep(s) >= quizTotal(s);
export const quizAnswered = s => !quizDone(s) && !!ORGANELLES[s.answer];
export const quizScore = s => clamp(Math.floor(s.quizScore) || 0, 0, quizStep(s) + (quizAnswered(s) ? 1 : 0));
/** The structure the current question marks, "" once the quiz is finished. */
export const quizTarget = s => quizOrder(s.cell, s.quizSeed)[quizStep(s)] ?? "";

/** Score the answer just put in s.answer. Returns null if there is nothing to score. */
export function submitAnswer(s) {
  if (!quizAnswered(s)) return null;
  const step = quizStep(s);
  const correct = s.answer === quizTarget(s);
  s.quizStep = step;
  s.quizScore = clamp(Math.floor(s.quizScore) || 0, 0, step) + (correct ? 1 : 0);
  const total = quizTotal(s);
  return { correct, finished: step === total - 1, score: s.quizScore, total };
}

export function nextQuestion(s) {
  if (!quizAnswered(s)) return;
  s.quizStep = quizStep(s) + 1;
  s.answer = "";
}

export function restartQuiz(s, reseed = false) {
  s.quizStep = 0;
  s.quizScore = 0;
  s.answer = "";
  if (reseed) s.quizSeed = ((s.quizSeed >>> 0) + 1) >>> 0;
}

export function initialState() {
  return {
    cell: "plant",
    mode: "explore",
    selected: "luc-lap",
    membranes: false,
    other: "animal",
    answer: "",
    quizSeed: 1,
    quizStep: 0,
    quizScore: 0,
  };
}
