import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, measure, projections, rotate, add, scale, dot, length, RANGE } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
/** Font size at which `text` is no wider than maxW (never above `size`). */
function fitted(ctx, text, maxW, size, bold) {
  ctx.font = `${bold ? "600 " : ""}${size}px ${FONT}`;
  const w = ctx.measureText(text).width;
  return w > maxW ? Math.max(9, Math.floor((size * maxW) / w)) : size;
}
const vec = v => `(${v.map(x => fmt(x)).join("; ")})`;
const neg = x => (x < 0 ? `(${fmt(x)})` : fmt(x)); // a negative factor goes in brackets
const deg = x => (x == null ? "không xác định" : `${fmt(x, 1)}°`);
const root = x => (Number.isInteger(Math.sqrt(x)) ? fmt(Math.sqrt(x)) : `√${fmt(x)}`);

// One result per finished adjustment; the goal once each time the vectors become perpendicular.
function report(s, api) {
  const m = measure(s);
  api.emit("vectors-set", { dot: m.dot, ...(m.angle != null && { angle: m.angle }), lengthA: m.lenA, lengthB: m.lenB }, "result");
  if (m.perpendicular && !s.perp) api.emit("perpendicular", { ax: m.a[0], ay: m.a[1], az: m.a[2], bx: m.b[0], by: m.b[1], bz: m.b[2] }, "goal");
  s.perp = m.perpendicular;
}

function lines(s, m, small) {
  const out = [];
  const [a, b] = [m.a, m.b];
  const perp = m.perpendicular ? ["a·b = 0 nên a ⊥ b", COLORS.green, true] : null;
  if (small) {
    out.push([`a = ${vec(a)}, b = ${vec(b)}`, COLORS.ink, true]);
    out.push(perp ?? [`a·b = ${fmt(m.dot)};  (a, b) ${m.angle == null ? "không xác định" : "≈ " + deg(m.angle)}`, COLORS.ink]);
    return out;
  }
  out.push([`a = ${vec(a)},  b = ${vec(b)}`, COLORS.ink, true]);
  if (s.show === "sum") out.push([`a + b = (a₁ + b₁; a₂ + b₂; a₃ + b₃) = ${vec(m.sum)}`, COLORS.green]);
  if (s.show === "diff") out.push([`a − b = (a₁ − b₁; a₂ − b₂; a₃ − b₃) = ${vec(m.diff)}`, COLORS.purple]);
  if (s.show === "cross") out.push([`[a, b] = (a₂b₃ − a₃b₂; a₃b₁ − a₁b₃; a₁b₂ − a₂b₁) = ${vec(m.cross)}`, COLORS.orange]);
  out.push([`a·b = a₁b₁ + a₂b₂ + a₃b₃ = ${a.map((x, i) => `${neg(x)}·${neg(b[i])}`).join(" + ")} = ${fmt(m.dot)}`, COLORS.ink]);
  if (perp) out.push(perp);
  else if (m.angle == null) out.push(["Có vectơ-không: góc giữa hai vectơ không xác định", COLORS.muted]);
  else out.push([`cos(a, b) = a·b / (|a|·|b|) = ${fmt(m.dot)} / (${root(dot(a, a))} · ${root(dot(b, b))}) ≈ ${fmt(m.dot / (m.lenA * m.lenB), 3)}  ⟹  (a, b) ≈ ${deg(m.angle)}`, COLORS.ink]);
  return out;
}

function geom(s, m, view) {
  const small = view.w < 560 || view.h < 420;
  const text = lines(s, m, small);
  const gap = small ? 16 : 21;
  const top = 8 + text.length * gap;
  const bottom = small ? 16 : 22;
  const L = RANGE + 1; // half-length of the axes
  const drawn = [m.a, m.b, ...(s.show === "sum" ? [m.sum] : [])];
  const R = Math.max(L + 0.6, ...drawn.map(length));
  const k = (Math.min(view.w - 24, view.h - top - bottom) / 2) / R;
  const cx = view.w / 2;
  const cy = top + (view.h - top - bottom) / 2;
  const P = p => {
    const [x, y] = rotate(p, s.yaw, s.pitch);
    return [cx + x * k, cy - y * k];
  };
  return { small, text, gap, L, P, k };
}

