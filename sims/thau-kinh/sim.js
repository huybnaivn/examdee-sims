import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, focalLength, imageDistance, magnification, imageHeight, describe, principalRays } from "./model.js";

const HALF = 65; // cm of principal axis shown on each side of the lens
const D = { min: 2, max: 60 };
const H = { min: 1, max: 10 };
const RAY_COLORS = [COLORS.red, COLORS.green, COLORS.purple];

// World (cm, lens at origin, light travelling to +x) to screen. Lines stay lines under
// different x and y scales, so the height is stretched to keep small objects readable.
const layout = view => {
  const cx = view.w / 2;
  const cy = view.h / 2 + 14;
  const sx = (view.w - 24) / (2 * HALF);
  const sy = clamp((view.h / 2 - 40) / 22, sx, 2 * sx);
  return { cx, cy, sx, sy, X: x => cx + x * sx, Y: y => cy - y * sy };
};

const describeText = s => {
  const d = describe(s);
  if (d.atInfinity) return "Vật ở tiêu điểm: chùm tia ló song song, ảnh ở vô cực";
  const size = { larger: "lớn hơn vật", smaller: "nhỏ hơn vật", equal: "bằng vật" }[d.size];
  return `Ảnh ${d.real ? "thật" : "ảo"}, ${d.upright ? "cùng chiều" : "ngược chiều"}, ${size}`;
};
const cm = (v, digits = 1) => (Number.isFinite(v) ? `${fmt(v, digits)} cm` : "∞");

// One result per finished change. With the object on the focal point the image is at infinity:
// atInfinity = 1 and imageDistance / magnification are left out (results must stay finite numbers).
const report = (s, api) => {
  const d = describe(s);
  const far = d.atInfinity;
  api.emit("image", {
    objectDistance: s.distance,
    focalLength: focalLength(s),
    ...(!far && { imageDistance: imageDistance(s), magnification: magnification(s) }),
    real: !far && d.real ? 1 : 0,
    atInfinity: far ? 1 : 0,
  }, "result");
};

function line(ctx, x1, y1, x2, y2, color, width = 2, dash = []) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
}

