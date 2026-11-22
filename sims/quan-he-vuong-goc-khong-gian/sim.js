import { mount, COLORS, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, SOLIDS, EXAMPLES, points, element, relation, rotate, centre, frontFaces, segmentVisible, nameAt, namesOnLine, quizPlane, pairIds, IN, PARALLEL, PERPENDICULAR, OBLIQUE } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const deg = a => `${fmt(a, 2)}°`;
const add = (p, q) => p.map((v, i) => v + q[i]);
const sub = (p, q) => p.map((v, i) => v - q[i]);
const mul = (p, k) => p.map(v => v * k);
const unit = p => mul(p, 1 / (Math.hypot(...p) || 1));
const dot = (p, q) => p.reduce((acc, v, i) => acc + v * q[i], 0);
const keys = s => (s.solid === "pyramid" ? ["p1", "p2"] : ["c1", "c2"]);

/** Break `text` into lines no wider than `maxW`. */
function wrap(ctx, text, maxW, size, bold) {
  ctx.font = `${bold ? "600 " : ""}${size}px ${FONT}`;
  const out = [];
  let cur = "";
  for (const word of text.split(" ")) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && ctx.measureText(next).width > maxW) {
      out.push(cur);
      cur = word;
    } else cur = next;
  }
  out.push(cur);
  return out;
}

// ---------- state changes and events ----------

function startQuiz(s) {
  const [k1, k2] = keys(s);
  s.solved = false;
  s[k2] = quizPlane(s);
  // start on a line that is not already an answer (AA' ⊥ (ABCD) would give the first one away)
  for (const id of SOLIDS[s.solid].lines) {
    s[k1] = id;
    if (relation(s).code !== PERPENDICULAR) break;
  }
}

function report(s, api) {
  const r = relation(s);
  api.emit("pair-selected", { relation: r.code, angle: r.angle }, "result");
  if (s.mode === "quiz" && !s.solved && r.code === PERPENDICULAR) {
    s.solved = true;
    s.found = (Number.isFinite(s.found) ? Math.max(0, Math.floor(s.found)) : 0) + 1;
    api.emit("perpendicular-found", { question: SOLIDS[s.solid].quiz.indexOf(quizPlane(s)) + 1, found: s.found }, "goal");
  }
}

function applyExample(s) {
  const ex = EXAMPLES.find(e => e[0] === s.example);
  if (!ex) return;
  const [, solid, edge, a, b] = ex;
  s.solid = solid;
  if (edge) s.edge = edge;
  const [k1, k2] = keys(s);
  s[k1] = a;
  s[k2] = b;
}

const handPicked = s => {
  s.example = "";
};

// ---------- text ----------

const kindName = id => (id.startsWith("(") ? "mặt phẳng" : "đường thẳng");

