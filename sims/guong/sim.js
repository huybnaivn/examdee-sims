import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, focalLength, imageDistance, magnification, imageHeight, describe, principalRays } from "./model.js";

const LEFT = 65; // cm of principal axis shown in front of the mirror
const D = { min: 2, max: 60 };
const H = { min: 1, max: 10 };
const RAY_COLORS = [COLORS.red, COLORS.green, COLORS.purple];
const spherical = s => s.mirrorType !== "plane";

// World (cm, mirror vertex at the origin, object at x < 0) to screen. Lines stay lines under
// different x and y scales, and a vertical mirror still reflects symmetrically, so the height
// is stretched to keep small objects readable.
const layout = (s, view) => {
  const right = spherical(s) ? 52 : 65; // cm shown behind the mirror (virtual images, F and C of a convex mirror)
  const sx = (view.w - 24) / (LEFT + right);
  const cx = 12 + LEFT * sx;
  const cy = view.h / 2 + 14;
  const sy = clamp((view.h / 2 - 40) / 22, sx, 2 * sx);
  return { cx, cy, sx, sy, X: x => cx + x * sx, Y: y => cy - y * sy };
};

const describeText = s => {
  const d = describe(s);
  if (d.atInfinity) return "Vật ở tiêu điểm: chùm tia phản xạ song song, ảnh ở vô cực";
  const size = { larger: "lớn hơn vật", smaller: "nhỏ hơn vật", equal: "bằng vật" }[d.size];
  return `Ảnh ${d.real ? "thật" : "ảo"}, ${d.upright ? "cùng chiều" : "ngược chiều"}, ${size}`;
};
const cm = (v, digits = 1) => (Number.isFinite(v) ? `${fmt(v, digits)} cm` : "∞");
const kText = s => (Number.isFinite(magnification(s)) ? fmt(magnification(s), 2) : "∞");

