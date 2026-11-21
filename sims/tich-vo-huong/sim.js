import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { initialState, dot, dotPolar, angle, projection, kind, len, vecA, vecB, snap, LIMIT } from "./model.js";

const HALF = LIMIT + 1;
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const KIND = {
  acute: ["a·b > 0: góc giữa hai vectơ là góc nhọn", COLORS.green],
  right: ["a·b = 0: a ⊥ b (góc vuông)", COLORS.purple],
  obtuse: ["a·b < 0: góc giữa hai vectơ là góc tù", COLORS.red],
  zero: ["Có vectơ-không: a·b = 0, góc không xác định", COLORS.muted],
};

// Text block beside (wide stage) or above (otherwise) a square grid.
function layout(view) {
  const wide = view.w > view.h * 1.25;
  const textH = wide ? 0 : Math.min(118, view.h * 0.36);
  const side = wide ? Math.min(view.h, view.w * 0.6) : Math.min(view.w, view.h - textH);
  const gx = wide ? 0 : (view.w - side) / 2;
  const gy = wide ? (view.h - side) / 2 : textH;
  const scale = side / (2 * HALF);
  const ox = gx + side / 2;
  const oy = gy + side / 2;
  return {
    wide, side, gx, gy, scale, textH,
    text: wide ? { x: side + 16, y: 24, w: view.w - side - 28 } : { x: 10, y: 14, w: view.w - 20 },
    toX: x => ox + x * scale,
    toY: y => oy - y * scale,
    fromX: px => (px - ox) / scale,
    fromY: py => (oy - py) / scale,
  };
}

// One result per finished change of a or b, and a goal on becoming perpendicular.
const report = (s, api) => {
  const t = angle(s);
  api.emit("dot-product", { dot: dot(s), ...(!Number.isNaN(t) && { angle: t }), ax: s.ax, ay: s.ay, bx: s.bx, by: s.by }, "result");
  const right = kind(s) === "right";
  if (right && !s._wasRight) api.emit("perpendicular", { ax: s.ax, ay: s.ay, bx: s.bx, by: s.by }, "goal");
  s._wasRight = right;
};

const coord = (key, text) => ({ type: "slider", key, label: text, min: -LIMIT, max: LIMIT, step: 0.5, digits: 1, onCommit: report });

const par = v => (v < 0 ? `(${fmt(v, 1)})` : fmt(v, 1));

function fit(ctx, text, x, y, w, { size = 14, min = 9, bold = false, color = COLORS.ink } = {}) {
  ctx.font = `${bold ? "600 " : ""}${size}px ${FONT}`;
  while (size > min && ctx.measureText(text).width > w) ctx.font = `${bold ? "600 " : ""}${--size}px ${FONT}`;
  label(ctx, text, x, y, { size, bold, color });
}

