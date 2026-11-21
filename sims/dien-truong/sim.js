import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, field, fieldOf, sanitize, pick, applySelected, XMAX, YMAX, QMAX } from "./model.js";

const SUB = ["₁", "₂", "₃"];
const signed = q => (q > 0 ? "+" : "") + fmt(q, 1);

// World (cm, y up) <-> screen, from the view size, so draw() and the pointer agree.
const geom = view => {
  const small = view.w < 560 || view.h < 420;
  const scale = Math.min(view.w / (2 * XMAX + 1), view.h / (2 * YMAX + 1));
  return {
    small,
    scale,
    r: small ? 10 : 14,
    sx: x => view.w / 2 + x * scale,
    sy: y => view.h / 2 - y * scale,
    wx: px => (px - view.w / 2) / scale,
    wy: py => (view.h / 2 - py) / scale,
  };
};

const snap = (v, max) => clamp(Math.round(v * 2) / 2, -max, max); // 0,5 cm, same as the sliders
const measure = s => field(s.charges, s.px, s.py);

function gridArrow(ctx, x, y, ux, uy, half) {
  const hx = x + ux * half;
  const hy = y + uy * half;
  ctx.beginPath();
  ctx.moveTo(x - ux * half, y - uy * half);
  ctx.lineTo(hx, hy);
  ctx.moveTo(hx - 5 * ux + 3 * uy, hy - 5 * uy - 3 * ux);
  ctx.lineTo(hx, hy);
  ctx.lineTo(hx - 5 * ux - 3 * uy, hy - 5 * uy + 3 * ux);
  ctx.stroke();
}