function path(ctx, pts, { color = COLORS.ink, width = 1.5, dash = null, fill = null } = {}) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  if (fill) {
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (!color) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash ?? []);
  ctx.stroke();
  ctx.setLineDash([]);
}

function dotAt(ctx, [x, y], color, r = 3.5) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Name of a vector with the arrow drawn over it, centred on (x, y). */
function vecName(ctx, text, [x, y], color, size) {
  label(ctx, text, x, y, { color, size, bold: true, align: "center" });
  ctx.font = `600 ${size}px ${FONT}`;
  const w = Math.max(9, ctx.measureText(text).width);
  arrow(ctx, x - w / 2, y - size * 0.72, x + w / 2 + 1, y - size * 0.72, color, 1.2);
}

/** A point `d` px past `to`, on the ray from `from`. */
const past = (from, to, d = 13) => {
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
  return [to[0] + ((to[0] - from[0]) / len) * d, to[1] + ((to[1] - from[1]) / len) * d];
};

/** Beside the middle of the segment p–q, on the side away from `avoid`. */
const beside = (p, q, avoid, d = 13) => {
  const mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
  const n = [-(q[1] - p[1]) / len, (q[0] - p[0]) / len];
  const side = (mid[0] - avoid[0]) * n[0] + (mid[1] - avoid[1]) * n[1] >= 0 ? 1 : -1;
  return [mid[0] + n[0] * d * side, mid[1] + n[1] * d * side];
};

/** Small parallelogram at O marking the right angle between unit directions u and v. */
function rightAngle(ctx, g, u, v, color, e = 0.5) {
  path(ctx, [g.P(scale(u, e)), g.P(add(scale(u, e), scale(v, e))), g.P(scale(v, e))], { color, width: 1.5 });
}

function drawVector(ctx, g, v, color, name, size, mid = false) {
  const O = g.P([0, 0, 0]);
  const foot = [v[0], v[1], 0];
  // how the tip sits over (Oxy): down to its foot, then to the two axes
  path(ctx, [g.P(v), g.P(foot)], { color, width: 1, dash: [4, 4] });
  path(ctx, [g.P([v[0], 0, 0]), g.P(foot), g.P([0, v[1], 0])], { color: COLORS.muted, width: 1, dash: [2, 4] });
  arrow(ctx, ...O, ...g.P(v), color, 3);
  if (length(v)) vecName(ctx, name, mid ? beside(O, g.P(v), g.P([0, 0, -1])) : past(O, g.P(v)), color, size);
}