function describe(s, r, info) {
  const [a, b] = pairIds(s);
  const out = [];
  if (s.mode === "quiz") {
    const list = SOLIDS[s.solid].quiz;
    out.push([`Câu ${list.indexOf(b) + 1}/${list.length}: chọn đường thẳng hoặc mặt phẳng vuông góc với ${b}.`, COLORS.ink, true]);
    if (r.code === PERPENDICULAR) out.push([`Đúng! ${a} ⊥ ${b}. Bấm "Câu tiếp theo".`, COLORS.green, true]);
    else if (r.code === IN && a === b) out.push(["Đó chính là mặt phẳng đã cho. Chọn đối tượng khác.", COLORS.muted]);
    else out.push([`${a} và ${b}: chưa vuông góc (góc ${deg(r.angle)}). Thử lại.`, COLORS.red]);
    return out;
  }
  const t = r.angle > 0.01 && r.angle < 89.99 ? `, tan φ ≈ ${fmt(Math.tan((r.angle * Math.PI) / 180), 3)}` : "";
  if (a.startsWith("(")) {
    if (r.code === IN) return [[`${a} và ${b} trùng nhau: góc bằng 0°.`, COLORS.ink, true]];
    if (r.code === PARALLEL) return [[`${a} // ${b}: hai mặt phẳng song song, góc bằng 0°.`, COLORS.ink, true]];
    out.push([`Giao tuyến ${info.delta}. Trong mỗi mặt phẳng kẻ đường thẳng vuông góc với giao tuyến tại ${info.K}.`, COLORS.muted]);
    out.push(
      r.code === PERPENDICULAR
        ? [`Hai đường đó vuông góc nên ${a} ⊥ ${b}: góc bằng 90°.`, COLORS.ink, true]
        : [`Góc giữa ${a} và ${b} là góc giữa hai đường đó: φ ≈ ${deg(r.angle)}${t}`, COLORS.ink, true]
    );
    return out;
  }
  if (r.code === IN) return [[`${a} nằm trong ${b}: góc bằng 0°.`, COLORS.ink, true]];
  if (r.code === PARALLEL) return [[`${a} // ${b}: ${a} không có điểm chung với ${b}, góc bằng 0°.`, COLORS.ink, true]];
  if (r.code === PERPENDICULAR) {
    const n = element(s, b).names;
    const l1 = n[0] + n[1];
    const l2 = n[0] + n.at(-1);
    out.push([`${a} ⊥ ${l1} và ${a} ⊥ ${l2} (hai đường cắt nhau trong ${b}),`, COLORS.muted]);
    out.push([`nên ${a} ⊥ ${b}: góc bằng 90°.`, COLORS.ink, true]);
    return out;
  }
  out.push([`${a} cắt ${b} tại ${info.I}; hình chiếu của ${info.M} trên ${b} là ${info.H}, nên hình chiếu của ${a} là ${info.I}${info.H}.`, COLORS.muted]);
  out.push([`Góc giữa ${a} và ${b} là góc ${info.M}${info.I}${info.H}: φ ≈ ${deg(r.angle)}${t}`, COLORS.ink, true]);
  return out;
}

// ---------- drawing ----------

const isSmall = view => view.w < 560 || view.h < 420;

function geom(s, view, rows) {
  const small = isSmall(view);
  const gap = small ? 16 : 22;
  const top = 10 + rows * gap;
  const bottom = small ? 16 : 24;
  const pts = points(s);
  const c = centre(s);
  const R = Math.max(...SOLIDS[s.solid].vertices.map(k => Math.hypot(...sub(pts[k], c))));
  const dist = 5 * R;
  const scale = (Math.min(view.w - 30, view.h - top - bottom) * 0.44) / R;
  const cx = view.w / 2;
  const cy = top + (view.h - top - bottom) / 2 + (s.solid === "pyramid" ? 0.1 * scale : 0);
  const P = x => {
    const [X, Y, Z] = rotate(sub(x, c), s.yaw, s.pitch);
    const k = (scale * dist) / (dist + Z);
    return [cx + X * k, cy - Y * k];
  };
  return { small, gap, top, bottom, P, dist, cx, cy };
}

function stroke(ctx, pts, { color = COLORS.ink, width = 2, dash = false } = {}) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash ? [6, 5] : []);
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.setLineDash([]);
}

function fillPoly(ctx, pts, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
}

/** Arc of the angle at screen point o between the directions to a and b. */
function arcMark(ctx, o, a, b, color, text, size) {
  let t1 = Math.atan2(a[1] - o[1], a[0] - o[0]);
  let t2 = Math.atan2(b[1] - o[1], b[0] - o[0]);
  let d = t2 - t1;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const r = 22;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(o[0], o[1], r, t1, t1 + d, d < 0);
  ctx.stroke();
  const m = t1 + d / 2;
  label(ctx, text, o[0] + (r + 10) * Math.cos(m), o[1] + (r + 10) * Math.sin(m), { color, bold: true, size, align: "center" });
}

/** Right-angle mark at x (3D) between unit directions e1 and e2. */
function rightMark(ctx, g, x, e1, e2, color) {
  const k = 0.09;
  stroke(ctx, [g.P(add(x, mul(e1, k))), g.P(add(add(x, mul(e1, k)), mul(e2, k))), g.P(add(x, mul(e2, k)))], { color, width: 1.5 });
}