// One result per committed configuration (object dropped, slider released, mirror changed).
const report = (s, api) => {
  const di = imageDistance(s);
  if (!Number.isFinite(di)) return; // object on the focus: no image to report
  api.emit("image-formed", { imageDistance: di, magnification: magnification(s), real: di > 0 ? 1 : 0 }, "result");
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
  slug: "guong",
  version: "1.0.0",
  title: "Gương phẳng và gương cầu",
  hint: "Kéo vật AB để đổi khoảng cách và chiều cao. Quan sát các tia phản xạ và ảnh A′B′.",
  initialState,
  controls: [
    {
      type: "select",
      key: "mirrorType",
      label: "Loại gương",
      options: [
        { value: "plane", label: "Gương phẳng" },
        { value: "concave", label: "Gương cầu lõm (f > 0)" },
        { value: "convex", label: "Gương cầu lồi (f < 0)" },
      ],
      onCommit: report,
    },
    { type: "slider", key: "focal", label: "Độ lớn tiêu cự |f|", min: 5, max: 25, step: 1, unit: "cm", visible: spherical, onCommit: report },
    { type: "slider", key: "distance", label: "Khoảng cách vật d", min: D.min, max: D.max, step: 0.5, unit: "cm", digits: 1, onCommit: report },
    { type: "slider", key: "height", label: "Chiều cao vật AB", min: H.min, max: H.max, step: 0.5, unit: "cm", digits: 1, onCommit: report },
  ],
  readouts: [
    { label: "Tiêu cự f", value: s => cm(focalLength(s)) },
    { label: "Khoảng cách ảnh d′", value: s => cm(imageDistance(s)) },
    { label: "Số phóng đại k = −d′/d", value: kText },
    { label: "Chiều cao ảnh A′B′", value: s => cm(Math.abs(imageHeight(s))) },
  ],
  pointer: {
    down(p, s, api, view) {
      if (p.x > layout(s, view).cx - 4) return false;
      this.move(p, s, api, view);
      return true;
    },
    move(p, s, api, view) {
      const { cx, cy, sx, sy } = layout(s, view);
      s.distance = clamp(Math.round(((cx - p.x) / sx) * 2) / 2, D.min, D.max);
      s.height = clamp(Math.round(((cy - p.y) / sy) * 2) / 2, H.min, H.max);
    },
    up(p, s, api) {
      api.emit("move-object", { distance: s.distance, height: s.height });
      report(s, api);
    },
  },
  draw(ctx, s, view) {
    const { cx, cy, sx, sy, X, Y } = layout(s, view);
    const f = focalLength(s);
    const d = s.distance;
    const h = s.height;
    const di = imageDistance(s);
    const hi = imageHeight(s);
    const finite = Number.isFinite(di);
    const small = view.w < 520;
    const size = small ? 12 : 14;
    const xl = cx / sx; // left edge, cm in front of the mirror

    // principal axis with a tick every 10 cm
    line(ctx, 0, cy, view.w, cy, COLORS.muted, 1.5);
    for (let x = -60; x <= 60; x += 10) if (x) line(ctx, X(x), cy - 4, X(x), cy + 4, COLORS.muted, 1.5);
    const notes = ["Mỗi vạch 10 cm"];
    if (sy > sx * 1.05) notes.push(`chiều cao vẽ phóng to ${fmt(sy / sx, 1)} lần`);
    label(ctx, notes.join(" · "), view.w - 10, view.h - 14, { size: 12, align: "right", color: COLORS.muted });
    if (spherical(s))
      label(ctx, small ? "Vẽ quy ước: tia đổi hướng tại mặt phẳng qua O" : "Gương vẽ quy ước (góc mở nhỏ): các tia đổi hướng tại mặt phẳng qua đỉnh O", view.w - 10, view.h - 30, {
        size: 12, align: "right", color: COLORS.muted,
      });

    // mirror: reflecting side faces the object (left), hatching marks the back
    const half = Math.min(cy - 58, view.h - 46 - cy); // the vertex O stays on the axis
    const top = cy - half;
    const bottom = cy + half;
    const sag = s.mirrorType === "concave" ? -8 : s.mirrorType === "convex" ? 8 : 0; // edges bend towards C
    const mx = y => cx + sag * (((2 * (y - top)) / (bottom - top) - 1) ** 2);
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let y = top + 6; y < bottom; y += 12) {
      ctx.moveTo(mx(y), y);
      ctx.lineTo(mx(y) + 8, y - 7);
    }
    ctx.stroke();
    ctx.strokeStyle = COLORS.blue;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + sag, top);
    ctx.quadraticCurveTo(cx - sag, cy, cx + sag, bottom);
    ctx.stroke();

    // focus, centre of curvature and vertex
    if (spherical(s)) {
      for (const [x, name] of [[-f, "F"], [-2 * f, "C"]]) {
        ctx.fillStyle = COLORS.ink;
        ctx.beginPath();
        ctx.arc(X(x), cy, 4, 0, Math.PI * 2);
        ctx.fill();
        label(ctx, name, clamp(X(x), 10, view.w - 10), cy + 16, { size, align: "center", bold: true });
      }
      label(ctx, "O", cx + (f > 0 ? 12 : -12), cy + 16, { size, bold: true, align: "center" });
    }

    // rays from the object tip
    const tip = { x: X(-d), y: Y(h) };
    principalRays(s).forEach((r, i) => {
      const color = RAY_COLORS[i];
      const hit = { x: cx, y: Y(r.y) };
      const mid = { x: (tip.x + hit.x) / 2, y: (tip.y + hit.y) / 2 };
      arrow(ctx, tip.x, tip.y, mid.x, mid.y, color, 2);
      line(ctx, mid.x, mid.y, hit.x, hit.y, color);
      // reflected ray, back towards the left edge
      const head = Math.min(14, xl / 3);
      arrow(ctx, hit.x, hit.y, X(-head), Y(r.y - r.slope * head), color, 2);
      line(ctx, X(-head), Y(r.y - r.slope * head), 0, Y(r.y - r.slope * xl), color);
      // extensions behind the mirror (dashed) meet at a virtual image
      if (finite && di < 0) {
        const to = i === 0 && f < 0 ? { x: X(-f), y: cy } : { x: X(-di), y: Y(hi) };
        line(ctx, hit.x, hit.y, to.x, to.y, color, 1.5, [5, 5]);
      }
      // ray 3 of a spherical mirror only points at F: show the construction line
      if (i === 2 && f < 0) line(ctx, hit.x, hit.y, X(-f), cy, color, 1.5, [2, 5]);
      if (i === 2 && Number.isFinite(f) && f > 0 && d < f) line(ctx, X(-f), cy, tip.x, tip.y, color, 1.5, [2, 5]);
    });

    // object, named above its tip: the rays leave the tip sideways and downwards
    arrow(ctx, X(-d), cy, tip.x, tip.y, COLORS.ink, 4);
    label(ctx, "Vật AB", clamp(X(-d), 32, cx - 30), Math.max(tip.y - 13, 62), { size, align: "center", bold: true });

    // image
    if (finite) {
      const ix = X(-di);
      const iy = Y(hi);
      ctx.save();
      if (di < 0) ctx.setLineDash([7, 5]);
      arrow(ctx, ix, cy, ix, iy, COLORS.orange, 4);
      ctx.restore();
      if (ix < 30 || ix > view.w - 30) {
        label(ctx, `Ảnh A′B′ nằm ngoài khung hình (d′ = ${cm(di)})`, di > 0 ? 10 : view.w - 10, cy - 18, {
          size: 12, align: di > 0 ? "left" : "right", color: COLORS.orange, bold: true,
        });
      } else {
        const name = di < 0 ? "Ảnh ảo A′B′" : "Ảnh thật A′B′";
        // beside the tip, on the side no ray (or ray extension) passes through
        label(ctx, name, Math.min(ix + 6, view.w - (small ? 86 : 100)), clamp(iy + (hi < 0 ? 15 : -13), 62, view.h - 62), { size, color: COLORS.orange, bold: true });
      }
    }

    // caption
    label(ctx, describeText(s), 12, 18, { size, bold: true });
    label(ctx, `d = ${cm(d)}   d′ = ${cm(di)}   k = ${kText(s)}`, 12, 40, { size: size - 1, color: COLORS.muted });
  },
});