// A label on a pale backing, so it stays readable on top of the arrow grid.
function tag(ctx, text, x, y, opts) {
  ctx.font = `${opts.bold ? "600 " : ""}${opts.size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const w = ctx.measureText(text).width + 8;
  ctx.fillStyle = "rgba(247,249,253,0.88)";
  ctx.fillRect(opts.align === "center" ? x - w / 2 : x - 4, y - opts.size * 0.7, w, opts.size * 1.4);
  label(ctx, text, x, y, opts);
}

mount({
  slug: "dien-truong",
  version: "1.0.0",
  title: "Điện trường của điện tích điểm",
  hint: "Kéo các điện tích và điểm M trên hình. Đặt q = 0 để bỏ một điện tích.",
  initialState,
  sanitize,
  controls: [
    { type: "heading", label: "Điện tích" },
    {
      type: "select",
      key: "selected",
      label: "Điện tích đang chỉnh",
      options: [0, 1, 2].map(i => ({ value: i, label: `q${SUB[i]}` })),
      onChange: s => pick(s, s.selected),
    },
    {
      type: "slider",
      key: "selQ",
      label: "Điện tích q",
      min: -QMAX,
      max: QMAX,
      step: 0.5,
      onChange: applySelected,
      format: v => (v === 0 ? "0 (không có)" : `${signed(v)} nC`),
    },
    { type: "slider", key: "selX", label: "Vị trí x", min: -XMAX, max: XMAX, step: 0.5, unit: "cm", digits: 1, onChange: applySelected },
    { type: "slider", key: "selY", label: "Vị trí y", min: -YMAX, max: YMAX, step: 0.5, unit: "cm", digits: 1, onChange: applySelected },
    { type: "heading", label: "Điểm M" },
    { type: "slider", key: "px", label: "Vị trí x của M", min: -XMAX, max: XMAX, step: 0.5, unit: "cm", digits: 1 },
    { type: "slider", key: "py", label: "Vị trí y của M", min: -YMAX, max: YMAX, step: 0.5, unit: "cm", digits: 1 },
    { type: "checkbox", key: "showGrid", label: "Hiện hướng điện trường trên lưới" },
    { type: "checkbox", key: "showParts", label: "Hiện vectơ thành phần E₁, E₂, E₃" },
  ],
  readouts: [
    { label: "E tại M", value: s => `${fmt(measure(s).e, 0)} V/m` },
    { label: "Ex", value: s => `${fmt(measure(s).ex, 0)} V/m` },
    { label: "Ey", value: s => `${fmt(measure(s).ey, 0)} V/m` },
    {
      label: "Góc giữa E và trục Ox",
      value: s => {
        const f = measure(s);
        return f.e > 1e-6 ? `${fmt((Math.atan2(f.ey, f.ex) * 180) / Math.PI, 1)}°` : "–";
      },
    },
    { label: "V tại M", value: s => `${fmt(measure(s).v, 0)} V` },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = geom(view);
      const hit = (x, y, r) => Math.hypot(p.x - g.sx(x), p.y - g.sy(y)) < r;
      if (hit(s.px, s.py, 20)) s._drag = "M";
      else {
        const i = s.charges.findIndex(c => c.q !== 0 && hit(c.x, c.y, g.r + 10));
        if (i < 0) return false;
        s._drag = i;
        pick(s, i);
        api.sync();
      }
    },
    move(p, s, api, view) {
      const g = geom(view);
      const x = snap(g.wx(p.x), XMAX);
      const y = snap(g.wy(p.y), YMAX);
      if (s._drag === "M") {
        s.px = x;
        s.py = y;
      } else {
        s.selX = x;
        s.selY = y;
        applySelected(s);
      }
    },
    up(p, s, api) {
      if (s._drag === "M") {
        const f = measure(s);
        const data = { ex: f.ex, ey: f.ey, magnitude: f.e, potential: f.v, x: s.px, y: s.py };
        if (Number.isFinite(f.e)) api.emit("field-measured", data, "result"); // not on top of a charge
      } else {
        const c = s.charges[s._drag];
        const data = { index: s._drag + 1, q: c.q, x: c.x, y: c.y };
        api.emit("charge-dropped", data, "action");
      }
    },
  },
  draw(ctx, s, view) {
    const g = geom(view);
    const { small, sx, sy } = g;
    const active = s.charges.map((c, i) => ({ ...c, i })).filter(c => c.q !== 0);

    // axes through the origin
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, view.h / 2);
    ctx.lineTo(view.w, view.h / 2);
    ctx.moveTo(view.w / 2, 0);
    ctx.lineTo(view.w / 2, view.h);
    ctx.stroke();

    // field direction on a grid; darker where the field is stronger
    if (s.showGrid && active.length) {
      const sp = small ? 24 : 36;
      ctx.strokeStyle = COLORS.muted;
      ctx.lineWidth = 1.3;
      for (let x = (view.w / 2) % sp; x < view.w; x += sp) {
        for (let y = (view.h / 2) % sp; y < view.h; y += sp) {
          if (active.some(c => Math.hypot(x - sx(c.x), y - sy(c.y)) < sp * 0.7)) continue;
          const f = field(active, g.wx(x), g.wy(y));
          if (!(f.e > 0)) continue;
          ctx.globalAlpha = clamp(0.15 + (0.85 * (Math.log10(f.e) - 2.5)) / 2, 0.15, 1);
          gridArrow(ctx, x, y, f.ex / f.e, -f.ey / f.e, sp * 0.3);
        }
      }
      ctx.globalAlpha = 1;
    }

    // charges
    for (const c of active) {
      const x = sx(c.x);
      const y = sy(c.y);
      if (c.i === s.selected) {
        ctx.strokeStyle = COLORS.ink;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(x, y, g.r + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = c.q > 0 ? COLORS.red : COLORS.blue;
      ctx.beginPath();
      ctx.arc(x, y, g.r, 0, Math.PI * 2);
      ctx.fill();
      label(ctx, c.q > 0 ? "+" : "−", x, y, { color: "#fff", size: g.r * 1.4, align: "center", bold: true });
      tag(ctx, `q${SUB[c.i]} = ${signed(c.q)} nC`, x, y + g.r + (small ? 12 : 16), { size: small ? 11 : 13, align: "center", bold: true });
    }

    // test point M with the field vectors. Lengths are relative to the longest vector at M,
    // so the parallelogram rule holds on screen; the absolute scale changes from point to point.
    const mx = sx(s.px);
    const my = sy(s.py);
    const total = measure(s);
    const parts = active.map(c => ({ ...fieldOf(c, s.px, s.py), c }));
    const ok = Number.isFinite(total.e);
    const longest = Math.max(total.e, ...parts.map(p => Math.hypot(p.ex, p.ey)));
    const unit = ok && longest > 0 ? (small ? 46 : 80) / longest : 0;
    const tip = f => [mx + f.ex * unit, my - f.ey * unit];
    if (unit && s.showParts && parts.length > 1) {
      if (parts.length === 2) {
        ctx.strokeStyle = COLORS.muted;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(...tip(parts[0]));
        ctx.lineTo(...tip(total));
        ctx.lineTo(...tip(parts[1]));
        ctx.stroke();
        ctx.setLineDash([]);
      }
      for (const p of parts) {
        const [tx, ty] = tip(p);
        const color = p.c.q > 0 ? COLORS.red : COLORS.blue;
        arrow(ctx, mx, my, tx, ty, color, 1.5);
        if (Math.hypot(tx - mx, ty - my) > 16) label(ctx, `E${SUB[p.c.i]}`, tx + 6, ty - 8, { color, size: small ? 11 : 13 });
      }
    }
    if (unit) {
      const [tx, ty] = tip(total);
      arrow(ctx, mx, my, tx, ty, COLORS.green, 3.5);
      if (total.e * unit > 16) label(ctx, "E", tx + 7, ty + 9, { color: COLORS.green, bold: true, size: small ? 13 : 16 });
    }
    ctx.fillStyle = COLORS.yellow;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx, my, small ? 5 : 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    label(ctx, "M", mx - (small ? 13 : 16), my + (small ? 11 : 14), { bold: true, size: small ? 13 : 15, align: "center" });

    // values at M
    const size = small ? 12 : 15;
    const lines = [`E = ${fmt(total.e, 0)} V/m`, `V = ${fmt(total.v, 0)} V`];
    ctx.font = `600 ${size}px system-ui, sans-serif`;
    const bw = Math.max(...lines.map(t => ctx.measureText(t).width)) + 16;
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.fillRect(6, 6, bw, size * 2.9);
    label(ctx, lines[0], 14, 6 + size * 0.85, { size, bold: true, color: COLORS.green });
    label(ctx, lines[1], 14, 6 + size * 2.1, { size, bold: true, color: COLORS.purple });

    // scale bar and drawing convention
    const bar = 2 * g.scale;
    const by = view.h - (small ? 22 : 30);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(10, by - 4);
    ctx.lineTo(10, by + 4);
    ctx.moveTo(10, by);
    ctx.lineTo(10 + bar, by);
    ctx.moveTo(10 + bar, by - 4);
    ctx.lineTo(10 + bar, by + 4);
    ctx.stroke();
    tag(ctx, "2 cm", 18 + bar, by, { size: 11, color: COLORS.ink });
    tag(ctx, small ? "Độ dài vectơ tại M: không theo tỉ lệ chung" : "Độ dài các vectơ tại M chỉ so sánh với nhau, không theo một tỉ lệ chung. Mũi tên lưới chỉ hướng, càng đậm thì điện trường càng mạnh.", 10, view.h - 9, {
      size: small ? 10 : 11,
      color: COLORS.muted,
    });
  },
});