mount({
  slug: "thau-kinh",
  version: "1.0.0",
  title: "Thấu kính mỏng",
  hint: "Kéo vật AB để đổi khoảng cách và chiều cao. Quan sát ba tia đặc biệt và ảnh A′B′.",
  initialState,
  // every control changes the image, so every one of them reports it
  controls: [
    {
      type: "select",
      key: "lensType",
      label: "Loại thấu kính",
      options: [
        { value: "converging", label: "Thấu kính hội tụ (f > 0)" },
        { value: "diverging", label: "Thấu kính phân kì (f < 0)" },
      ],
    },
    { type: "slider", key: "focal", label: "Độ lớn tiêu cự |f|", min: 5, max: 25, step: 1, unit: "cm" },
    { type: "slider", key: "distance", label: "Khoảng cách vật d", min: D.min, max: D.max, step: 0.5, unit: "cm", digits: 1 },
    { type: "slider", key: "height", label: "Chiều cao vật AB", min: H.min, max: H.max, step: 0.5, unit: "cm", digits: 1 },
  ].map(c => ({ ...c, onCommit: report })),
  readouts: [
    { label: "Tiêu cự f", value: s => cm(focalLength(s)) },
    { label: "Khoảng cách ảnh d′", value: s => cm(imageDistance(s)) },
    { label: "Số phóng đại k", value: s => (Number.isFinite(magnification(s)) ? fmt(magnification(s), 2) : "∞") },
    { label: "Chiều cao ảnh A′B′", value: s => cm(Math.abs(imageHeight(s))) },
  ],
  pointer: {
    down(p, s, api, view) {
      if (p.x > layout(view).cx - 4) return false;
      this.move(p, s, api, view);
      return true;
    },
    move(p, s, api, view) {
      const { cx, cy, sx, sy } = layout(view);
      s.distance = clamp(Math.round(((cx - p.x) / sx) * 2) / 2, D.min, D.max);
      s.height = clamp(Math.round(((cy - p.y) / sy) * 2) / 2, H.min, H.max);
    },
    up(p, s, api) {
      api.emit("move-object", { distance: s.distance, height: s.height });
      report(s, api);
    },
  },
  draw(ctx, s, view) {
    const { cx, cy, sx, sy, X, Y } = layout(view);
    const f = focalLength(s);
    const d = s.distance;
    const h = s.height;
    const di = imageDistance(s);
    const hi = imageHeight(s);
    const finite = Number.isFinite(di);
    const small = view.w < 520;
    const size = small ? 12 : 14;
    const xr = (view.w - cx) / sx; // right edge, cm

    // principal axis with a tick every 10 cm
    line(ctx, 0, cy, view.w, cy, COLORS.muted, 1.5);
    for (let x = -60; x <= 60; x += 10) line(ctx, X(x), cy - 4, X(x), cy + 4, COLORS.muted, 1.5);
    label(ctx, `Mỗi vạch 10 cm${sy > sx * 1.05 ? ` · chiều cao vẽ phóng to ${fmt(sy / sx, 1)} lần` : ""}`, view.w - 10, view.h - 14, { size: 12, align: "right", color: COLORS.muted });

    // lens, drawn with the textbook symbol
    const top = 58;
    const bottom = view.h - 34;
    if (s.lensType === "converging") {
      arrow(ctx, cx, cy, cx, top, COLORS.blue, 3);
      arrow(ctx, cx, cy, cx, bottom, COLORS.blue, 3);
    } else {
      line(ctx, cx, top, cx, bottom, COLORS.blue, 3);
      for (const [y, dir] of [[top, -1], [bottom, 1]]) {
        line(ctx, cx, y, cx - 8, y + dir * 11, COLORS.blue, 3);
        line(ctx, cx, y, cx + 8, y + dir * 11, COLORS.blue, 3);
      }
    }

    // focal points and optical centre
    for (const [x, name] of [[-f, "F"], [f, "F′"]]) {
      ctx.fillStyle = COLORS.ink;
      ctx.beginPath();
      ctx.arc(X(x), cy, 4, 0, Math.PI * 2);
      ctx.fill();
      label(ctx, name, X(x), cy + 16, { size, align: "center", bold: true });
    }
    label(ctx, "O", cx + 10, cy + 16, { size, bold: true });

    // the three principal rays
    const tip = { x: X(-d), y: Y(h) };
    principalRays(s).forEach((r, i) => {
      const color = RAY_COLORS[i];
      const hit = { x: cx, y: Y(r.y) };
      const mid = { x: (tip.x + hit.x) / 2, y: (tip.y + hit.y) / 2 };
      arrow(ctx, tip.x, tip.y, mid.x, mid.y, color, 2);
      line(ctx, mid.x, mid.y, hit.x, hit.y, color);
      line(ctx, hit.x, hit.y, view.w, Y(r.y + r.slope * xr), color);
      // backward extensions (dashed) meet at a virtual image
      if (finite && di < 0) {
        const to = i === 0 && f < 0 ? { x: X(f), y: cy } : { x: X(di), y: Y(hi) };
        line(ctx, hit.x, hit.y, to.x, to.y, color, 1.5, [5, 5]);
      }
      // ray 3 only points at F: show the construction line
      if (i === 2 && f < 0) line(ctx, hit.x, hit.y, X(-f), cy, color, 1.5, [2, 5]);
      if (i === 2 && f > 0 && d < f) line(ctx, X(-f), cy, tip.x, tip.y, color, 1.5, [2, 5]);
    });

    // object
    arrow(ctx, X(-d), cy, tip.x, tip.y, COLORS.ink, 4);
    // named under the axis: no ray ever passes there on the object side
    label(ctx, "Vật AB", Math.max(32, X(-d)), cy + 36, { size, align: "center", bold: true });

    // image
    if (finite) {
      const ix = X(di);
      const iy = Y(hi);
      ctx.save();
      if (di < 0) ctx.setLineDash([7, 5]);
      arrow(ctx, ix, cy, ix, iy, COLORS.orange, 4);
      ctx.restore();
      const off = ix < 30 || ix > view.w - 30;
      if (off) {
        label(ctx, `Ảnh A′B′ nằm ngoài khung hình (d′ = ${cm(di)})`, di > 0 ? view.w - 10 : 10, cy - 18, {
          size: 12, align: di > 0 ? "right" : "left", color: COLORS.orange, bold: true,
        });
      } else {
        // keep the name clear of the rays that cross at the image point
        const name = di < 0 ? "Ảnh ảo A′B′" : "Ảnh thật A′B′";
        const opts = { size, color: COLORS.orange, bold: true };
        if (di > 0) label(ctx, name, ix - 8, clamp(iy + 16, 50, view.h - 34), { ...opts, align: "right" });
        else if (f > 0) label(ctx, name, clamp(ix, 50, view.w - 50), clamp(iy - 14, 62, view.h - 34), { ...opts, align: "center" });
        else label(ctx, name, ix, cy + 56, { ...opts, align: "center" });
      }
    }

    // caption
    label(ctx, describeText(s), 12, 18, { size, bold: true });
    label(ctx, `d = ${cm(d)}   d′ = ${cm(di)}   k = ${Number.isFinite(magnification(s)) ? fmt(magnification(s), 2) : "∞"}`, 12, 40, {
      size: size - 1, color: COLORS.muted,
    });
  },
});