function draw(ctx, s, view) {
  const pts = points(s);
  const solid = SOLIDS[s.solid];
  const [a, b] = pairIds(s);
  const e1 = element(s, a);
  const e2 = element(s, b);
  const r = relation(s);
  const shown = new Set(solid.vertices.filter(k => k !== "O" || s.solid === "pyramid"));
  const extra = []; // construction points without a name: [point, name]
  const named = (x, fallback) => {
    const k = nameAt(s, x);
    if (k) shown.add(k);
    else extra.push([x, fallback]);
    return k ?? fallback;
  };
  // names used by the explanation; the text is laid out first, the solid gets the room below it
  const info = {};
  let K = null;
  if (e1.kind === "line" && r.code === OBLIQUE) {
    info.I = named(r.I, "I");
    info.M = named(r.M, "M");
    info.H = named(r.H, "H");
  } else if (e1.kind === "line" && r.code === PERPENDICULAR) {
    named(r.I, "I");
  } else if (e1.kind === "plane" && (r.code === OBLIQUE || r.code === PERPENDICULAR)) {
    const on = namesOnLine(s, r.K, r.u);
    // stand on a named point of the common line when there is one (the textbook's choice of vertex)
    K = on.length ? pts[on.reduce((best, k) => (Math.hypot(...sub(pts[k], r.K)) < Math.hypot(...sub(pts[best], r.K)) ? k : best))] : r.K;
    info.K = named(K, "K");
    info.delta = on.length >= 2 ? on.slice(0, 2).join("") : on.length ? `Δ qua ${on[0]}` : "Δ";
  }
  const small = isSmall(view);
  const textSize = small ? 12 : 15;
  const rows = describe(s, r, info).flatMap(([text, color, bold]) => wrap(ctx, text, view.w - 24, textSize, bold).map(part => [part, color, bold]));
  const g = geom(s, view, rows.length);
  const faces = frontFaces(s, s.yaw, s.pitch, g.dist);
  const vis = (p, q) => segmentVisible(s, p, q, faces);

  // planes, light fills under the edges
  fillPoly(ctx, e2.pts.map(g.P), "rgba(47, 111, 237, 0.16)");
  if (e1.kind === "plane") fillPoly(ctx, e1.pts.map(g.P), "rgba(31, 157, 107, 0.2)");

  // edges of the solid: hidden ones dashed
  const seen = new Set();
  for (const f of solid.faces) {
    f.forEach((k, i) => {
      const j = f[(i + 1) % f.length];
      const key = [k, j].sort().join("-");
      if (seen.has(key)) return;
      seen.add(key);
      const hidden = !vis(pts[k], pts[j]);
      stroke(ctx, [g.P(pts[k]), g.P(pts[j])], { color: hidden ? COLORS.muted : COLORS.ink, width: hidden ? 1.3 : 2, dash: hidden });
    });
  }
  if (s.solid === "pyramid") {
    stroke(ctx, [g.P(pts.S), g.P(pts.O)], { color: COLORS.muted, width: 1.2, dash: true });
    stroke(ctx, [g.P(pts.A), g.P(pts.C)], { color: COLORS.muted, width: 1.2, dash: true });
    stroke(ctx, [g.P(pts.B), g.P(pts.D)], { color: COLORS.muted, width: 1.2, dash: true });
  }

  // the chosen line
  if (e1.kind === "line") stroke(ctx, [g.P(e1.p), g.P(e1.q)], { color: COLORS.orange, width: 3.5, dash: !vis(e1.p, e1.q) });
  else stroke(ctx, [...e1.pts, e1.pts[0]].map(g.P), { color: COLORS.green, width: 2.5 });
  stroke(ctx, [...e2.pts, e2.pts[0]].map(g.P), { color: COLORS.blue, width: 2.5 });

  // construction: projection, or the two lines ⊥ the common line
  const size = g.small ? 12 : 14;
  if (e1.kind === "line" && r.code === OBLIQUE) {
    stroke(ctx, [g.P(r.M), g.P(r.H)], { color: COLORS.red, width: 1.8, dash: true });
    stroke(ctx, [g.P(r.I), g.P(r.H)], { color: COLORS.purple, width: 3, dash: !vis(r.I, r.H) });
    rightMark(ctx, g, r.H, unit(sub(r.M, r.H)), unit(sub(r.I, r.H)), COLORS.red);
    arcMark(ctx, g.P(r.I), g.P(r.M), g.P(r.H), COLORS.purple, "φ", size);
  } else if (e1.kind === "line" && r.code === PERPENDICULAR) {
    const other = e2.pts.find(p => Math.hypot(...sub(p, r.I)) > 1e-6);
    const up = Math.hypot(...sub(e1.p, r.I)) > Math.hypot(...sub(e1.q, r.I)) ? e1.p : e1.q;
    rightMark(ctx, g, r.I, unit(sub(up, r.I)), unit(sub(other, r.I)), COLORS.red);
  } else if (e1.kind === "plane" && (r.code === OBLIQUE || r.code === PERPENDICULAR)) {
    const reach = (v, poly) => Math.max(0.3, ...poly.map(p => dot(sub(p, K), v)));
    const end1 = add(K, mul(r.v1, reach(r.v1, e1.pts)));
    const end2 = add(K, mul(r.v2, reach(r.v2, e2.pts)));
    stroke(ctx, [g.P(add(K, mul(r.u, -0.6))), g.P(add(K, mul(r.u, 0.6)))], { color: COLORS.red, width: 1.5 });
    stroke(ctx, [g.P(K), g.P(end1)], { color: COLORS.green, width: 3, dash: !vis(K, end1) });
    stroke(ctx, [g.P(K), g.P(end2)], { color: COLORS.purple, width: 3, dash: !vis(K, end2) });
    rightMark(ctx, g, K, r.u, r.v2, COLORS.red);
    if (r.code === PERPENDICULAR) rightMark(ctx, g, K, r.v1, r.v2, COLORS.red);
    else arcMark(ctx, g.P(K), g.P(end1), g.P(end2), COLORS.purple, "φ", size);
  }

  // point names, pushed away from the middle of the picture
  const mid = g.P(centre(s));
  const tag = ([x, y], text, color) => {
    const d = Math.hypot(x - mid[0], y - mid[1]) || 1;
    const at = [x + ((x - mid[0]) / d) * 13, y + ((y - mid[1]) / d) * 13];
    // halo, so a name stays readable where edges pass behind it
    ctx.font = `600 ${size}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = 4;
    ctx.strokeStyle = COLORS.bg;
    ctx.strokeText(text, ...at);
    label(ctx, text, ...at, { bold: true, size, color, align: "center" });
  };
  for (const k of shown) tag(g.P(pts[k]), k, COLORS.ink);
  for (const [x, text] of extra) tag(g.P(x), text, COLORS.red);

  // text
  rows.forEach(([text, color, bold], i) => label(ctx, text, 12, 12 + i * g.gap, { size: textSize, color, bold }));
  const note = g.small ? "Phối cảnh, cạnh đáy a = 1; nét đứt: khuất" : "Hình vẽ phối cảnh, cạnh đáy a = 1 đơn vị; nét đứt là đường bị khuất. Kéo để xoay.";
  label(ctx, note, view.w / 2, view.h - g.bottom / 2 - 2, { align: "center", size: g.small ? 11 : 12, color: COLORS.muted });
}

// ---------- controls ----------

const elementOptions = solid => [
  ...SOLIDS[solid].lines.map(id => ({ value: id, label: `Đường thẳng ${id}` })),
  ...SOLIDS[solid].planes.map(id => ({ value: id, label: `Mặt phẳng ${id}` })),
];
const planeOptions = solid => SOLIDS[solid].planes.map(id => ({ value: id, label: `Mặt phẳng ${id}` }));
const explore = s => s.mode === "explore";
const pick = (key, solid, text, options, more = {}) => ({
  type: "select",
  key,
  label: text,
  options,
  visible: s => s.solid === solid && (more.visible?.(s) ?? true),
  onChange: handPicked,
  onCommit: report,
});

mount({
  slug: "quan-he-vuong-goc-khong-gian",
  version: "1.0.0",
  title: "Đường thẳng vuông góc với mặt phẳng và góc trong không gian",
  hint: "Chọn một đường thẳng (hoặc mặt phẳng) và một mặt phẳng của khối để xem chúng song song, vuông góc hay tạo một góc. Kéo trên hình để xoay.",
  initialState,
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Chế độ",
      options: [
        { value: "explore", label: "Khám phá" },
        { value: "quiz", label: "Đố: tìm cặp vuông góc" },
      ],
      onChange(s) {
        if (s.mode === "quiz") startQuiz(s);
      },
    },
    {
      type: "select",
      key: "example",
      label: "Ví dụ trong sách giáo khoa",
      options: [{ value: "", label: "— Tự chọn —" }, ...EXAMPLES.map(([value, , , , , text]) => ({ value, label: text }))],
      visible: explore,
      onChange: applyExample,
      onCommit: report,
    },
    {
      type: "select",
      key: "solid",
      label: "Khối",
      options: [
        { value: "cube", label: "Hình lập phương ABCD.A'B'C'D'" },
        { value: "pyramid", label: "Hình chóp tứ giác đều S.ABCD" },
      ],
      onChange(s) {
        handPicked(s);
        if (s.mode === "quiz") startQuiz(s);
      },
      onCommit: report,
    },
    {
      type: "select",
      key: "edge",
      label: "Cạnh bên",
      options: [
        { value: "a", label: "SA = a (mọi cạnh bằng a)" },
        { value: "a2", label: "SA = a√2" },
      ],
      visible: s => s.solid === "pyramid",
      onChange: handPicked,
      onCommit: report,
    },
    pick("c1", "cube", "Đường thẳng hoặc mặt phẳng", elementOptions("cube")),
    pick("c2", "cube", "Mặt phẳng", planeOptions("cube"), { visible: explore }),
    pick("p1", "pyramid", "Đường thẳng hoặc mặt phẳng", elementOptions("pyramid")),
    pick("p2", "pyramid", "Mặt phẳng", planeOptions("pyramid"), { visible: explore }),
    {
      type: "button",
      label: "Câu tiếp theo",
      primary: true,
      visible: s => s.mode === "quiz",
      action(s) {
        s.quiz = (Math.floor(Number.isFinite(s.quiz) ? s.quiz : 0) + 1) % SOLIDS[s.solid].quiz.length;
        startQuiz(s);
      },
      event: "next-question",
    },
    { type: "slider", key: "yaw", label: "Xoay ngang", min: -180, max: 180, step: 1, format: v => `${Math.round(v)}°` },
    { type: "slider", key: "pitch", label: "Nghiêng", min: -30, max: 70, step: 1, format: v => `${fmt(v, 0)}°` },
  ],
  readouts: [
    { label: "Quan hệ", value: s => ["nằm trong / trùng nhau", "song song", "vuông góc", "cắt nhau, không vuông góc"][relation(s).code] },
    { label: "Góc", value: s => deg(relation(s).angle) },
    { label: "Câu đố đã giải", value: s => (s.mode === "quiz" ? fmt(s.found, 0) : "–") },
  ],
  pointer: {
    down(p, s) {
      s._drag = { x: p.x, y: p.y, yaw: s.yaw, pitch: s.pitch };
    },
    move(p, s) {
      const d = s._drag;
      if (!d) return;
      s.yaw = ((((Math.round(d.yaw + (p.x - d.x) * 0.5) + 180) % 360) + 360) % 360) - 180;
      s.pitch = clamp(Math.round(d.pitch + (p.y - d.y) * 0.4), -30, 70);
    },
    up(p, s, api) {
      const d = s._drag;
      s._drag = null;
      if (d && (d.yaw !== s.yaw || d.pitch !== s.pitch)) api.emit("rotate", { yaw: s.yaw, pitch: s.pitch }, "action");
    },
  },
  draw,
});
