import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, sum, magnitude, direction, angleBetween, LIMIT } from "./model.js";

const HALF_X = 2 * LIMIT + 1; // the sum can reach 2·LIMIT
const HALF_Y = 2 * LIMIT + 1;

const layout = view => {
  const scale = Math.min(view.w / (2 * HALF_X), view.h / (2 * HALF_Y));
  const ox = view.w / 2;
  const oy = view.h / 2;
  return { scale, toX: x => ox + x * scale, toY: y => oy - y * scale, fromX: px => (px - ox) / scale, fromY: py => (oy - py) / scale };
};

// One result per finished change of a or b (slider released or drag ended).
const report = (s, api) => {
  const r = sum(s);
  api.emit("resultant", { x: r.x, y: r.y, magnitude: magnitude(r.x, r.y), direction: direction(r.x, r.y) }, "result");
};

const component = (key, text) => ({
  type: "slider", key, label: text, min: -LIMIT, max: LIMIT, step: 0.5, digits: 1, onCommit: report,
});

mount({
  slug: "cong-vecto",
  version: "1.0.0",
  title: "Tổng hợp vectơ",
  hint: "Kéo đầu mũi tên của vectơ a hoặc b để thay đổi.",
  initialState,
  controls: [
    {
      type: "select",
      key: "method",
      label: "Quy tắc cộng",
      options: [
        { value: "parallelogram", label: "Quy tắc hình bình hành" },
        { value: "tip-to-tail", label: "Quy tắc ba điểm (nối đuôi)" },
      ],
    },
    { type: "heading", label: "Vectơ a" },
    component("ax", "Hoành độ aₓ"),
    component("ay", "Tung độ aᵧ"),
    { type: "heading", label: "Vectơ b" },
    component("bx", "Hoành độ bₓ"),
    component("by", "Tung độ bᵧ"),
    { type: "checkbox", key: "showComponents", label: "Hiện thành phần của vectơ tổng" },
  ],
  readouts: [
    { label: "|a|", value: s => fmt(magnitude(s.ax, s.ay)) },
    { label: "|b|", value: s => fmt(magnitude(s.bx, s.by)) },
    { label: "Góc giữa a và b", value: s => (Number.isNaN(angleBetween(s)) ? "–" : `${fmt(angleBetween(s), 1)}°`) },
    { label: "a + b", value: s => `(${fmt(sum(s).x, 1)}; ${fmt(sum(s).y, 1)})` },
    { label: "|a + b|", value: s => fmt(magnitude(sum(s).x, sum(s).y)) },
    { label: "Hướng của a + b", value: s => `${fmt(direction(sum(s).x, sum(s).y), 1)}°` },
  ],
  pointer: {
    down(p, s, api, view) {
      const L = layout(view);
      const near = (x, y) => Math.hypot(p.x - L.toX(x), p.y - L.toY(y)) < 24;
      // In tip-to-tail mode b is drawn from the tip of a, so its handle sits at a + b.
      const bTip = s.method === "tip-to-tail" ? sum(s) : { x: s.bx, y: s.by };
      s._drag = near(bTip.x, bTip.y) ? "b" : near(s.ax, s.ay) ? "a" : null;
      return s._drag !== null;
    },
    move(p, s, api, view) {
      const L = layout(view);
      const snap = v => clamp(Math.round(v * 2) / 2, -LIMIT, LIMIT);
      let x = L.fromX(p.x);
      let y = L.fromY(p.y);
      if (s._drag === "b" && s.method === "tip-to-tail") {
        x -= s.ax;
        y -= s.ay;
      }
      s[`${s._drag}x`] = snap(x);
      s[`${s._drag}y`] = snap(y);
      api.sync();
    },
    up(p, s, api) {
      api.emit("vector-set", { vector: s._drag, x: s[`${s._drag}x`], y: s[`${s._drag}y`] });
      s._drag = null;
      report(s, api);
    },
  },
  draw(ctx, s, view) {
    const L = layout(view);
    const r = sum(s);

    // grid and axes
    ctx.lineWidth = 1;
    for (let i = -HALF_X; i <= HALF_X; i++) {
      ctx.strokeStyle = COLORS.grid;
      ctx.beginPath();
      ctx.moveTo(L.toX(i), 0);
      ctx.lineTo(L.toX(i), view.h);
      ctx.moveTo(0, L.toY(i));
      ctx.lineTo(view.w, L.toY(i));
      ctx.stroke();
    }
    arrow(ctx, 0, L.toY(0), view.w - 4, L.toY(0), COLORS.muted, 1.5);
    arrow(ctx, L.toX(0), view.h, L.toX(0), 4, COLORS.muted, 1.5);
    label(ctx, "x", view.w - 14, L.toY(0) + 14, { color: COLORS.muted });
    label(ctx, "y", L.toX(0) + 10, 12, { color: COLORS.muted });
    label(ctx, "O", L.toX(0) - 12, L.toY(0) + 14, { color: COLORS.muted });
    if (L.scale > 14) {
      for (let i = -HALF_X + 1; i < HALF_X; i += 2) {
        if (i === 0) continue;
        label(ctx, String(i), L.toX(i), L.toY(0) + 14, { size: 10, align: "center", color: COLORS.muted });
        label(ctx, String(i), L.toX(0) - 12, L.toY(i), { size: 10, align: "center", color: COLORS.muted });
      }
    }

    const dashed = (x1, y1, x2, y2, color) => {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(L.toX(x1), L.toY(y1));
      ctx.lineTo(L.toX(x2), L.toY(y2));
      ctx.stroke();
      ctx.restore();
    };
    const vector = (x1, y1, x2, y2, color, name, width = 3) => {
      arrow(ctx, L.toX(x1), L.toY(y1), L.toX(x2), L.toY(y2), color, width);
      label(ctx, name, L.toX((x1 + x2) / 2) + 12, L.toY((y1 + y2) / 2) + 16, { color, bold: true, size: 15 });
    };

    if (s.showComponents) {
      dashed(r.x, 0, r.x, r.y, COLORS.orange);
      dashed(0, r.y, r.x, r.y, COLORS.orange);
    }

    vector(0, 0, s.ax, s.ay, COLORS.blue, "a");
    if (s.method === "tip-to-tail") {
      vector(s.ax, s.ay, r.x, r.y, COLORS.green, "b");
    } else {
      vector(0, 0, s.bx, s.by, COLORS.green, "b");
      dashed(s.ax, s.ay, r.x, r.y, COLORS.green);
      dashed(s.bx, s.by, r.x, r.y, COLORS.blue);
    }
    vector(0, 0, r.x, r.y, COLORS.red, "a + b", 4);

    // drag handles
    const bTip = s.method === "tip-to-tail" ? r : { x: s.bx, y: s.by };
    for (const [x, y, color] of [[s.ax, s.ay, COLORS.blue], [bTip.x, bTip.y, COLORS.green]]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(L.toX(x), L.toY(y), 11, 0, Math.PI * 2);
      ctx.stroke();
    }
  },
});