mount({
  slug: "vecto-khong-gian",
  version: "1.0.0",
  title: "Vectơ và tọa độ trong không gian Oxyz",
  hint: "a và b là hai vectơ chung gốc O. Kéo trên hình để xoay hệ trục. Thử làm cho a ⊥ b.",
  initialState,
  controls: [
    { type: "heading", label: "Vectơ a = (a₁; a₂; a₃)" },
    ...["ax", "ay", "az"].map((key, i) => ({ type: "slider", key, label: `a${"₁₂₃"[i]} (${["hoành độ", "tung độ", "cao độ"][i]})`, min: -RANGE, max: RANGE, step: 1, digits: 0, onCommit: report })),
    { type: "heading", label: "Vectơ b = (b₁; b₂; b₃)" },
    ...["bx", "by", "bz"].map((key, i) => ({ type: "slider", key, label: `b${"₁₂₃"[i]} (${["hoành độ", "tung độ", "cao độ"][i]})`, min: -RANGE, max: RANGE, step: 1, digits: 0, onCommit: report })),
    {
      type: "select",
      key: "show",
      label: "Vẽ thêm",
      options: [
        { value: "sum", label: "Tổng a + b" },
        { value: "diff", label: "Hiệu a − b" },
        { value: "cross", label: "Tích có hướng [a, b] (mở rộng)" },
        { value: "none", label: "Không vẽ thêm" },
      ],
    },
    { type: "checkbox", key: "showPoint", label: "Điểm A (đầu mút của a) và hình chiếu trên ba mặt phẳng tọa độ" },
    { type: "slider", key: "yaw", label: "Xoay quanh Oz", min: -180, max: 180, step: 1, format: v => `${fmt(v, 0)}°` },
    { type: "slider", key: "pitch", label: "Nghiêng", min: -10, max: 85, step: 1, format: v => `${fmt(v, 0)}°` },
  ],
  readouts: [
    { label: "Tích vô hướng a·b", value: s => fmt(measure(s).dot) },
    { label: "Độ dài |a|", value: s => fmt(measure(s).lenA) },
    { label: "Độ dài |b|", value: s => fmt(measure(s).lenB) },
    { label: "Góc (a, b)", value: s => deg(measure(s).angle) },
    {
      label: "Vectơ vẽ thêm",
      value: s => {
        const m = measure(s);
        return s.show === "sum" ? `a + b = ${vec(m.sum)}` : s.show === "diff" ? `a − b = ${vec(m.diff)}` : s.show === "cross" ? `[a, b] = ${vec(m.cross)}` : "–";
      },
    },
    { label: "|[a, b]| = |a|·|b|·sin(a, b)", value: s => (s.show === "cross" ? fmt(measure(s).area) : "–") },
  ],
  pointer: {
    down(p, s) {
      s._drag = { x: p.x, y: p.y, yaw: s.yaw, pitch: s.pitch };
    },
    move(p, s) {
      const d = s._drag;
      if (!d) return;
      s.yaw = ((((Math.round(d.yaw + (p.x - d.x) * 0.5) + 180) % 360) + 360) % 360) - 180;
      s.pitch = clamp(Math.round(d.pitch + (p.y - d.y) * 0.4), -10, 85);
    },
    up(p, s, api) {
      const d = s._drag;
      s._drag = null;
      if (d && (d.yaw !== s.yaw || d.pitch !== s.pitch)) api.emit("rotate", { yaw: s.yaw, pitch: s.pitch }, "action");
    },
  },
  draw(ctx, s, view) {
    const m = measure(s);
    const g = geom(s, m, view);
    const { P, L, small } = g;
    const size = small ? 13 : 15;
    const O = P([0, 0, 0]);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // unit grid on (Oxy)
    ctx.beginPath();
    for (let i = -RANGE; i <= RANGE; i++) {
      ctx.moveTo(...P([i, -RANGE, 0]));
      ctx.lineTo(...P([i, RANGE, 0]));
      ctx.moveTo(...P([-RANGE, i, 0]));
      ctx.lineTo(...P([RANGE, i, 0]));
    }
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.stroke();

    // axes with unit marks
    [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach((e, i) => {
      path(ctx, [P(scale(e, -L)), O], { color: COLORS.muted, width: 1, dash: [5, 4] });
      arrow(ctx, ...O, ...P(scale(e, L)), COLORS.ink, 1.5);
      for (let t = -RANGE; t <= RANGE; t++) if (t) dotAt(ctx, P(scale(e, t)), COLORS.muted, 1.6);
      const end = P(scale(e, L + 0.55));
      label(ctx, "xyz"[i], end[0], end[1], { size, bold: true, align: "center" });
    });
    label(ctx, "O", O[0] - 9, O[1] + 10, { size, align: "center" });

    // extra vector, under a and b
    if (s.show === "sum") {
      path(ctx, [P(m.a), P(m.sum), P(m.b)], { color: COLORS.muted, width: 1.2, dash: [6, 4] });
      arrow(ctx, ...O, ...P(m.sum), COLORS.green, 3);
      if (length(m.sum)) vecName(ctx, "a + b", past(O, P(m.sum)), COLORS.green, size);
    } else if (s.show === "diff") {
      // a − b drawn from the tip of b to the tip of a
      arrow(ctx, ...P(m.b), ...P(m.a), COLORS.purple, 3);
      if (length(m.diff)) vecName(ctx, "a − b", beside(P(m.b), P(m.a), O, 15), COLORS.purple, size);
    } else if (s.show === "cross" && m.area > 0) {
      path(ctx, [O, P(m.a), P(m.sum), P(m.b)], { color: null, fill: "rgba(240, 140, 46, 0.14)" });
      path(ctx, [P(m.a), P(m.sum), P(m.b)], { color: COLORS.orange, width: 1, dash: [4, 4] });
      const n = m.area > L ? scale(m.cross, L / m.area) : m.cross; // shortened to stay in the picture
      const u = scale(m.cross, 1 / m.area);
      rightAngle(ctx, g, u, scale(m.a, 1 / m.lenA), COLORS.orange);
      rightAngle(ctx, g, u, scale(m.b, 1 / m.lenB), COLORS.orange);
      arrow(ctx, ...O, ...P(n), COLORS.orange, 3);
      vecName(ctx, "[a, b]", past(O, P(n), 16), COLORS.orange, size);
    }

    drawVector(ctx, g, m.a, COLORS.blue, "a", size + 1, s.showPoint); // the tip is labelled A then
    drawVector(ctx, g, m.b, COLORS.red, "b", size + 1);

    // angle between a and b, drawn in their plane
    if (m.angle != null && m.angle > 0.5) {
      const u = scale(m.a, 1 / m.lenA);
      const w = add(m.b, scale(u, -dot(m.b, u)));
      const v = length(w) ? scale(w, 1 / length(w)) : null;
      const r = Math.min(1.3, 0.45 * Math.min(m.lenA, m.lenB));
      if (m.perpendicular) rightAngle(ctx, g, u, v, COLORS.green, Math.min(0.6, r));
      else if (v) {
        const t = (m.angle * Math.PI) / 180;
        const at = (f, rr = r) => P(add(scale(u, rr * Math.cos(f * t)), scale(v, rr * Math.sin(f * t))));
        path(ctx, Array.from({ length: 25 }, (_, i) => at(i / 24)), { color: COLORS.ink, width: 1.5 });
        const [x, y] = at(0.5, r + 14 / g.k);
        label(ctx, small ? "φ" : `${fmt(m.angle, 1)}°`, x, y, { size: small ? 12 : 13, align: "center" });
      }
    }

    // the point A and its projections on the three coordinate planes
    if (s.showPoint) {
      const A = m.a;
      const pr = projections(A);
      const box = [[A[0], 0, 0], [0, A[1], 0], [0, 0, A[2]]];
      path(ctx, [P(box[0]), P(pr.xy), P(box[1]), P(pr.yz), P(box[2]), P(pr.xz), P(box[0])], { color: COLORS.muted, width: 1, dash: [2, 4] });
      [["A₁", pr.xy, "(Oxy)"], ["A₂", pr.yz, "(Oyz)"], ["A₃", pr.xz, "(Oxz)"]].forEach(([name, q]) => {
        path(ctx, [P(A), P(q)], { color: COLORS.purple, width: 1.5, dash: [5, 4] });
        dotAt(ctx, P(q), COLORS.purple);
        const [x, y] = past(P(A), P(q), 13); // away from A, so the three labels spread out
        const dx = x - P(A)[0];
        label(ctx, small ? name : `${name}${vec(q)}`, x, y, { size: 12, color: COLORS.purple, bold: true, align: Math.abs(dx) < 8 ? "center" : dx < 0 ? "right" : "left" });
      });
      dotAt(ctx, P(A), COLORS.blue, 4.5);
      const [x, y] = P(A);
      label(ctx, small ? "A" : `A${vec(A)}`, x, y - 14, { size: 12, color: COLORS.blue, bold: true, align: "center" });
    }

    // text, on a light band so the axes do not cut through it
    ctx.fillStyle = "rgba(247, 249, 253, 0.85)";
    ctx.fillRect(0, 0, view.w, 6 + g.text.length * g.gap);
    g.text.forEach(([t, color, bold], i) => label(ctx, t, 10, 8 + g.gap * (i + 0.5), { size: fitted(ctx, t, view.w - 20, small ? 12 : 14, bold), color, bold }));
    const notes = [];
    if (s.showPoint && !small) notes.push("A₁, A₂, A₃: hình chiếu của A trên (Oxy), (Oyz), (Oxz)");
    if (s.show === "cross" && m.area > L) notes.push("[a, b] vẽ rút ngắn, không đúng tỉ lệ độ dài");
    if (s.show === "diff" && !small) notes.push("a − b vẽ từ đầu mút của b đến đầu mút của a");
    if (!notes.length) notes.push(small ? "Hình chiếu song song; mỗi ô lưới (Oxy) là 1 đơn vị" : "Hình vẽ theo phép chiếu song song; mỗi ô lưới trên (Oxy) là 1 đơn vị");
    label(ctx, notes.join("  ·  "), view.w / 2, view.h - (small ? 9 : 12), { align: "center", size: small ? 11 : 12, color: COLORS.muted });
  },
});