mount({
  slug: "tich-vo-huong",
  version: "1.0.0",
  title: "Tích vô hướng của hai vectơ",
  hint: "Kéo đầu mũi tên của a hoặc b. Thử làm cho hai vectơ vuông góc với nhau.",
  initialState,
  controls: [
    { type: "heading", label: "Vectơ a" },
    coord("ax", "Hoành độ a₁"),
    coord("ay", "Tung độ a₂"),
    { type: "heading", label: "Vectơ b" },
    coord("bx", "Hoành độ b₁"),
    coord("by", "Tung độ b₂"),
    { type: "checkbox", key: "showProjection", label: "Hiện hình chiếu của b lên giá của a" },
  ],
  readouts: [
    { label: "|a|", value: s => fmt(len(vecA(s)), 3) },
    { label: "|b|", value: s => fmt(len(vecB(s)), 3) },
    { label: "Góc (a, b)", value: s => (Number.isNaN(angle(s)) ? "không xác định" : `${fmt(angle(s), 1)}°`) },
    { label: "a·b = a₁b₁ + a₂b₂", value: s => fmt(dot(s), 3) },
    { label: "|a|·|b|·cos(a, b)", value: s => fmt(dotPolar(s), 3) },
    { label: "Hình chiếu (có dấu) của b lên a", value: s => (projection(s) ? fmt(projection(s).signed, 3) : "–") },
  ],
  pointer: {
    down(p, s, api, view) {
      const L = layout(view);
      const near = (x, y) => Math.hypot(p.x - L.toX(x), p.y - L.toY(y)) < 24;
      s._drag = near(s.bx, s.by) ? "b" : near(s.ax, s.ay) ? "a" : null;
      return s._drag !== null;
    },
    move(p, s, api, view) {
      const L = layout(view);
      s[`${s._drag}x`] = snap(L.fromX(p.x));
      s[`${s._drag}y`] = snap(L.fromY(p.y));
      api.sync();
    },
    up(p, s, api) {
      api.emit("vector-moved", { vector: s._drag === "a" ? 1 : 2, x: s[`${s._drag}x`], y: s[`${s._drag}y`] });
      s._drag = null;
      report(s, api);
    },
  },
  draw(ctx, s, view) {
    const L = layout(view);
    const small = view.w < 560 || view.h < 430;
    const a = vecA(s);
    const b = vecB(s);
    const k = kind(s);
    const t = angle(s);

    // grid
    ctx.lineWidth = 1;
    ctx.strokeStyle = COLORS.grid;
    for (let i = -HALF; i <= HALF; i++) {
      ctx.beginPath();
      ctx.moveTo(L.toX(i), L.toY(-HALF));
      ctx.lineTo(L.toX(i), L.toY(HALF));
      ctx.moveTo(L.toX(-HALF), L.toY(i));
      ctx.lineTo(L.toX(HALF), L.toY(i));
      ctx.stroke();
    }
    arrow(ctx, L.toX(-HALF), L.toY(0), L.toX(HALF), L.toY(0), COLORS.muted, 1.5);
    arrow(ctx, L.toX(0), L.toY(-HALF), L.toX(0), L.toY(HALF), COLORS.muted, 1.5);
    label(ctx, "x", L.toX(HALF) - 8, L.toY(0) + 12, { color: COLORS.muted, size: 12 });
    label(ctx, "y", L.toX(0) + 8, L.toY(HALF) + 8, { color: COLORS.muted, size: 12 });
    label(ctx, "O", L.toX(0) - 12, L.toY(0) + 12, { color: COLORS.muted, size: 12 });
    if (L.scale > 22) {
      for (let i = -LIMIT; i <= LIMIT; i++) {
        if (i === 0) continue;
        label(ctx, String(i).replace("-", "−"), L.toX(i), L.toY(0) + 11, { size: 10, align: "center", color: COLORS.muted });
        label(ctx, String(i).replace("-", "−"), L.toX(0) - 10, L.toY(i), { size: 10, align: "center", color: COLORS.muted });
      }
    }

    // line of a, and projection of b on it
    const pr = projection(s);
    if (pr && s.showProjection) {
      const u = [a[0] / len(a), a[1] / len(a)];
      ctx.save();
      ctx.beginPath();
      ctx.rect(L.gx, L.gy, L.side, L.side);
      ctx.clip();
      ctx.strokeStyle = COLORS.muted;
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(L.toX(-u[0] * 2 * HALF), L.toY(-u[1] * 2 * HALF));
      ctx.lineTo(L.toX(u[0] * 2 * HALF), L.toY(u[1] * 2 * HALF));
      ctx.stroke();
      ctx.strokeStyle = COLORS.orange;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(L.toX(b[0]), L.toY(b[1]));
      ctx.lineTo(L.toX(pr.vector[0]), L.toY(pr.vector[1]));
      ctx.stroke();
      ctx.setLineDash([]);
      arrow(ctx, L.toX(0), L.toY(0), L.toX(pr.vector[0]), L.toY(pr.vector[1]), COLORS.orange, 5);
      ctx.restore();
    }

    // angle arc between a and b
    if (!Number.isNaN(t)) {
      const a1 = Math.atan2(-a[1], a[0]);
      const b1 = Math.atan2(-b[1], b[0]);
      let sweep = b1 - a1;
      while (sweep > Math.PI) sweep -= 2 * Math.PI;
      while (sweep < -Math.PI) sweep += 2 * Math.PI;
      const r = Math.min(30, L.scale * 1.2);
      ctx.strokeStyle = KIND[k][1];
      ctx.lineWidth = 2;
      if (k === "right") {
        // right-angle mark
        const ua = [a[0] / len(a), a[1] / len(a)];
        const ub = [b[0] / len(b), b[1] / len(b)];
        const q = (r * 0.6) / L.scale;
        ctx.beginPath();
        ctx.moveTo(L.toX(ua[0] * q), L.toY(ua[1] * q));
        ctx.lineTo(L.toX((ua[0] + ub[0]) * q), L.toY((ua[1] + ub[1]) * q));
        ctx.lineTo(L.toX(ub[0] * q), L.toY(ub[1] * q));
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(L.toX(0), L.toY(0), r, Math.min(a1, a1 + sweep), Math.max(a1, a1 + sweep));
        ctx.stroke();
      }
      const mid = a1 + sweep / 2;
      label(ctx, "θ", L.toX(0) + Math.cos(mid) * (r + 11), L.toY(0) + Math.sin(mid) * (r + 11), { color: KIND[k][1], bold: true, size: 14, align: "center" });
    }

    // vectors and handles
    for (const [v, color, name] of [[a, COLORS.blue, "a"], [b, COLORS.green, "b"]]) {
      arrow(ctx, L.toX(0), L.toY(0), L.toX(v[0]), L.toY(v[1]), color, 3.5);
      const n = len(v) || 1;
      label(ctx, `${name} (${fmt(v[0], 1)}; ${fmt(v[1], 1)})`, L.toX(v[0]) + (v[0] / n) * 14, L.toY(v[1]) - (v[1] / n) * 14 - 2, {
        color, bold: true, size: small ? 12 : 14, align: v[0] < -0.01 ? "right" : "left",
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(L.toX(v[0]), L.toY(v[1]), 10, 0, Math.PI * 2);
      ctx.stroke();
    }

    // formulas
    const { x, y, w } = L.text;
    const lh = L.wide ? 24 : Math.min(22, (L.textH - 6) / 5);
    const size = L.wide ? 15 : small ? 12 : 14;
    const lines = [
      [`a·b = a₁b₁ + a₂b₂ = ${par(s.ax)}·${par(s.bx)} + ${par(s.ay)}·${par(s.by)} = ${fmt(dot(s), 2)}`, COLORS.ink, true],
      [Number.isNaN(t) ? "|a|·|b|·cos θ: θ không xác định" : `|a|·|b|·cos θ = ${fmt(len(a), 2)}·${fmt(len(b), 2)}·cos ${fmt(t, 1)}° = ${fmt(dotPolar(s), 2)}`, COLORS.ink, false],
      [KIND[k][0], KIND[k][1], true],
      [pr && s.showProjection ? `Hình chiếu của b lên giá của a: độ dài |a·b|/|a| = ${fmt(pr.length, 2)}` : "", COLORS.orange, false],
      [`a·a = |a|² = ${fmt(dot({ ax: s.ax, ay: s.ay, bx: s.ax, by: s.ay }), 2)}`, COLORS.muted, false],
    ];
    lines.forEach(([text, color, bold], i) => text && fit(ctx, text, x, y + i * lh, w, { size, color, bold }));
    if (L.wide) fit(ctx, "Vectơ cam: hình chiếu vuông góc của b lên đường thẳng chứa a.", x, view.h - 16, w, { size: 12, color: COLORS.muted });
  },
});
